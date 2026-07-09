# Fromm 3-line plant commissioning — Rockwell PLC at 10.0.0.49
# Usage: .\scripts\fromm-3line-commission.ps1

$ErrorActionPreference = "Stop"
$base = "http://localhost:5080"

function Invoke-Api {
    param([string]$Method, [string]$Path, [object]$Body = $null, [string]$Token = $null)
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{ Method = $Method; Uri = "$base$Path"; Headers = $headers }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 8) }
    return Invoke-RestMethod @params
}

function Get-AllBrowseLeaves {
    param($nodes)
    $leaves = @()
    foreach ($n in @($nodes)) {
        if ($null -eq $n) { continue }
        if ($n.bindable -eq $true -and $n.fullPath) {
            $leaves += $n
        }
        if ($n.children) {
            $leaves += Get-AllBrowseLeaves $n.children
        }
    }
    return $leaves
}

function Get-TokenWords {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
    return ($Text -split '[^a-zA-Z0-9]+' | Where-Object { $_.Length -ge 2 })
}

function Get-PlcMachinePrefix {
    param([string]$MachineName)
    switch ($MachineName) {
        "Raw Materials" { return "RawMaterial" }
        default { return ($MachineName -replace '\s+', '') }
    }
}

function Get-LinePrefix {
    param([string]$LineName)
    if ($LineName -match 'Line\s+(\d+)') { return "L$($Matches[1])" }
    return $null
}

function Get-ExplicitTagPaths {
    param([string]$LineName, [string]$MachineName)
    $linePrefix = Get-LinePrefix $LineName
    $machinePrefix = Get-PlcMachinePrefix $MachineName
    if (-not $linePrefix -or -not $machinePrefix) { return $null }
    $base = "${linePrefix}_${machinePrefix}"
    return @{
        RunState    = @{ fullPath = "$base.Running";   dataType = "Bool" }
        GoodCount   = @{ fullPath = "$base.GoodCount"; dataType = "Dint" }
        RejectCount = @{ fullPath = "$base.BadCount";  dataType = "Dint" }
    }
}

function Find-BestTag {
    param(
        [array]$Leaves,
        [string[]]$RoleKeywords,
        [string[]]$ContextTokens = @()
    )
    $best = $null
    $bestScore = 0
    foreach ($leaf in $Leaves) {
        $path = $leaf.fullPath
        $name = $leaf.name
        $hay = "$path $name"
        $score = 0
        foreach ($kw in $RoleKeywords) {
            if ($hay -match [regex]::Escape($kw)) { $score += 10 }
        }
        foreach ($tok in $ContextTokens) {
            if ($hay -match [regex]::Escape($tok)) { $score += 5 }
        }
        if ($score -gt $bestScore) {
            $bestScore = $score
            $best = $leaf
        }
    }
    if ($bestScore -lt 10) { return $null }
    return $best
}

function Wait-PlcConnected {
    param([string]$Token, [string]$ConnectionId, [int]$TimeoutSec = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $status = @(Invoke-Api GET "/api/plc/status" -Token $Token)
        $hit = $status | Where-Object { $_.connectionId -eq $ConnectionId } | Select-Object -First 1
        if ($hit -and $hit.state -eq "Connected") {
            Write-Host "  PLC driver Connected (machines=$($hit.machineCount))"
            return $true
        }
        if ($hit) {
            Write-Host "  Waiting for PLC... state=$($hit.state) detail=$($hit.statusDetail)"
        }
        Start-Sleep -Seconds 3
    }
    Write-Warning "PLC did not reach Connected within ${TimeoutSec}s"
    return $false
}

Write-Host "=== FrommConnect 3-line commissioning ==="

Write-Host "Bootstrap admin..."
$auth = Invoke-Api POST "/api/setup/bootstrap-admin" @{
    userName = "admin"
    password = "ChangeMe!123"
    displayName = "Administrator"
}
$token = $auth.token

$plantTz = (Get-TimeZone).Id
Write-Host "Create plant FrommConnect ($plantTz)..."
$plant = Invoke-Api POST "/api/plants" @{
    name = "FrommConnect"
    code = "FROMM"
    timeZoneId = $plantTz
} -Token $token

