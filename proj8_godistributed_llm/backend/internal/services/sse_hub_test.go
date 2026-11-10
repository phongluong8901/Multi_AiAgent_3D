package services

import (
	"sync"
	"testing"

	"go-distributed-llm/internal/models"
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

