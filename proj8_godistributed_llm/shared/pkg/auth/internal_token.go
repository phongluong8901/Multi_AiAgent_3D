package auth

import (
	"crypto/subtle"
	"strings"
)

const (
	// InternalTokenHeader dùng cho HTTP internal endpoints (/internal/v1/*).
	InternalTokenHeader = "X-Internal-Token"
	// InternalTokenGRPCKey dùng cho gRPC metadata khi Worker stream token về Gateway.
	InternalTokenGRPCKey = "x-internal-token"
)

// VerifyInternalToken kiểm tra secret nội bộ theo constant-time.
// Nếu expected rỗng (tắt xác thực nội bộ khi chạy dev/LAN tin cậy), luôn trả về true.
func VerifyInternalToken(expected string, provided string) bool {
	trimmedExpected := strings.TrimSpace(expected)
	if trimmedExpected == "" {
		return true
	}
	trimmedProvided := strings.TrimSpace(provided)
	return subtle.ConstantTimeCompare([]byte(trimmedProvided), []byte(trimmedExpected)) == 1
}