Write-Host "Create department Production..."
$dept = Invoke-Api POST "/api/hierarchy/departments" @{
    plantId = $plant.id
    name = "Production"
} -Token $token

$lineNames = @("Line 1", "Line 2", "Line 3")
$machineNames = @("Raw Materials", "Washing", "Drying")
$lines = @()
$machines = @()

foreach ($lineName in $lineNames) {
    Write-Host "Create $lineName..."
    $line = Invoke-Api POST "/api/hierarchy/lines" @{
        departmentId = $dept.id
        name = $lineName
        idealRatePerHour = 1800
        targetOeePct = 85
    } -Token $token
    $lines += $line
    foreach ($mName in $machineNames) {
        $machine = Invoke-Api POST "/api/hierarchy/machines" @{
            lineId = $line.id
            name = $mName
        } -Token $token
        $machines += [PSCustomObject]@{ machine = $machine; lineName = $lineName }
    }
}

Write-Host "Create Rockwell PLC at 10.0.0.49..."
$plc = Invoke-Api POST "/api/plc/connections" @{
    name = "Plant PLC"
    driverType = "RockwellEthernetIp"
    endpoint = "10.0.0.49"
    path = "1,0"
    pollIntervalMs = 1000
    enabled = $true
} -Token $token

Write-Host "Browse tags from Rockwell PLC..."
$browseOk = $false
$allLeaves = @()
try {
    $leavesResp = Invoke-Api GET "/api/tags/browse/leaves?connectionId=$($plc.id)" -Token $token
    $browseOk = [bool]$leavesResp.supportsBrowsing
    $allLeaves = @($leavesResp.leaves)
    Write-Host "  Browse supportsBrowsing=$browseOk leafCount=$($allLeaves.Count)"
} catch {
    try {
        $browse = Invoke-Api GET "/api/tags/browse?connectionId=$($plc.id)" -Token $token
        $browseOk = [bool]$browse.supportsBrowsing
        $allLeaves = Get-AllBrowseLeaves $browse.tags
        Write-Host "  Browse (tree) leafCount=$($allLeaves.Count)"
    } catch {
        Write-Host "  Browse failed: $($_.Exception.Message)"
    }
}

if (-not $browseOk -or $allLeaves.Count -eq 0) {
    throw "Tag browse failed or returned no bindable leaves. Fix PLC connectivity before commissioning."
}

$mappedCount = 0
$missing = @()

foreach ($entry in $machines) {
    $machine = $entry.machine
    $explicit = Get-ExplicitTagPaths $entry.lineName $machine.name
    if ($explicit) {
        $runHit = $explicit.RunState
        $goodHit = $explicit.GoodCount
        $rejectHit = $explicit.RejectCount
    } else {
        $tokens = Get-TokenWords $machine.name
        $runHit = Find-BestTag -Leaves $allLeaves -RoleKeywords @(
            "RunState", "Run_State", "MachineState", "Cycle_Active", "Running", "State"
        ) -ContextTokens $tokens
        $goodHit = Find-BestTag -Leaves $allLeaves -RoleKeywords @(
            "GoodCount", "Good_Count", "Good", "TotalGood", "ProductCount"
        ) -ContextTokens $tokens
        $rejectHit = $null

        if (-not $runHit) {
            $runHit = Find-BestTag -Leaves $allLeaves -RoleKeywords @(
                "RunState", "Run_State", "MachineState", "Cycle_Active", "Running"
            )
        }
        if (-not $goodHit) {
            $goodHit = Find-BestTag -Leaves $allLeaves -RoleKeywords @(
                "GoodCount", "Good_Count", "Good", "TotalGood"
            )
        }
    }

    if (-not $runHit -or -not $goodHit) {
        $missing += $machine.name
        Write-Warning "  No tags for $($machine.name): RunState=$($runHit.fullPath) GoodCount=$($goodHit.fullPath)"
        continue
    }

    Write-Host "  $($entry.lineName) / $($machine.name): RunState=$($runHit.fullPath) ($($runHit.dataType)) GoodCount=$($goodHit.fullPath) ($($goodHit.dataType))"

    $signals = Invoke-Api GET "/api/tags/signals?machineId=$($machine.id)" -Token $token
    foreach ($sig in $signals) {
        if ($sig.role -eq "RunState") {
            Invoke-Api POST "/api/tags/map" @{
                logicalSignalId = $sig.id
                tagPath = $runHit.fullPath
                plcConnectionId = $plc.id
                dataType = $runHit.dataType
            } -Token $token | Out-Null
            if ($runHit.dataType -eq "Bool") {
                Invoke-Api PUT "/api/tags/signals/$($sig.id)/run-state-ingest-mode" @{
                    runStateIngestMode = "SingleBool"
                } -Token $token | Out-Null
            }
        }
        if ($sig.role -eq "GoodCount") {
            Invoke-Api POST "/api/tags/map" @{
                logicalSignalId = $sig.id
                tagPath = $goodHit.fullPath
                plcConnectionId = $plc.id
                dataType = $goodHit.dataType
            } -Token $token | Out-Null
        }
        if ($sig.role -eq "RejectCount" -and $rejectHit) {
            Invoke-Api POST "/api/tags/map" @{
                logicalSignalId = $sig.id
                tagPath = $rejectHit.fullPath
                plcConnectionId = $plc.id
                dataType = $rejectHit.dataType
            } -Token $token | Out-Null
        }
    }
    $mappedCount++
}

