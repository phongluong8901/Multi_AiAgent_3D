package grpcclient

import (
	"context"
	"fmt"
	"strings"
	"sync"

	pb "go-distributed-llm/shared/api/proto"
	"go-distributed-llm/shared/models"
	"go-distributed-llm/shared/pkg/auth"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

// GrpcClientPool quản lý cache các kết nối gRPC (*grpc.ClientConn) theo địa chỉ từng Gateway,
// hỗ trợ tùy chọn TLS CA certificate và shared secret x-internal-token.
type GrpcClientPool struct {
	mu            sync.Mutex
	conns         sync.Map // map[string]*grpc.ClientConn
	credsOpt      grpc.DialOption
	internalToken string
}

// NewGrpcClientPool khởi tạo pool giữ kết nối gRPC tái sử dụng tới các Gateway (có TLS CA & Internal Token tùy chọn).
func NewGrpcClientPool(tlsCAPath string, internalToken string) (*GrpcClientPool, error) {
	trimmed := strings.TrimSpace(tlsCAPath)
	token := strings.TrimSpace(internalToken)
	if trimmed == "" {
		return &GrpcClientPool{
			credsOpt:      grpc.WithTransportCredentials(insecure.NewCredentials()),
			internalToken: token,
		}, nil
	}
	creds, err := credentials.NewClientTLSFromFile(trimmed, "")
	if err != nil {
		return nil, fmt.Errorf("load grpc tls ca %s: %w", trimmed, err)
	}
	return &GrpcClientPool{
		credsOpt:      grpc.WithTransportCredentials(creds),
		internalToken: token,
	}, nil
}

// getConn trả về kết nối gRPC đã cache theo targetAddr hoặc dial mới theo double-check locking.
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

// StreamTokens mở gRPC stream PushTokens, đính kèm x-internal-token metadata và đẩy liên tục các TokenChunk về Gateway.
func (p *GrpcClientPool) StreamTokens(ctx context.Context, targetGrpcAddr string, chunks <-chan models.TokenChunk) error {
	conn, err := p.getConn(targetGrpcAddr)
	if err != nil {
		return err
	}

	client := pb.NewTokenStreamerClient(conn)
	if p.internalToken != "" {
		ctx = metadata.AppendToOutgoingContext(ctx, auth.InternalTokenGRPCKey, p.internalToken)
	}
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

// Close đóng toàn bộ kết nối gRPC trong pool khi Worker tắt.
func (p *GrpcClientPool) Close() {
	p.conns.Range(func(key, value any) bool {
		if conn, ok := value.(*grpc.ClientConn); ok {
			_ = conn.Close()
		}
		p.conns.Delete(key)
		return true
	})
}

