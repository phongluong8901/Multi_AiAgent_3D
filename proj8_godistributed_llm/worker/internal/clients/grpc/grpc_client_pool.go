package grpcclient

import (
	"context"
	"fmt"
	"strings"
	"sync"

	pb "go-distributed-llm/shared/api/proto"
	"go-distributed-llm/shared/models"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

// GrpcClientPool quản lý cache các kết nối gRPC (*grpc.ClientConn) theo địa chỉ từng Gateway,
// hỗ trợ tùy chọn TLS CA certificate khi Worker chạy qua mạng WAN.
type GrpcClientPool struct {
	mu       sync.Mutex
	conns    sync.Map // map[string]*grpc.ClientConn
	credsOpt grpc.DialOption
}

func NewGrpcClientPool(tlsCAPath string) (*GrpcClientPool, error) {
	trimmed := strings.TrimSpace(tlsCAPath)
	if trimmed == "" {
		return &GrpcClientPool{
			credsOpt: grpc.WithTransportCredentials(insecure.NewCredentials()),
		}, nil
	}
	creds, err := credentials.NewClientTLSFromFile(trimmed, "")
	if err != nil {
		return nil, fmt.Errorf("load grpc tls ca %s: %w", trimmed, err)
	}
	return &GrpcClientPool{
		credsOpt: grpc.WithTransportCredentials(creds),
	}, nil
}

func (p *GrpcClientPool) getConn(targetAddr string) (*grpc.ClientConn, error) {
	if val, ok := p.conns.Load(targetAddr); ok {
		return val.(*grpc.ClientConn), nil
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if val, ok := p.conns.Load(targetAddr); ok {
		return val.(*grpc.ClientConn), nil
	}

	conn, err := grpc.NewClient(targetAddr, p.credsOpt)
	if err != nil {
		return nil, fmt.Errorf("grpc dial %s: %w", targetAddr, err)
	}

	p.conns.Store(targetAddr, conn)
	return conn, nil
}

func (p *GrpcClientPool) StreamTokens(ctx context.Context, targetGrpcAddr string, chunks <-chan models.TokenChunk) error {
	conn, err := p.getConn(targetGrpcAddr)
	if err != nil {
		return err
	}

	client := pb.NewTokenStreamerClient(conn)
	stream, err := client.PushTokens(ctx)
	if err != nil {
		return fmt.Errorf("open gRPC PushTokens stream: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			_ = stream.CloseSend()
			return ctx.Err()
		case chunk, ok := <-chunks:
			if !ok {
				resp, closeErr := stream.CloseAndRecv()
				if closeErr != nil {
					return closeErr
				}
				if resp != nil && !resp.Acknowledged {
					return fmt.Errorf("gateway did not acknowledge token stream")
				}
				return nil
			}

			if err := stream.Send(&pb.TokenChunkRequest{
				JobId:            chunk.JobID,
				WorkerId:         chunk.WorkerID,
				Token:            chunk.Token,
				IsFinal:          chunk.Done,
				ErrorMsg:         chunk.Error,
				PromptTokens:     int32(chunk.PromptTokens),
				CompletionTokens: int32(chunk.CompletionTokens),
				TokenUnits:       int32(chunk.TokenUnits),
			}); err != nil {
				return fmt.Errorf("gRPC stream send failed: %w", err)
			}
		}
	}
}

func (p *GrpcClientPool) Close() {
	p.conns.Range(func(key, value any) bool {
		if conn, ok := value.(*grpc.ClientConn); ok {
			_ = conn.Close()
		}
		p.conns.Delete(key)
		return true
	})
}

