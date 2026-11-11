package services

import (
	"sync"
	"sync/atomic"
	"testing"

	"go-distributed-llm/shared/models"
)

func TestSSEHub_ConcurrentPushAndUnregister(t *testing.T) {
	hub := NewSSEHub()
	jobID := "job-race-check"
	ch := hub.Register(jobID)

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			hub.PushToUser(models.TokenChunk{JobID: jobID, Token: "tok"})
		}
	}()

	go func() {
		defer wg.Done()
		hub.Unregister(jobID)
	}()

	wg.Wait()

	for range ch {
	}
}

func TestSSEHub_BackpressureDropObserver(t *testing.T) {
	hub := NewSSEHub()
	var observed atomic.Int32
	hub.SetDropObserver(func() {
		observed.Add(1)
	})

	jobID := "job-slow-consumer"
	_ = hub.Register(jobID)
	defer hub.Unregister(jobID)

	// Fill subscriber buffer (256 slots)
	for i := 0; i < defaultSubscriberBuffer; i++ {
		hub.PushToUser(models.TokenChunk{JobID: jobID, Token: "t"})
	}
	// Next push exceeds buffer & times out after 50ms -> triggers drop observer cleanly
	hub.PushToUser(models.TokenChunk{JobID: jobID, Token: "overflow"})

	if hub.DroppedCount() != 1 || observed.Load() != 1 {
		t.Fatalf("expected 1 dropped chunk observed, got dropped=%d observed=%d", hub.DroppedCount(), observed.Load())
	}
}

