package rtp_udp

import (
	"bytes"
	"testing"
)

func TestRTPPacketRoundTripAndRawFallback(t *testing.T) {
	payload := []byte(`{"rtp_seq":1,"codec":"h264_sim"}`)
	datagram := BuildRTPPacket(42, 9000, payload)

	if len(datagram) != rtpHeaderSize+len(payload) {
		t.Fatalf("expected datagram len %d, got %d", rtpHeaderSize+len(payload), len(datagram))
	}
	if datagram[0]>>6 != 2 || datagram[1] != 96 {
		t.Fatalf("unexpected RTP version/pt bytes: %02x %02x", datagram[0], datagram[1])
	}

	got, overhead := ParseRTPPacket(datagram)
	if overhead != 20 {
		t.Fatalf("expected total overhead 20, got %d", overhead)
	}
	if !bytes.Equal(got, payload) {
		t.Fatalf("expected payload %s, got %s", payload, got)
	}

	raw := []byte(`{"raw_udp":true}`)
	rawGot, rawOvh := ParseRTPPacket(raw)
	if rawOvh != 8 {
		t.Fatalf("expected raw UDP overhead 8, got %d", rawOvh)
	}
	if !bytes.Equal(rawGot, raw) {
		t.Fatalf("expected raw payload %s, got %s", raw, rawGot)
	}
}

