# Installs ConnectOEE as a Windows Service. Run from an elevated (Administrator) PowerShell.
#
# Usage (HTTPS — recommended for factory floor):
#   ./scripts/install-service.ps1 -BinPath "C:\ConnectOEE\publish\ConnectOEE.Api.exe" `
#       -Url "https://0.0.0.0:443" `
#       -CertificatePath "C:\ConnectOEE\certs\connectoee.pfx" `
#       -CertificatePassword "..." `
#       -ConnectionString "Host=localhost;Port=5432;Database=connectoee;Username=connectoee;Password=...;SSL Mode=Prefer"
#
# Usage (HTTP — dev/pilot behind reverse proxy only):
#   ./scripts/install-service.ps1 -BinPath "C:\ConnectOEE\publish\ConnectOEE.Api.exe" `
#       -Url "http://0.0.0.0:8080"
#
# The API hosts the SPA, REST API and SignalR hub on the single -Url port and runs DB
# migrations automatically on startup (see Program.cs).
# See docs/16-factory-deployment-security.md for network hardening and compensating controls.

param(
    [Parameter(Mandatory = $true)][string]$BinPath,
    [string]$ServiceName = 'ConnectOEE',
    [string]$DisplayName = 'ConnectOEE Accelerator',
    [string]$Url = 'https://0.0.0.0:443',
    [string]$ConnectionString,
    [string]$CertificatePath,
    [string]$CertificatePassword,
    [string]$JwtSigningKey,
    [string]$BackupEncryptionKey
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $BinPath)) { throw "BinPath not found: $BinPath. Run build-release.ps1 first." }

# Ensure we are elevated.
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'This script must be run as Administrator.'
}

# The service passes --urls to Kestrel so the port is fixed at install time.
$binLine = "`"$BinPath`" --urls $Url"

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping and removing existing service '$ServiceName'..." -ForegroundColor Yellow
    if ($existing.Status -ne 'Stopped') { Stop-Service $ServiceName -Force }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

Write-Host "Creating service '$ServiceName'..." -ForegroundColor Cyan
New-Service -Name $ServiceName -BinaryPathName $binLine -DisplayName $DisplayName -StartupType Automatic `
    -Description 'On-prem OEE Accelerator (API + SPA + SignalR on a single port).' | Out-Null

if ($ConnectionString) {
    [Environment]::SetEnvironmentVariable('CONNECTOEE_CONNECTION', $ConnectionString, 'Machine')
    Write-Host 'Set CONNECTOEE_CONNECTION (machine scope).' -ForegroundColor Green
}

if ($CertificatePath) {
    [Environment]::SetEnvironmentVariable('Security__CertificatePath', $CertificatePath, 'Machine')
    Write-Host 'Set Security__CertificatePath (machine scope).' -ForegroundColor Green
}
if ($CertificatePassword) {
    [Environment]::SetEnvironmentVariable('Security__CertificatePassword', $CertificatePassword, 'Machine')
    Write-Host 'Set Security__CertificatePassword (machine scope).' -ForegroundColor Green
}
if ($JwtSigningKey) {
    [Environment]::SetEnvironmentVariable('Jwt__SigningKey', $JwtSigningKey, 'Machine')
    Write-Host 'Set Jwt__SigningKey (machine scope).' -ForegroundColor Green
}
if ($BackupEncryptionKey) {
    [Environment]::SetEnvironmentVariable('Security__BackupEncryptionKey', $BackupEncryptionKey, 'Machine')
    Write-Host 'Set Security__BackupEncryptionKey (machine scope).' -ForegroundColor Green
}

# Production: require HTTPS unless explicitly using http URL.
if ($Url -like 'http://*') {
    Write-Host 'WARNING: Service installed on HTTP. Use HTTPS or terminate TLS at IIS/nginx for factory deployment.' -ForegroundColor Yellow
}

# Restart automatically on failure (1s, 5s, then every 60s).
sc.exe failure $ServiceName reset= 86400 actions= restart/1000/restart/5000/restart/60000 | Out-Null

Write-Host "Starting service '$ServiceName'..." -ForegroundColor Cyan
Start-Service $ServiceName
Get-Service $ServiceName | Format-Table -AutoSize

Write-Host ''
Write-Host "ConnectOEE is installed and running at $Url" -ForegroundColor Green
Write-Host 'Next: change default passwords, enable Admin MFA, review Admin > System > Security commissioning.' -ForegroundColor Cyan
