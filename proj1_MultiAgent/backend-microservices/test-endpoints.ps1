$baseUrl = "http://localhost:4000"

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "   TESTING VIRTUAL OFFICE BACKEND MICROSERVICES " -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

# 0. Gateway Healthcheck
Write-Host "0. Testing Gateway Healthcheck..." -NoNewline
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/" -Method Get
    Write-Host " [SUCCESS]" -ForegroundColor Green
    Write-Host "   -> $($res.message)" -ForegroundColor Gray
} catch {
    Write-Host " [FAILED]: $_" -ForegroundColor Red
}

# 1. User Register
Write-Host "`n1. Testing User Service (Register)..." -NoNewline
$email = "test_user_$(Get-Random)@example.com"
$registerBody = @{
    username = "testuser"
    email = $email
    password = "Password123@"
    role = "admin"
} | ConvertTo-Json

try {
    $resUser = Invoke-RestMethod -Uri "$baseUrl/api/v1/users/register" -Method Post -Body $registerBody -ContentType "application/json"
    Write-Host " [SUCCESS]" -ForegroundColor Green
    Write-Host "   -> Created User ID: $($resUser.data._id), Email: $($resUser.data.email)" -ForegroundColor Gray
} catch {
    Write-Host " [FAILED]: $_" -ForegroundColor Red
}

# 2. User Login
Write-Host "`n2. Testing User Service (Login)..." -NoNewline
$loginBody = @{
    email = $email
    password = "Password123@"
} | ConvertTo-Json

try {
    $resLogin = Invoke-RestMethod -Uri "$baseUrl/api/v1/users/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host " [SUCCESS]" -ForegroundColor Green
    Write-Host "   -> JWT Token received (length $($resLogin.data.token.Length))" -ForegroundColor Gray
} catch {
    Write-Host " [FAILED]: $_" -ForegroundColor Red
}

# 3. Room Service Create Room
Write-Host "`n3. Testing Room Service (Create Room)..." -NoNewline
$roomBody = @{
    name = "Office Hall $(Get-Random)"
    description = "3D Virtual Meeting Space"
    maxCapacity = 10
} | ConvertTo-Json

try {
    $resRoom = Invoke-RestMethod -Uri "$baseUrl/api/v1/rooms" -Method Post -Body $roomBody -ContentType "application/json"
    Write-Host " [SUCCESS]" -ForegroundColor Green
    $roomId = $resRoom.data._id
    Write-Host "   -> Created Room ID: $roomId, Name: $($resRoom.data.name)" -ForegroundColor Gray
} catch {
    Write-Host " [FAILED]: $_" -ForegroundColor Red
}

# 4. Chat Service History
Write-Host "`n4. Testing Chat Service (Get Room History)..." -NoNewline
try {
    $resChat = Invoke-RestMethod -Uri "$baseUrl/api/v1/chats/history/$roomId" -Method Get
    Write-Host " [SUCCESS]" -ForegroundColor Green
    Write-Host "   -> Messages count for room $roomId : $($resChat.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host " [FAILED]: $_" -ForegroundColor Red
}

# 5. Agent Service (Tools, Prompts, Agents)
Write-Host "`n5. Testing Agent Service (FastAPI Tools & Agents)..." -NoNewline
$toolId = "calc_$(Get-Random)"
$toolBody = @{
    id = $toolId
    name = "Calculator"
    description = "Basic math helper"
} | ConvertTo-Json

try {
    $resTool = Invoke-RestMethod -Uri "$baseUrl/api/v1/tools" -Method Post -Body $toolBody -ContentType "application/json"
    Write-Host " [SUCCESS]" -ForegroundColor Green
    Write-Host "   -> Created Tool ID: $($resTool.id)" -ForegroundColor Gray
} catch {
    Write-Host " [FAILED]: $_" -ForegroundColor Red
}

Write-Host "`n6. Listing Agents..." -NoNewline
try {
    $resAgents = Invoke-RestMethod -Uri "$baseUrl/api/v1/agents" -Method Get
    Write-Host " [SUCCESS]" -ForegroundColor Green
    Write-Host "   -> Total Agents in DB: $($resAgents.Count)" -ForegroundColor Gray
} catch {
    Write-Host " [FAILED]: $_" -ForegroundColor Red
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "   ALL TESTS EXECUTED COMPLETED!" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan
