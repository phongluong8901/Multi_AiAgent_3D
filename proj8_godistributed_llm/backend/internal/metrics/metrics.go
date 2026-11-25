package metrics

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
)

// GatewayMetrics thu thập số liệu vận hành theo chuẩn Prometheus exposition (text/plain; version=0.0.4)
// mà không cần kéo thêm dependency ngoài.
type GatewayMetrics struct {
	activeStreams atomic.Int64
	droppedTokens atomic.Uint64

	mu                   sync.Mutex
	requests             map[string]uint64 // key: endpoint|status
	tokensByTarget       map[string]uint64 // key: model|worker_id
	promptTokensByTarget map[string]uint64 // key: model|worker_id
	ttftSumMs            map[string]uint64 // key: model
	ttftCount            map[string]uint64 // key: model
	genDurSumMs          map[string]uint64 // key: model
	genDurCount          map[string]uint64 // key: model
	queueWaitSumMs       map[string]uint64 // key: model
	queueWaitCount       map[string]uint64 // key: model
}

// NewGatewayMetrics khởi tạo các map và atomic counter lưu số liệu vận hành của Gateway.
func NewGatewayMetrics() *GatewayMetrics {
	return &GatewayMetrics{
		requests:             make(map[string]uint64),
		tokensByTarget:       make(map[string]uint64),
		promptTokensByTarget: make(map[string]uint64),
		ttftSumMs:            make(map[string]uint64),
		ttftCount:            make(map[string]uint64),
		genDurSumMs:          make(map[string]uint64),
		genDurCount:          make(map[string]uint64),
		queueWaitSumMs:       make(map[string]uint64),
		queueWaitCount:       make(map[string]uint64),
	}
}

// --- Cụm cập nhật Counters & Gauges (thread-safe) ---

// IncActiveStreams tăng số lượng kết nối SSE đang mở thêm 1.
func (m *GatewayMetrics) IncActiveStreams() {
	m.activeStreams.Add(1)
}

// DecActiveStreams giảm số lượng kết nối SSE đang mở đi 1 khi request đóng.
func (m *GatewayMetrics) DecActiveStreams() {
	m.activeStreams.Add(-1)
}

// IncDroppedTokens ghi nhận 1 chunk token bị drop vì phía SSE client tiêu thụ quá chậm.
func (m *GatewayMetrics) IncDroppedTokens() {
	m.droppedTokens.Add(1)
}

// RecordRequest cộng dồn tổng request theo endpoint và HTTP status code.
func (m *GatewayMetrics) RecordRequest(endpoint string, status int) {
	key := fmt.Sprintf("%s|%d", endpoint, status)
	m.mu.Lock()
	m.requests[key]++
	m.mu.Unlock()
}

// RecordQueueWait cộng dồn độ trễ chờ hàng đợi + TTFT (ms) theo từng model.
func (m *GatewayMetrics) RecordQueueWait(model string, waitMs int64) {
	if waitMs < 0 {
		waitMs = 0
	}
	m.mu.Lock()
	m.queueWaitSumMs[model] += uint64(waitMs)
	m.queueWaitCount[model]++
	m.mu.Unlock()
}

// RecordGeneration ghi nhận thống kê hoàn tất 1 job sinh văn bản (tokens, TTFT, tổng thời gian).
func (m *GatewayMetrics) RecordGeneration(model string, workerID string, promptTokens int, completionTokens int, ttftMs int64, durationMs int64) {
	if workerID == "" {
		workerID = "unknown"
	}
	targetKey := fmt.Sprintf("%s|%s", model, workerID)

	m.mu.Lock()
	defer m.mu.Unlock()

	if completionTokens > 0 {
		m.tokensByTarget[targetKey] += uint64(completionTokens)
	}
	if promptTokens > 0 {
		m.promptTokensByTarget[targetKey] += uint64(promptTokens)
	}
	if ttftMs >= 0 {
		m.ttftSumMs[model] += uint64(ttftMs)
		m.ttftCount[model]++
	}
	if durationMs >= 0 {
		m.genDurSumMs[model] += uint64(durationMs)
		m.genDurCount[model]++
	}
}