if ($missing.Count -gt 0) {
    throw "Tag discovery failed for: $($missing -join ', '). Use Tag Browser to map manually."
}

Write-Host "Mapped required tags on $mappedCount / $($machines.Count) machines"

Write-Host "Waiting for driver re-init..."
Start-Sleep -Seconds 8
$plcOk = Wait-PlcConnected -Token $token -ConnectionId $plc.id -TimeoutSec 45

Write-Host "Create 3x8 shift pattern..."
$pattern = Invoke-Api POST "/api/shifts/patterns" @{
    name = "3x8 Fixed"
    description = "FrommConnect default"
    definitions = @(
        @{ name = "Day"; startTime = "06:00:00"; endTime = "14:00:00"; orderIndex = 0; color = "#2E9E5B" },
        @{ name = "Swing"; startTime = "14:00:00"; endTime = "22:00:00"; orderIndex = 1; color = "#E0A800" },
        @{ name = "Night"; startTime = "22:00:00"; endTime = "06:00:00"; orderIndex = 2; color = "#4C8DFF"; crossesMidnight = $true }
    )
} -Token $token

$today = (Get-Date).ToString("yyyy-MM-dd")
Invoke-Api POST "/api/shifts/assignments" @{
    shiftPatternId = $pattern.id
    plantId = $plant.id
    effectiveFrom = $today
} -Token $token | Out-Null

Write-Host "Generate dashboards..."
Start-Sleep -Seconds 2
$gen = Invoke-Api POST "/api/wizard/generate-dashboards" @{} -Token $token
Write-Host "Created $($gen.created) dashboard(s)"

$status = Invoke-Api GET "/api/wizard/status" -Token $token
Write-Host "Wizard status: step=$($status.currentStep) machines=$($status.machines) plcs=$($status.plcConnections) tags=$($status.requiredTagsMapped)"

# Post-commission validation
Write-Host "`n=== Validation ==="
$plcStatus = @(Invoke-Api GET "/api/plc/status" -Token $token)
$plcState = ($plcStatus | Where-Object { $_.connectionId -eq $plc.id } | Select-Object -First 1).state
Write-Host "PLC state: $plcState (connected=$plcOk)"

try {
    $live = Invoke-Api GET "/api/live" -Token $token
    $connected = @($live | Where-Object { $_.connectionState -eq "Connected" }).Count
    Write-Host "Live snapshots: $($live.Count) total, $connected Connected"
} catch {
    Write-Host "Live API: $($_.Exception.Message)"
}

Write-Host "`nDone. Login: admin / ChangeMe!123"
if (-not $plcOk) {
    Write-Warning "PLC not Connected — verify tag paths and CIP route (path 1,0) on 10.0.0.49"
    exit 1
}
