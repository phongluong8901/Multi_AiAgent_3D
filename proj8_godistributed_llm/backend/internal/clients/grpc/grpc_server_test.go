package grpcclient

import (
	"context"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type fakeServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (f *fakeServerStream) Context() context.Context { return f.ctx }

func TestNewInternalAuthStreamInterceptor(t *testing.T) {
	interceptor := NewInternalAuthStreamInterceptor("secret-internal-key")
	okHandler := func(any, grpc.ServerStream) error { return nil }

	// 1. Missing token -> Unauthenticated
	err := interceptor(nil, &fakeServerStream{ctx: context.Background()}, nil, okHandler)
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated without token, got %v", err)
	}

	// 2. Wrong token -> Unauthenticated
	wrongCtx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-internal-token", "wrong"))
	err = interceptor(nil, &fakeServerStream{ctx: wrongCtx}, nil, okHandler)
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated with wrong token, got %v", err)
	}

	// 3. Valid token -> nil
	okCtx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-internal-token", "secret-internal-key"))
	if err := interceptor(nil, &fakeServerStream{ctx: okCtx}, nil, okHandler); err != nil {
		t.Fatalf("expected valid token to succeed, got %v", err)
	}
}

