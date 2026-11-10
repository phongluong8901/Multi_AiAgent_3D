package worker

import (
	"context"
	"sync/atomic"
	"time"

	"go-distributed-llm/internal/models"
)

func (w *ClusterWorker) processJob(parentCtx context.Context, job models.JobPayload) {
	w.activeJobs.Add(1)
	defer w.activeJobs.Add(-1)

	targetAddr := w.resolveReplyAddr(job)
	startedAt := time.Now()
	w.log.Info("processing job",
		"job_id", job.ID,
		"model", job.Model,
		"transport", w.transportMode,
		"reply_to", targetAddr,
	)

	jobCtx, cancelJob := context.WithCancel(parentCtx)
	defer cancelJob()

	var userCanceled atomic.Bool

	cancelCh := w.eventBus.SubscribeCancel(jobCtx, job.ID)
	go func() {
		select {
		case <-jobCtx.Done():
			return
		case _, ok := <-cancelCh:
			if ok {
				userCanceled.Store(true)
				w.log.Info("received STOP signal, canceling LLM inference", "job_id", job.ID)
				cancelJob()
			}
		}
	}()

	// Dùng danh sách lịch sử hội thoại nếu Gateway gửi kèm; fallback về Prompt đơn lẻ.
	turns := job.Messages
	if len(turns) == 0 {
		turns = []models.ChatTurn{{Role: "user", Content: job.Prompt}}
	}

	llmCh, err := w.llm.GenerateStream(jobCtx, job.Model, turns)
	if err != nil {
		if userCanceled.Load() {
			w.ackJobSafe(job)
			return
		}
		if parentCtx.Err() != nil {
			return
		}

		w.log.Error("llm generation failed", "job_id", job.ID, "err", err)
		w.sendSingleError(job, targetAddr, err.Error())
		w.ackJobSafe(job)
		return
	}

	outCh := make(chan models.TokenChunk, 32)
	go func() {
		defer close(outCh)
		for chunk := range llmCh {
			chunk.JobID = job.ID
			chunk.WorkerID = w.id
			select {
			case outCh <- chunk:
			case <-jobCtx.Done():
				return
			}
		}
	}()

	streamErr := w.streamer.StreamTokens(jobCtx, targetAddr, outCh)
	if streamErr != nil && !userCanceled.Load() && parentCtx.Err() == nil {
		w.log.Error("token streaming failed", "job_id", job.ID, "transport", w.transportMode, "target", targetAddr, "err", streamErr)
	}

	if parentCtx.Err() == nil || userCanceled.Load() {
		w.ackJobSafe(job)
	}

	w.log.Info("job finished",
		"job_id", job.ID,
		"canceled", userCanceled.Load(),
		"duration_ms", time.Since(startedAt).Milliseconds(),
	)
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
