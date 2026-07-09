# Builds a single-port production release of ConnectOEE:
#   1. Builds the React SPA (Vite) and stages it into the API's wwwroot
#   2. Publishes the .NET API (which serves the API, SignalR hub, and the SPA on one port)
#
# Output: ./publish  (run ConnectOEE.Api.exe, or install as a Windows Service with install-service.ps1)
#
# Usage:
#   ./scripts/build-release.ps1                 # framework-dependent (needs .NET 8 runtime on host)
#   ./scripts/build-release.ps1 -SelfContained  # bundles the runtime (no host .NET needed)

param(
    [string]$Runtime = 'win-x64',
    [switch]$SelfContained,
    [string]$Output = 'publish'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$api = Join-Path $root 'src/ConnectOEE.Api'
$wwwroot = Join-Path $api 'wwwroot'
$frontend = Join-Path $root 'frontend'

Write-Host '==> Building frontend (Vite)...' -ForegroundColor Cyan
Push-Location $frontend
if (Test-Path 'package-lock.json') { npm ci } else { npm install }
npm run build
Pop-Location

Write-Host '==> Staging SPA into API wwwroot...' -ForegroundColor Cyan
if (Test-Path $wwwroot) { Remove-Item -Recurse -Force $wwwroot }
New-Item -ItemType Directory -Force -Path $wwwroot | Out-Null
Copy-Item -Recurse -Force (Join-Path $frontend 'dist/*') $wwwroot

Write-Host "==> Publishing API ($Runtime, self-contained=$($SelfContained.IsPresent))..." -ForegroundColor Cyan
$outDir = Join-Path $root $Output
if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }

$publishArgs = @(
    'publish', $api,
    '-c', 'Release',
    '-r', $Runtime,
    '--self-contained', $(if ($SelfContained) { 'true' } else { 'false' }),
    '-o', $outDir,
    '-p:UseAppHost=true'
)
dotnet @publishArgs

Write-Host ''
Write-Host "Release ready: $outDir" -ForegroundColor Green
Write-Host 'Run locally:   ' -NoNewline; Write-Host "$outDir\ConnectOEE.Api.exe --urls http://0.0.0.0:8080" -ForegroundColor Yellow
Write-Host 'Install svc:   ' -NoNewline; Write-Host './scripts/install-service.ps1 -BinPath "<full path>\ConnectOEE.Api.exe"' -ForegroundColor Yellow