// RenderPrometheus xuất toàn bộ metrics theo format chuẩn cho Prometheus / Grafana scrape tại GET /metrics.
func (m *GatewayMetrics) RenderPrometheus() string {
	var b strings.Builder

	b.WriteString("# HELP llm_gateway_active_streams Number of active client streaming requests\n")
	b.WriteString("# TYPE llm_gateway_active_streams gauge\n")
	fmt.Fprintf(&b, "llm_gateway_active_streams %d\n", m.activeStreams.Load())

	b.WriteString("# HELP llm_gateway_dropped_tokens_total Total token chunks dropped due to slow SSE consumers\n")
	b.WriteString("# TYPE llm_gateway_dropped_tokens_total counter\n")
	fmt.Fprintf(&b, "llm_gateway_dropped_tokens_total %d\n", m.droppedTokens.Load())

	m.mu.Lock()
	defer m.mu.Unlock()

	b.WriteString("# HELP llm_gateway_requests_total Total HTTP chat requests processed\n")
	b.WriteString("# TYPE llm_gateway_requests_total counter\n")
	for _, k := range sortedKeys(m.requests) {
		parts := strings.SplitN(k, "|", 2)
		fmt.Fprintf(&b, "llm_gateway_requests_total{endpoint=%q,status=%q} %d\n", parts[0], parts[1], m.requests[k])
	}

	b.WriteString("# HELP llm_gateway_tokens_total Total completion tokens streamed to clients\n")
	b.WriteString("# TYPE llm_gateway_tokens_total counter\n")
	for _, k := range sortedKeys(m.tokensByTarget) {
		parts := strings.SplitN(k, "|", 2)
		fmt.Fprintf(&b, "llm_gateway_tokens_total{model=%q,worker_id=%q} %d\n", parts[0], parts[1], m.tokensByTarget[k])
	}

	b.WriteString("# HELP llm_gateway_prompt_tokens_total Total prompt tokens evaluated by workers\n")
	b.WriteString("# TYPE llm_gateway_prompt_tokens_total counter\n")
	for _, k := range sortedKeys(m.promptTokensByTarget) {
		parts := strings.SplitN(k, "|", 2)
		fmt.Fprintf(&b, "llm_gateway_prompt_tokens_total{model=%q,worker_id=%q} %d\n", parts[0], parts[1], m.promptTokensByTarget[k])
	}

	b.WriteString("# HELP llm_gateway_ttft_ms_sum Sum of Time-To-First-Token in milliseconds\n")
	b.WriteString("# TYPE llm_gateway_ttft_ms_sum counter\n")
	for _, k := range sortedKeys(m.ttftSumMs) {
		fmt.Fprintf(&b, "llm_gateway_ttft_ms_sum{model=%q} %d\n", k, m.ttftSumMs[k])
	}

	b.WriteString("# HELP llm_gateway_ttft_ms_count Number of TTFT observations\n")
	b.WriteString("# TYPE llm_gateway_ttft_ms_count counter\n")
	for _, k := range sortedKeys(m.ttftCount) {
		fmt.Fprintf(&b, "llm_gateway_ttft_ms_count{model=%q} %d\n", k, m.ttftCount[k])
	}

	b.WriteString("# HELP llm_gateway_generation_duration_ms_sum Sum of full generation duration in milliseconds\n")
	b.WriteString("# TYPE llm_gateway_generation_duration_ms_sum counter\n")
	for _, k := range sortedKeys(m.genDurSumMs) {
		fmt.Fprintf(&b, "llm_gateway_generation_duration_ms_sum{model=%q} %d\n", k, m.genDurSumMs[k])
	}

	b.WriteString("# HELP llm_gateway_generation_duration_ms_count Number of completed generations\n")
	b.WriteString("# TYPE llm_gateway_generation_duration_ms_count counter\n")
	for _, k := range sortedKeys(m.genDurCount) {
		fmt.Fprintf(&b, "llm_gateway_generation_duration_ms_count{model=%q} %d\n", k, m.genDurCount[k])
	}

	b.WriteString("# HELP llm_gateway_queue_wait_ms_sum Sum of queue wait + first-token latency in milliseconds\n")
	b.WriteString("# TYPE llm_gateway_queue_wait_ms_sum counter\n")
	for _, k := range sortedKeys(m.queueWaitSumMs) {
		fmt.Fprintf(&b, "llm_gateway_queue_wait_ms_sum{model=%q} %d\n", k, m.queueWaitSumMs[k])
	}

	b.WriteString("# HELP llm_gateway_queue_wait_ms_count Number of queue wait observations\n")
	b.WriteString("# TYPE llm_gateway_queue_wait_ms_count counter\n")
	for _, k := range sortedKeys(m.queueWaitCount) {
		fmt.Fprintf(&b, "llm_gateway_queue_wait_ms_count{model=%q} %d\n", k, m.queueWaitCount[k])
	}

	return b.String()
}

// sortedKeys sắp xếp key của map theo thứ tự chữ cái để output Prometheus /metrics ổn định (deterministic).
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

