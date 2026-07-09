# Remap FrommConnect PLC tags using known L{n}_{Machine} tag naming.
# Usage: .\scripts\remap-fromm-plc-tags.ps1

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
    throw "Cannot parse line number from '$LineName'"
}

Write-Host "=== Remap FrommConnect PLC tags ==="

$auth = Invoke-Api POST "/api/auth/login" @{ username = "admin"; password = "ChangeMe!123" }
$token = $auth.token

$plc = @(Invoke-Api GET "/api/plc/connections" -Token $token)[0]
if (-not $plc) { throw "No PLC connection found" }
Write-Host "PLC: $($plc.name) @ $($plc.endpoint) ($($plc.id))"

$tree = Invoke-Api GET "/api/hierarchy/tree" -Token $token
$mapped = 0

foreach ($dept in $tree.departments) {
    foreach ($line in $dept.lines) {
        $linePrefix = Get-LinePrefix $line.name
        foreach ($machine in $line.machines) {
            $machinePrefix = Get-PlcMachinePrefix $machine.name
            $tagBase = "${linePrefix}_${machinePrefix}"
            $paths = @{
                RunState    = @{ path = "$tagBase.Running";    dataType = "Bool" }
                GoodCount   = @{ path = "$tagBase.GoodCount";  dataType = "Dint" }
                RejectCount = @{ path = "$tagBase.BadCount";   dataType = "Dint" }
            }

            Write-Host "$($line.name) / $($machine.name) -> $tagBase.*"

            $signals = Invoke-Api GET "/api/tags/signals?machineId=$($machine.id)" -Token $token
            foreach ($sig in $signals) {
                if (-not $paths.ContainsKey($sig.role)) { continue }
                $p = $paths[$sig.role]

                # Clear stale mapping if path differs
                if ($sig.isMapped -and $sig.mappedPath -and $sig.mappedPath -ne $p.path) {
                    try { Invoke-Api DELETE "/api/tags/map/$($sig.id)" -Token $token | Out-Null } catch { }
                }

                $result = Invoke-Api POST "/api/tags/map" @{
                    logicalSignalId = $sig.id
                    tagPath = $p.path
                    plcConnectionId = $plc.id
                    dataType = $p.dataType
                } -Token $token
                if ($result.warning) { Write-Host "  WARN $($sig.role): $($result.warning)" }

                if ($sig.role -eq "RunState" -and $p.dataType -eq "Bool") {
                    Invoke-Api PUT "/api/tags/signals/$($sig.id)/run-state-ingest-mode" @{
                        runStateIngestMode = "SingleBool"
                    } -Token $token | Out-Null
                }

                Write-Host "  $($sig.role) -> $($p.path)"
            }
            $mapped++
        }
    }
}

Write-Host "Remapped $mapped machines. Waiting for driver reload..."
Start-Sleep -Seconds 10

$deadline = (Get-Date).AddSeconds(60)
do {
    $status = @(Invoke-Api GET "/api/plc/status" -Token $token) | Where-Object { $_.connectionId -eq $plc.id } | Select-Object -First 1
    Write-Host "  PLC state=$($status.state) machines=$($status.machineCount) detail=$($status.statusDetail)"
    if ($status.state -eq "Connected") { break }
    Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)

Write-Host "=== Live snapshot sample (Line 1) ==="
$live = Invoke-Api GET "/api/live" -Token $token
$line1 = $live | Where-Object { $_.lineName -eq "Line 1" }
$line1 | Select-Object machineName, state, connectionState, goodCount, rejectCount | Format-Table -AutoSize

if ($status.state -ne "Connected") {
    Write-Warning "PLC not Connected yet - check driver logs or tag paths."
    exit 1
}

Write-Host "Done."
