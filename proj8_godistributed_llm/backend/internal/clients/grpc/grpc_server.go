package grpcclient

import (
	"io"
	"strings"

	"go-distributed-llm/internal/services"
	pb "go-distributed-llm/shared/api/proto"
	"go-distributed-llm/shared/models"
	"go-distributed-llm/shared/pkg/auth"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// NewInternalAuthStreamInterceptor xác thực shared secret từ Worker trên kênh gRPC PushTokens.
func NewInternalAuthStreamInterceptor(expectedToken string) grpc.StreamServerInterceptor {
	trimmedExpected := strings.TrimSpace(expectedToken)
	return func(srv any, ss grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		if trimmedExpected == "" {
			return handler(srv, ss)
		}
		var provided string
		if md, ok := metadata.FromIncomingContext(ss.Context()); ok {
			vals := md.Get(auth.InternalTokenGRPCKey)
			if len(vals) > 0 {
				provided = vals[0]
			}
		}
		if !auth.VerifyInternalToken(trimmedExpected, provided) {
			return status.Error(codes.Unauthenticated, "invalid or missing internal token")
		}
		return handler(srv, ss)
	}
}

// GrpcTokenServer chạy trên API Gateway, lắng nghe gRPC Client-side Stream từ các Worker
// và chuyển thẳng từng TokenChunk vào SSEHub của User tương ứng.
type GrpcTokenServer struct {
	pb.UnimplementedTokenStreamerServer
	sseHub *services.SSEHub
}

// NewGrpcTokenServer khởi tạo gRPC server nhận luồng token từ các Worker và bơm vào SSEHub.
func NewGrpcTokenServer(hub *services.SSEHub) *GrpcTokenServer {
	return &GrpcTokenServer{sseHub: hub}
}

// PushTokens nhận client-side stream TokenRequest từ Worker rồi chuyển tiếp vào channel của job tương ứng.
func (s *GrpcTokenServer) PushTokens(stream pb.TokenStreamer_PushTokensServer) error {
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			return stream.SendAndClose(&pb.StreamSummaryResponse{Acknowledged: true})
		}
		if err != nil {
			return err
		}

		s.sseHub.PushToUser(models.TokenChunk{
			JobID:            req.JobId,
			WorkerID:         req.WorkerId,
			Token:            req.Token,
			Done:             req.IsFinal,
			Error:            req.ErrorMsg,
			PromptTokens:     int(req.PromptTokens),
			CompletionTokens: int(req.CompletionTokens),
			TokenUnits:       int(req.TokenUnits),
		})
	}
}

