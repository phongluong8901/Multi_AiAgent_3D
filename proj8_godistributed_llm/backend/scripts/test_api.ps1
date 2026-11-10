param(
    [string]$BaseUrl = "http://127.0.0.1:8088",
    [string]$Model = "qwen2.5:1.5b",
    [string]$Prompt = "Giai thich ngan gon Go goroutine trong 2 cau"
)

$ErrorActionPreference = "Stop"
$convId = "conv-" + ([guid]::NewGuid().ToString().Substring(0, 8))

Write-Host "[1/6] Checking Gateway /healthz ($BaseUrl)..."
try {
    $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/healthz"
    Write-Host ($health | ConvertTo-Json -Compress)
} catch {
    Write-Error "Khong ket noi duoc toi Gateway tai $BaseUrl. Hay chay: go run cmd/gateway/main.go -config configs/gateway.yaml"
    exit 1
}

Write-Host "`n[2/6] Listing online Worker nodes (/api/v1/admin/nodes)..."
$nodes = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v1/admin/nodes"
Write-Host ($nodes | ConvertTo-Json -Depth 4)

Write-Host "`n[3/6] Checking Redis queue backlog (/api/v1/admin/queues)..."
$queues = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v1/admin/queues?models=$Model,llama3.2:3b"
Write-Host ($queues | ConvertTo-Json -Depth 3)

Write-Host "`n[4/6] Testing synchronous REST chat (POST /api/v1/chat)..."
$chatBody = @{
    user_id         = "test-user"
    conversation_id = $convId
    model           = $Model
    prompt          = $Prompt
} | ConvertTo-Json -Compress

$syncResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/chat" -ContentType "application/json; charset=utf-8" -Body $chatBody
Write-Host ($syncResp | ConvertTo-Json -Depth 3)

Write-Host "`n[5/6] Testing chat history (GET /api/v1/chat/$convId/history)..."
$hist = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v1/chat/$convId/history"
Write-Host ($hist | ConvertTo-Json -Depth 4)

Write-Host "`n[6/6] Testing SSE streaming (POST /api/v1/chat/stream)..."
$sseBody = @{
    user_id         = "test-user"
    conversation_id = $convId
    model           = $Model
    prompt          = "Viet 1 ham hello world bang Go"
} | ConvertTo-Json -Compress

$sseBody | curl.exe -N -sS -X POST "$BaseUrl/api/v1/chat/stream" -H "Content-Type: application/json" --data-binary "@-"
Write-Host "`n[DONE] Hoan tat test tat ca API."
