package worker

import (
	"context"
	"strings"
	"sync/atomic"
	"time"

	"go-distributed-llm/shared/models"
)

const maxBatchChunks = 8

func (w *ClusterWorker) processJob(parentCtx context.Context, job models.JobPayload) {
	w.activeJobs.Add(1)
	defer w.activeJobs.Add(-1)

	targetAddr := w.resolveReplyAddr(job)
	startedAt := time.Now()
	var queueWaitMs int64
	if !job.CreatedAt.IsZero() {
		queueWaitMs = startedAt.Sub(job.CreatedAt).Milliseconds()
		if queueWaitMs < 0 {
			queueWaitMs = 0
		}
	}
	w.recordActiveJob(job, queueWaitMs)

	w.log.Info("processing job",
		"job_id", job.ID,
		"trace_id", job.TraceID,
		"model", job.Model,
		"priority", job.Priority,
		"retry_count", job.RetryCount,
		"queue_wait_ms", queueWaitMs,
		"transport", w.transportMode,
		"reply_to", targetAddr,
	)

	var jobCtx context.Context
	var cancelJob context.CancelFunc
	if w.maxJobDuration > 0 {
		jobCtx, cancelJob = context.WithTimeout(parentCtx, w.maxJobDuration)
	} else {
		jobCtx, cancelJob = context.WithCancel(parentCtx)
	}
	defer cancelJob()

	var userCanceled atomic.Bool
	w.activeCancels.Store(job.ID, func() {
		if userCanceled.CompareAndSwap(false, true) {
			w.log.Info("received STOP signal, canceling LLM inference", "job_id", job.ID, "trace_id", job.TraceID)
			cancelJob()
		}
	})
	defer w.activeCancels.Delete(job.ID)

	turns := job.Messages
	if len(turns) == 0 {
		turns = []models.ChatTurn{{Role: "user", Content: job.Prompt}}
	}

	finishRecord := func(status string, tokensSent int, errMsg string) {
		w.recordJobFinish(JobRecord{
			JobID:       job.ID,
			TraceID:     job.TraceID,
			Model:       job.Model,
			Priority:    job.Priority,
			Status:      status,
			DurationMs:  time.Since(startedAt).Milliseconds(),
			QueueWaitMs: queueWaitMs,
			TokensSent:  tokensSent,
			Error:       errMsg,
			Timestamp:   time.Now().Unix(),
		})
	}

	llmCh, err := w.llm.GenerateStream(jobCtx, job.Model, turns, job.Options)
	if err != nil {
		if userCanceled.Load() {
			w.jobsCanceled.Add(1)
			finishRecord("CANCELED", 0, "")
			w.ackJobSafe(job)
			return
		}
		if parentCtx.Err() != nil {
			finishRecord("FAILED", 0, parentCtx.Err().Error())
			return
		}

		state := w.breaker.RecordFailure()
		w.jobsFailed.Add(1)
		w.log.Error("llm generation failed", "job_id", job.ID, "trace_id", job.TraceID, "breaker_state", state, "err", err)
		w.sendSingleError(job, targetAddr, err.Error())
		finishRecord("FAILED", 0, err.Error())
		w.ackJobSafe(job)
		return
	}

	outCh, streamHadErr, tokensSent := w.batchTokenStream(jobCtx, llmCh, job.ID)

	streamErr := w.streamer.StreamTokens(jobCtx, targetAddr, outCh)
	if streamErr != nil && !userCanceled.Load() && parentCtx.Err() == nil {
		w.log.Error("token streaming failed", "job_id", job.ID, "trace_id", job.TraceID, "transport", w.transportMode, "target", targetAddr, "err", streamErr)
	}

	sentCount := int(tokensSent.Load())
	if sentCount > 0 {
		w.totalTokensSent.Add(uint64(sentCount))
	}

	switch {
	case userCanceled.Load():
		w.jobsCanceled.Add(1)
		finishRecord("CANCELED", sentCount, "")
	case jobCtx.Err() == context.DeadlineExceeded && parentCtx.Err() == nil:
		w.breaker.RecordFailure()
		w.jobsTimedOut.Add(1)
		w.sendSingleError(job, targetAddr, "worker hard job timeout exceeded")
		finishRecord("TIMED_OUT", sentCount, "worker hard job timeout exceeded")
	case streamHadErr.Load() || streamErr != nil:
		w.jobsFailed.Add(1)
		errText := ""
		if streamErr != nil {
			errText = streamErr.Error()
		}
		finishRecord("FAILED", sentCount, errText)
	default:
		w.breaker.RecordSuccess()
		w.jobsCompleted.Add(1)
		finishRecord("COMPLETED", sentCount, "")
	}

	if parentCtx.Err() == nil || userCanceled.Load() {
		w.ackJobSafe(job)
	}

	w.log.Info("job finished",
		"job_id", job.ID,
		"trace_id", job.TraceID,
		"canceled", userCanceled.Load(),
		"duration_ms", time.Since(startedAt).Milliseconds(),
	)
}

