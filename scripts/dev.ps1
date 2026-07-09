# Starts the ConnectOEE dev stack: database, backend API, and frontend dev server.
# Run from the repo root:  ./scripts/dev.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example" -ForegroundColor Green
}

Write-Host "Starting database (docker compose up -d)..." -ForegroundColor Cyan
docker compose up -d

$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell.exe' }

Write-Host "Launching backend API on http://localhost:5080..." -ForegroundColor Cyan
Start-Process $shell -ArgumentList '-NoExit', '-Command',
    "dotnet run --project `"$root/src/ConnectOEE.Api`" --urls http://localhost:5080"

Write-Host "Launching frontend dev server on http://localhost:5173..." -ForegroundColor Cyan
Start-Process $shell -ArgumentList '-NoExit', '-Command',
    "Set-Location `"$root/frontend`"; npm run dev"

Write-Host "ConnectOEE dev stack starting. API: http://localhost:5080  UI: http://localhost:5173" -ForegroundColor Green
