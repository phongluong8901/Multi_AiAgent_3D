package grpc_stream

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"

	"google.golang.org/grpc"
	"google.golang.org/grpc/encoding"
)

const (
	// CodecName: codec JSON tự đăng ký, client dùng grpc.CallContentSubtype(CodecName).
	CodecName = "benchjson"
	// FullMethod của RPC bidirectional streaming.
	FullMethod = "/bench.Streamer/Pipe"
	// 9 byte HTTP/2 frame header + 5 byte gRPC length-prefix.
	grpcOverhead = 14
)

// jsonCodec cho phép chạy gRPC không cần protoc: message là core.UnifiedPacket dạng JSON.
type jsonCodec struct{}

func (jsonCodec) Marshal(v any) ([]byte, error)      { return json.Marshal(v) }
func (jsonCodec) Unmarshal(data []byte, v any) error { return json.Unmarshal(data, v) }
func (jsonCodec) Name() string                       { return CodecName }

func init() {
	encoding.RegisterCodec(jsonCodec{})
}

type streamService interface{}

// GRPCPlugin: gRPC bidirectional streaming trên HTTP/2.
type GRPCPlugin struct {
	port     string
	mu       sync.Mutex
	server   *grpc.Server
	running  atomic.Bool
	subsMu   sync.RWMutex
	subs     map[uint64]chan core.UnifiedPacket
	nextSub  atomic.Uint64
	seq      atomic.Uint64
	counters core.Counters
}

func NewGRPCPlugin(port string) *GRPCPlugin {
	return &GRPCPlugin{port: port, subs: make(map[uint64]chan core.UnifiedPacket)}
}

func (g *GRPCPlugin) Name() string { return "grpc" }

func (g *GRPCPlugin) Start(ctx context.Context, inbound chan<- core.UnifiedPacket) error {
	lis, err := net.Listen("tcp", g.port)
	if err != nil {
		return err
	}
	srv := grpc.NewServer(grpc.ForceServerCodec(jsonCodec{}))
	srv.RegisterService(&grpc.ServiceDesc{
		ServiceName: "bench.Streamer",
		HandlerType: (*streamService)(nil),
		Streams: []grpc.StreamDesc{{
			StreamName:    "Pipe",
			ServerStreams: true,
			ClientStreams: true,
			Handler: func(_ any, stream grpc.ServerStream) error {
				return g.handle(stream, inbound)
			},
		}},
	}, g)

	g.mu.Lock()
	g.server = srv
	g.mu.Unlock()
	g.running.Store(true)

	go func() {
		if err := srv.Serve(lis); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
			log.Printf("[ERROR] grpc serve: %v", err)
		}
	}()
	go func() {
		<-ctx.Done()
		_ = g.Stop(context.Background())
	}()
	return nil
}

func (g *GRPCPlugin) handle(stream grpc.ServerStream, inbound chan<- core.UnifiedPacket) error {
	id := g.nextSub.Add(1)
	out := make(chan core.UnifiedPacket, 256)
	g.subsMu.Lock()
	g.subs[id] = out
	g.subsMu.Unlock()
	g.counters.Clients.Add(1)
	defer func() {
		g.subsMu.Lock()
		delete(g.subs, id)
		g.subsMu.Unlock()
		g.counters.Clients.Add(-1)
	}()

	ctx := stream.Context()
	// 1 goroutine gửi + 1 goroutine nhận là cách dùng stream đồng thời hợp lệ của gRPC.
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case pkt := <-out:
				if err := stream.SendMsg(&pkt); err != nil {
					return
				}
				g.counters.Out(pkt.PayloadSize + grpcOverhead)
			}
		}
	}()

	for {
		var pkt core.UnifiedPacket
		if err := stream.RecvMsg(&pkt); err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
		pkt.SourceProto = "grpc"
		if pkt.ID == "" {
			pkt.ID = fmt.Sprintf("grpc_%d", g.seq.Add(1))
		}
		pkt.PayloadSize = len(pkt.Payload)
		pkt.OverheadBytes = grpcOverhead
		pkt.CreatedAtNano = time.Now().UnixNano()
		g.counters.In(pkt.PayloadSize + grpcOverhead)
		inbound <- pkt
	}
}

func (g *GRPCPlugin) Stop(context.Context) error {
	g.running.Store(false)
	g.mu.Lock()
	srv := g.server
	g.server = nil
	g.mu.Unlock()
	if srv != nil {
		srv.Stop()
	}
	return nil
}

func (g *GRPCPlugin) Send(pkt core.UnifiedPacket) error {
	if !g.running.Load() {
		return nil
	}
	g.counters.Latency.Observe(pkt.CalculateLatencyMs())
	sent := 0
	g.subsMu.RLock()
	for _, ch := range g.subs {
		select {
		case ch <- pkt:
			sent++
		default:
		}
	}
	g.subsMu.RUnlock()
	if sent == 0 {
		g.counters.Out(pkt.PayloadSize + grpcOverhead)
	}
	return nil
}

func (g *GRPCPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	cp := bytes.Clone(payload)
	g.counters.In(len(cp) + grpcOverhead)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("grpc_%d", g.seq.Add(1)),
		SourceProto:   "grpc",
		ClientID:      "gateway_sim",
		TopicOrRoute:  FullMethod,
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: grpcOverhead,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (g *GRPCPlugin) ResetStats() {
	g.counters.Reset()
}

func (g *GRPCPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "gRPC Bidirectional Stream (HTTP/2)",
		Port:           g.port,
		Endpoint:       FullMethod + " (codec " + CodecName + ")",
		Direction:      "2 chiều",
		IsRunning:      g.running.Load(),
		HeaderOverhead: grpcOverhead,
	}
	g.counters.Fill(&st)
	return st
}
