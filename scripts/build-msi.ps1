# Builds a ConnectOEE release folder and packages it as a zip-based installer bundle.
# For full MSI/WiX packaging, install WiX Toolset and extend this script with candle/light.
#
# Usage: ./scripts/build-msi.ps1 [-SelfContained]

param(
    [switch]$SelfContained
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

& (Join-Path $PSScriptRoot 'build-release.ps1') @PSBoundParameters

$publish = Join-Path $root 'publish'
$version = '1.0.0'
$bundle = Join-Path $root "ConnectOEE-$version-win-x64.zip"

if (Test-Path $bundle) { Remove-Item -Force $bundle }
Compress-Archive -Path (Join-Path $publish '*') -DestinationPath $bundle

Write-Host "==> Installer bundle: $bundle" -ForegroundColor Green
Write-Host 'Extract to C:\ConnectOEE and run install-service.ps1 as Administrator.' -ForegroundColor Cyan
