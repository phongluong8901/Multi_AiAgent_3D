package tcp_raw

import (
	"bytes"
	"net"
	"testing"
	"time"

	"protocol-testbench/internal/core"
)

func TestTCPRawDualModeFraming(t *testing.T) {
	p := NewTCPRawPlugin("127.0.0.1:0")
	inbound := make(chan core.UnifiedPacket, 8)
	serverSide, clientSide := net.Pipe()
	done := make(chan struct{})
	go func() {
		defer close(done)
		p.handleConn(serverSide, inbound)
	}()

	// 1. Gửi frame nhị phân 4-byte length-prefix
	binPayload := []byte(`{"mode":"binary","seq":1}`)
	if _, err := clientSide.Write(EncodeFrame(binPayload)); err != nil {
		t.Fatalf("write binary frame: %v", err)
	}

	// 2. Gửi JSON theo dòng kết thúc bằng \n
	linePayload := []byte(`{"mode":"line","seq":2}`)
	if _, err := clientSide.Write(append(bytes.Clone(linePayload), '\n')); err != nil {
		t.Fatalf("write line frame: %v", err)
	}

	select {
	case pkt1 := <-inbound:
		if !bytes.Equal(pkt1.Payload, binPayload) || pkt1.OverheadBytes != 4 || pkt1.TopicOrRoute != "tcp/binary" {
			t.Fatalf("unexpected binary packet: %+v", pkt1)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for binary packet")
	}

	select {
	case pkt2 := <-inbound:
		if !bytes.Equal(pkt2.Payload, linePayload) || pkt2.OverheadBytes != 1 || pkt2.TopicOrRoute != "tcp/line" {
			t.Fatalf("unexpected line packet: %+v", pkt2)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for line packet")
	}

	_ = clientSide.Close()
	<-done
}

