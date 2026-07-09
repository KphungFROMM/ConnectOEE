# Greenfield commissioning helper — bootstraps a single-line install via API after reset-fresh-install.ps1.
# Usage: .\scripts\greenfield-commission.ps1

$ErrorActionPreference = "Stop"
$base = "http://localhost:5080"

function Invoke-Api {
    param([string]$Method, [string]$Path, [object]$Body = $null, [string]$Token = $null)
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{ Method = $Method; Uri = "$base$Path"; Headers = $headers }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6) }
    return Invoke-RestMethod @params
}

Write-Host "Bootstrap admin..."
$auth = Invoke-Api POST "/api/setup/bootstrap-admin" @{
    userName = "admin"
    password = "ChangeMe!123"
    displayName = "Administrator"
}
$token = $auth.token
Write-Host "Admin created; commission users seeded."

Write-Host "Create plant..."
$plantTimeZone = (Get-TimeZone).Id
Write-Host "  Plant timezone: $plantTimeZone"
$plant = Invoke-Api POST "/api/plants" @{ name = "Commission Plant"; code = "CP1"; timeZoneId = $plantTimeZone } -Token $token

Write-Host "Create department..."
$dept = Invoke-Api POST "/api/hierarchy/departments" @{ plantId = $plant.id; name = "Production" } -Token $token

Write-Host "Create line..."
$line = Invoke-Api POST "/api/hierarchy/lines" @{
    departmentId = $dept.id
    name = "Line 1"
    idealRatePerHour = 1800
    targetOeePct = 85
} -Token $token

Write-Host "Create machine..."
$machine = Invoke-Api POST "/api/hierarchy/machines" @{ lineId = $line.id; name = "Filler" } -Token $token

Write-Host "Create mock PLC connection..."
$plc = Invoke-Api POST "/api/plc/connections" @{
    name = "Mock Simulator"
    driverType = "Mock"
    enabled = $true
    lineId = $line.id
} -Token $token

Write-Host "Map Run State + Good Count tags..."
$signals = Invoke-Api GET "/api/tags/signals?machineId=$($machine.id)" -Token $token
foreach ($sig in $signals) {
    if ($sig.role -eq "RunState") {
        Invoke-Api POST "/api/tags/map" @{
            logicalSignalId = $sig.id
            tagPath = "Mock.RunState"
            plcConnectionId = $plc.id
            dataType = "Int"
        } -Token $token | Out-Null
    }
    if ($sig.role -eq "GoodCount") {
        Invoke-Api POST "/api/tags/map" @{
            logicalSignalId = $sig.id
            tagPath = "Mock.GoodCount"
            plcConnectionId = $plc.id
            dataType = "Dint"
        } -Token $token | Out-Null
    }
}

Write-Host "Create shift pattern + assign to line..."
$pattern = Invoke-Api POST "/api/shifts/patterns" @{
    name = "3x8 Fixed"
    description = "Commission default"
    definitions = @(
        @{ name = "Day"; startTime = "06:00:00"; endTime = "14:00:00"; orderIndex = 0; color = "#2E9E5B" },
        @{ name = "Swing"; startTime = "14:00:00"; endTime = "22:00:00"; orderIndex = 1; color = "#E0A800" },
        @{ name = "Night"; startTime = "22:00:00"; endTime = "06:00:00"; orderIndex = 2; color = "#4C8DFF"; crossesMidnight = $true }
    )
} -Token $token
$today = (Get-Date).ToString("yyyy-MM-dd")
Invoke-Api POST "/api/shifts/assignments" @{
    shiftPatternId = $pattern.id
    lineId = $line.id
    effectiveFrom = $today
} -Token $token | Out-Null

Write-Host "Generate dashboards..."
Start-Sleep -Seconds 3
$gen = Invoke-Api POST "/api/wizard/generate-dashboards" @{} -Token $token
Write-Host "Created $($gen.created) dashboard(s)"

$comm = Invoke-Api GET "/api/system/commissioning?lineId=$($line.id)" -Token $token
Write-Host "Commissioning ready: $($comm.ready) for $($comm.lineName)"
$comm.checks | ForEach-Object { Write-Host "  [$($_.passed)] $($_.label) $(if ($_.required -eq $false) {'(optional)'} else {''})" }

Write-Host "Done. Login: admin / ChangeMe!123"
