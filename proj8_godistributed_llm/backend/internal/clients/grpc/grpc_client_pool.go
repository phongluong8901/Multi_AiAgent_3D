package grpcclient

import (
	"context"
	"fmt"
	"sync"

	pb "go-distributed-llm/api/proto"
	"go-distributed-llm/internal/models"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// GrpcClientPool quản lý cache các kết nối gRPC (*grpc.ClientConn) theo địa chỉ IP:Port của từng Gateway.
type GrpcClientPool struct {
	mu    sync.Mutex
	conns sync.Map // map[string]*grpc.ClientConn
}

func NewGrpcClientPool() *GrpcClientPool {
	return &GrpcClientPool{}
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

	conn, err := grpc.NewClient(targetAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
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
				JobId:    chunk.JobID,
				WorkerId: chunk.WorkerID,
				Token:    chunk.Token,
				IsFinal:  chunk.Done,
				ErrorMsg: chunk.Error,
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

