package main

import (
	"path/filepath"
	"testing"
)

func TestApp_LoadSaveConfigAndInitialState(t *testing.T) {
	app := NewApp()
	app.configPath = filepath.Join(t.TempDir(), "worker.test.yaml")

	st := app.GetState()
	if st.Running || st.Snapshot.Status != "STOPPED" {
		t.Fatalf("expected initial STOPPED state, got running=%v status=%s", st.Running, st.Snapshot.Status)
	}

	dto := st.Config
	dto.WorkerID = "desktop-gpu-09"
	dto.MaxParallelJobs = 4
	dto.LLMBaseURL = "http://127.0.0.1:11434"
	dto.DynamicModelSync = true

	saved := app.SaveConfig(dto, false)
	if saved.LastError != "" || saved.Config.WorkerID != "desktop-gpu-09" || saved.Config.MaxParallelJobs != 4 {
		t.Fatalf("SaveConfig failed: %+v", saved)
	}
}

