package socketio

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"protocol-testbench/internal/core"
)

func TestSocketIOPollingHandshake(t *testing.T) {
	p := NewSocketIOPlugin("127.0.0.1:0")
	inbound := make(chan core.UnifiedPacket, 4)

	req := httptest.NewRequest(http.MethodGet, "/socket.io/?EIO=4&transport=polling", nil)
	rec := httptest.NewRecorder()
	p.handle(rec, req, inbound)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for polling handshake, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.HasPrefix(body, `0{"sid":`) || !strings.Contains(body, `"upgrades":["websocket"]`) {
		t.Fatalf("unexpected Engine.IO open payload: %s", body)
	}
}

