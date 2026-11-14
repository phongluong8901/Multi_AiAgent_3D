package tcp_raw

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"
)

const (
	frameHeaderSize = 4
	maxTCPFrame     = 1 << 20 // 1 MB
)

// EncodeFrame đóng gói payload với header 4-byte Big-Endian độ dài gói.
func EncodeFrame(payload []byte) []byte {
	frame := make([]byte, frameHeaderSize+len(payload))
	binary.BigEndian.PutUint32(frame[:frameHeaderSize], uint32(len(payload)))
	copy(frame[frameHeaderSize:], payload)
	return frame
}

type tcpClient struct {
	conn net.Conn
	mu   sync.Mutex
}

func (c *tcpClient) writeFrame(frame []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	_, err := c.conn.Write(frame)
	return err
}

func (c *tcpClient) close() error {
	return c.conn.Close()
}

// TCPRawPlugin: giao thức TCP thuần tốc độ cao hỗ trợ cả 4-byte length-prefix binary và JSON theo dòng (\n).
type TCPRawPlugin struct {
	port     string
	mu       sync.Mutex
	listener net.Listener
	running  atomic.Bool
	connsMu  sync.RWMutex
	conns    map[*tcpClient]struct{}
	counters core.Counters
	seq      atomic.Uint64
}

func NewTCPRawPlugin(port string) *TCPRawPlugin {
	return &TCPRawPlugin{
		port:  port,
		conns: make(map[*tcpClient]struct{}),
	}
}

func (t *TCPRawPlugin) Name() string { return "tcp_raw" }

func (t *TCPRawPlugin) Start(ctx context.Context, inbound chan<- core.UnifiedPacket) error {
	ln, err := net.Listen("tcp", t.port)
	if err != nil {
		return err
	}
	t.mu.Lock()
	t.listener = ln
	t.mu.Unlock()
	t.running.Store(true)

	go t.acceptLoop(ln, inbound)
	go func() {
		<-ctx.Done()
		_ = t.Stop(context.Background())
	}()
	return nil
}

func (t *TCPRawPlugin) acceptLoop(ln net.Listener, inbound chan<- core.UnifiedPacket) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			if errors.Is(err, net.ErrClosed) || !t.running.Load() {
				return
			}
			continue
		}
		go t.handleConn(conn, inbound)
	}
}

func (t *TCPRawPlugin) handleConn(conn net.Conn, inbound chan<- core.UnifiedPacket) {
	client := &tcpClient{conn: conn}
	t.connsMu.Lock()
	t.conns[client] = struct{}{}
	t.connsMu.Unlock()
	t.counters.Clients.Add(1)

	defer func() {
		t.connsMu.Lock()
		delete(t.conns, client)
		t.connsMu.Unlock()
		t.counters.Clients.Add(-1)
		_ = client.close()
	}()

	br := bufio.NewReaderSize(conn, 64*1024)
	remote := conn.RemoteAddr().String()

	for {
		peek, err := br.Peek(1)
		if err != nil {
			return
		}

		// Ký tự in được (>= 0x20): hỗ trợ client gửi text/JSON theo dòng (VD: nc/telnet).
		if peek[0] >= 0x20 {
			line, rerr := br.ReadBytes('\n')
			trimmed := bytes.TrimSpace(line)
			if len(trimmed) > 0 {
				t.counters.In(len(trimmed) + 1)
				inbound <- core.UnifiedPacket{
					ID:            fmt.Sprintf("tcp_%d", t.seq.Add(1)),
					SourceProto:   "tcp_raw",
					ClientID:      remote,
					TopicOrRoute:  "tcp/line",
					Payload:       bytes.Clone(trimmed),
					PayloadSize:   len(trimmed),
					OverheadBytes: 1,
					CreatedAtNano: time.Now().UnixNano(),
				}
			}
			if rerr != nil {
				return
			}
			continue
		}

		// Nhị phân 4-byte Big-Endian length-prefix.
		var hdr [frameHeaderSize]byte
		if _, err := io.ReadFull(br, hdr[:]); err != nil {
			return
		}
		length := binary.BigEndian.Uint32(hdr[:])
		if length == 0 {
			continue
		}
		if length > maxTCPFrame {
			return
		}

		payload := make([]byte, length)
		if _, err := io.ReadFull(br, payload); err != nil {
			return
		}
		t.counters.In(int(length) + frameHeaderSize)
		inbound <- core.UnifiedPacket{
			ID:            fmt.Sprintf("tcp_%d", t.seq.Add(1)),
			SourceProto:   "tcp_raw",
			ClientID:      remote,
			TopicOrRoute:  "tcp/binary",
			Payload:       payload,
			PayloadSize:   int(length),
			OverheadBytes: frameHeaderSize,
			CreatedAtNano: time.Now().UnixNano(),
		}
	}
}

func (t *TCPRawPlugin) Stop(context.Context) error {
	t.running.Store(false)
	t.mu.Lock()
	ln := t.listener
	t.listener = nil
	t.mu.Unlock()

	var err error
	if ln != nil {
		err = ln.Close()
	}

	t.connsMu.RLock()
	for c := range t.conns {
		_ = c.close()
	}
	t.connsMu.RUnlock()
	return err
}

func (t *TCPRawPlugin) Send(pkt core.UnifiedPacket) error {
	if !t.running.Load() {
		return nil
	}
	t.counters.Latency.Observe(pkt.CalculateLatencyMs())
	frame := EncodeFrame(pkt.WireJSON())

	t.connsMu.RLock()
	targets := make([]*tcpClient, 0, len(t.conns))
	for c := range t.conns {
		targets = append(targets, c)
	}
	t.connsMu.RUnlock()

	sent := 0
	for _, c := range targets {
		if err := c.writeFrame(frame); err == nil {
			t.counters.Out(len(frame))
			sent++
		}
	}
	if sent == 0 {
		t.counters.Out(len(frame))
	}
	return nil
}

func (t *TCPRawPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	cp := bytes.Clone(payload)
	t.counters.In(len(cp) + frameHeaderSize)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("tcp_%d", t.seq.Add(1)),
		SourceProto:   "tcp_raw",
		ClientID:      "gateway_sim",
		TopicOrRoute:  "tcp/binary",
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: frameHeaderSize,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (t *TCPRawPlugin) ResetStats() {
	t.counters.Reset()
}

func (t *TCPRawPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "TCP Raw Binary (Length-Prefixed)",
		Port:           t.port,
		Endpoint:       "TCP 4B Big-Endian len + payload (hoặc JSON + \\n)",
		Direction:      "2 chiều",
		IsRunning:      t.running.Load(),
		HeaderOverhead: frameHeaderSize,
	}
	t.counters.Fill(&st)
	return st
}