func (w *ClusterWorker) batchTokenStream(ctx context.Context, llmCh <-chan models.TokenChunk, jobID string) (<-chan models.TokenChunk, *atomic.Bool, *atomic.Int64) {
	outCh := make(chan models.TokenChunk, 32)
	hadErr := &atomic.Bool{}
	sentTokens := &atomic.Int64{}

	go func() {
		defer close(outCh)

		flushInterval := w.batchFlushInterval
		var buf strings.Builder
		var bufferedUnits int
		var flushedFirst bool

		var timer *time.Timer
		var timerCh <-chan time.Time
		if flushInterval > 0 {
			timer = time.NewTimer(flushInterval)
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			defer timer.Stop()
		}

		sendChunk := func(c models.TokenChunk) bool {
			c.JobID = jobID
			c.WorkerID = w.id
			if c.CompletionTokens > 0 {
				sentTokens.Store(int64(c.CompletionTokens))
			} else if c.TokenUnits > 0 {
				sentTokens.Add(int64(c.TokenUnits))
			}
			select {
			case outCh <- c:
				return true
			case <-ctx.Done():
				return false
			}
		}

		flushBuf := func() bool {
			if buf.Len() == 0 && bufferedUnits == 0 {
				return true
			}
			c := models.TokenChunk{
				Token:      buf.String(),
				TokenUnits: bufferedUnits,
			}
			buf.Reset()
			bufferedUnits = 0
			flushedFirst = true
			return sendChunk(c)
		}

		for {
			select {
			case <-ctx.Done():
				return

			case <-timerCh:
				timerCh = nil
				if !flushBuf() {
					return
				}

			case chunk, ok := <-llmCh:
				if !ok {
					_ = flushBuf()
					return
				}

				if chunk.Error != "" {
					hadErr.Store(true)
					w.breaker.RecordFailure()
					if !flushBuf() {
						return
					}
					_ = sendChunk(chunk)
					return
				}

				units := chunk.TokenUnits
				if units <= 0 && chunk.Token != "" {
					units = 1
				}

				if !flushedFirst || flushInterval <= 0 || chunk.Done || chunk.PromptTokens > 0 || chunk.CompletionTokens > 0 {
					if buf.Len() > 0 {
						chunk.Token = buf.String() + chunk.Token
						chunk.TokenUnits = bufferedUnits + units
						buf.Reset()
						bufferedUnits = 0
						timerCh = nil
					} else {
						chunk.TokenUnits = units
					}
					flushedFirst = true
					if !sendChunk(chunk) {
						return
					}
					continue
				}

				buf.WriteString(chunk.Token)
				bufferedUnits += units

				if bufferedUnits >= maxBatchChunks {
					timerCh = nil
					if !flushBuf() {
						return
					}
					continue
				}

				if timer != nil && timerCh == nil {
					timer.Reset(flushInterval)
					timerCh = timer.C
				}
			}
		}
	}()

	return outCh, hadErr, sentTokens
}

func (w *ClusterWorker) resolveReplyAddr(job models.JobPayload) string {
	if w.transportMode == "http" && job.ReplyToHTTPAddr != "" {
		return job.ReplyToHTTPAddr
	}
	return job.ReplyToGrpcAddr
}

func (w *ClusterWorker) sendSingleError(job models.JobPayload, targetAddr string, errMsg string) {
	errCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	ch := make(chan models.TokenChunk, 1)
	ch <- models.TokenChunk{
		JobID:    job.ID,
		WorkerID: w.id,
		Error:    errMsg,
		Done:     true,
	}
	close(ch)

	_ = w.streamer.StreamTokens(errCtx, targetAddr, ch)
}

func (w *ClusterWorker) ackJobSafe(job models.JobPayload) {
	ackCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := w.queue.AckJob(ackCtx, w.consumerGroup, job.StreamName, job.StreamMessageID); err != nil {
		w.log.Warn("failed to XACK job", "job_id", job.ID, "msg_id", job.StreamMessageID, "err", err)
	}
}

