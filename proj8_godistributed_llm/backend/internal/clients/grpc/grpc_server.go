package grpcclient

import (
	"io"

	"go-distributed-llm/internal/services"
	pb "go-distributed-llm/shared/api/proto"
	"go-distributed-llm/shared/models"
)

// GrpcTokenServer chạy trên API Gateway, lắng nghe gRPC Client-side Stream từ các Worker
// và chuyển thẳng từng TokenChunk vào SSEHub của User tương ứng.
type GrpcTokenServer struct {
	pb.UnimplementedTokenStreamerServer
	sseHub *services.SSEHub
}

func NewGrpcTokenServer(hub *services.SSEHub) *GrpcTokenServer {
	return &GrpcTokenServer{sseHub: hub}
}

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

