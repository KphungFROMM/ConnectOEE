# Removes the ConnectOEE Windows Service. Run from an elevated (Administrator) PowerShell.
#
# Usage: ./scripts/uninstall-service.ps1

param(
    [string]$ServiceName = 'ConnectOEE'
)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'This script must be run as Administrator.'
}

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Host "Service '$ServiceName' is not installed." -ForegroundColor Yellow
    return
}

if ($svc.Status -ne 'Stopped') {
    Write-Host "Stopping '$ServiceName'..." -ForegroundColor Yellow
    Stop-Service $ServiceName -Force
}

sc.exe delete $ServiceName | Out-Null
Write-Host "Service '$ServiceName' removed." -ForegroundColor Green
