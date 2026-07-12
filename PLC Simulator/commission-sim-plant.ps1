# Commission ConnectOEE against the multi-industry ConnectOEE_Sim Logix plant.
# Prerequisites: ConnectOEE API running; Studio Emulate/controller in Run with ConnectOEE_Sim downloaded.
#
# Usage:
#   .\commission-sim-plant.ps1 -PlcEndpoint "192.168.1.10"
#   .\commission-sim-plant.ps1 -PlcEndpoint "127.0.0.1" -PlcPath "1,0" -BaseUrl "http://localhost:5080"

param(
    [string]$BaseUrl = "http://localhost:5080",
    [Parameter(Mandatory = $true)]
    [string]$PlcEndpoint,
    [string]$PlcPath = "1,0",
    [string]$AdminUser = "admin",
    [string]$AdminPassword = "ChangeMe!123"
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")

function Invoke-Api {
    param([string]$Method, [string]$Path, [object]$Body = $null, [string]$Token = $null)
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{ Method = $Method; Uri = "$base$Path"; Headers = $headers }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 8) }
    return Invoke-RestMethod @params
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

function Map-Signal {
    param($Signals, [string]$Role, [string]$TagPath, [string]$DataType, [string]$PlcId, [string]$Token, [string]$RunStateMode = $null)
    $sig = $Signals | Where-Object { $_.role -eq $Role } | Select-Object -First 1
    if (-not $sig) { return $false }
    Invoke-Api POST "/api/tags/map" @{
        logicalSignalId = $sig.id
        tagPath = $TagPath
        plcConnectionId = $PlcId
        dataType = $DataType
    } -Token $Token | Out-Null
    if ($Role -eq "RunState" -and $RunStateMode) {
        Invoke-Api PUT "/api/tags/signals/$($sig.id)/run-state-ingest-mode" @{
            runStateIngestMode = $RunStateMode
        } -Token $Token | Out-Null
    }
    return $true
}

# Machine catalog: ConnectOEE names + PLC UDT tag roots
$lines = @(
    @{
        Name = "Beverage Line"
        IdealRate = 4800
        Machines = @(
            @{ Name = "Infeed";   Tag = "Bev_Infeed";   Counts = $false; Rework = $false }
            @{ Name = "Filler";   Tag = "Bev_Filler";   Counts = $true;  Rework = $false }
            @{ Name = "Capper";   Tag = "Bev_Capper";   Counts = $false; Rework = $false }
            @{ Name = "Labeler";  Tag = "Bev_Labeler";  Counts = $true;  Rework = $false }
        )
    }
    @{
        Name = "Automotive Line"
        IdealRate = 900
        Machines = @(
            @{ Name = "Weld";     Tag = "Auto_Weld";     Counts = $true; Rework = $false }
            @{ Name = "Assemble"; Tag = "Auto_Assemble"; Counts = $true; Rework = $false }
            @{ Name = "Test";     Tag = "Auto_Test";     Counts = $true; Rework = $true }
        )
    }
    @{
        Name = "Food Line"
        IdealRate = 1800
        Machines = @(
            @{ Name = "Mixer";  Tag = "Food_Mixer";  Counts = $true; Rework = $false }
            @{ Name = "Cooker"; Tag = "Food_Cooker"; Counts = $true; Rework = $false }
            @{ Name = "Packer"; Tag = "Food_Packer"; Counts = $true; Rework = $false }
        )
    }
    @{
        Name = "Molding Line"
        IdealRate = 300
        Machines = @(
            @{ Name = "Press 1"; Tag = "Mold_Press1"; Counts = $true; Rework = $false }
            @{ Name = "Press 2"; Tag = "Mold_Press2"; Counts = $true; Rework = $false }
        )
    }
    @{
        Name = "Pharma Line"
        IdealRate = 4000
        Machines = @(
            @{ Name = "Filler";    Tag = "Pharma_Filler";    Counts = $true; Rework = $false }
            @{ Name = "Inspector"; Tag = "Pharma_Inspector"; Counts = $true; Rework = $true }
            @{ Name = "Cartoner";  Tag = "Pharma_Cartoner";  Counts = $true; Rework = $false }
        )
    }
    @{
        Name = "Film Converting Line"
        IdealRate = 8000
        Machines = @(
            @{ Name = "Unwind";  Tag = "Film_Unwind";  Counts = $false; Rework = $false }
            @{ Name = "Treat";   Tag = "Film_Treat";   Counts = $false; Rework = $false }
            @{ Name = "Slitter"; Tag = "Film_Slitter"; Counts = $true;  Rework = $false }
            @{ Name = "Rewind";  Tag = "Film_Rewind";  Counts = $true;  Rework = $false }
        )
    }
    @{
        Name = "Metal Coil Line"
        IdealRate = 1800
        Machines = @(
            @{ Name = "Uncoil";  Tag = "Coil_Uncoil";  Counts = $false; Rework = $false }
            @{ Name = "Leveler"; Tag = "Coil_Leveler"; Counts = $false; Rework = $false }
            @{ Name = "Shear";   Tag = "Coil_Shear";   Counts = $true;  Rework = $false }
            @{ Name = "Recoil";  Tag = "Coil_Recoil";  Counts = $true;  Rework = $false }
        )
    }
)

Write-Host "=== ConnectOEE Sim Plant commissioning ==="
Write-Host "API: $base"
Write-Host "PLC: $PlcEndpoint path=$PlcPath"

Write-Host "Bootstrap admin..."
try {
    $auth = Invoke-Api POST "/api/setup/bootstrap-admin" @{
        userName = $AdminUser
        password = $AdminPassword
        displayName = "Administrator"
    }
} catch {
    Write-Host "  Bootstrap skipped (already initialized?); logging in..."
    $auth = Invoke-Api POST "/api/auth/login" @{
        userName = $AdminUser
        password = $AdminPassword
    }
}
$token = $auth.token
if (-not $token) { throw "No auth token — check admin credentials." }

$plantTz = (Get-TimeZone).Id
Write-Host "Create plant Connect Demo ($plantTz)..."
$plant = Invoke-Api POST "/api/plants" @{
    name = "Connect Demo Plant"
    code = "SIM"
    timeZoneId = $plantTz
} -Token $token

Write-Host "Create department Production..."
$dept = Invoke-Api POST "/api/hierarchy/departments" @{
    plantId = $plant.id
    name = "Production"
} -Token $token

Write-Host "Create Rockwell PLC connection..."
$plc = Invoke-Api POST "/api/plc/connections" @{
    name = "ConnectOEE_Sim"
    driverType = "RockwellEthernetIp"
    endpoint = $PlcEndpoint
    path = $PlcPath
    pollIntervalMs = 1000
    enabled = $true
} -Token $token

$mappedMachines = 0

foreach ($lineDef in $lines) {
    Write-Host "Create $($lineDef.Name)..."
    $line = Invoke-Api POST "/api/hierarchy/lines" @{
        departmentId = $dept.id
        name = $lineDef.Name
        idealRatePerHour = $lineDef.IdealRate
        targetOeePct = 85
    } -Token $token

    foreach ($mDef in $lineDef.Machines) {
        Write-Host "  Machine $($mDef.Name) -> $($mDef.Tag).*"
        $machine = Invoke-Api POST "/api/hierarchy/machines" @{
            lineId = $line.id
            name = $mDef.Name
        } -Token $token

        $signals = Invoke-Api GET "/api/tags/signals?machineId=$($machine.id)" -Token $token
        $tag = $mDef.Tag

        Map-Signal $signals "RunState" "$tag.RunState" "Dint" $plc.id $token -RunStateMode "DirectEnum" | Out-Null
        Map-Signal $signals "GoodCount" "$tag.Counters.Good" "Dint" $plc.id $token | Out-Null
        Map-Signal $signals "RejectCount" "$tag.Counters.Reject" "Dint" $plc.id $token | Out-Null
        Map-Signal $signals "DowntimeReason" "$tag.FaultCode" "Dint" $plc.id $token | Out-Null
        Map-Signal $signals "PartId" "$tag.PartId" "String" $plc.id $token | Out-Null
        Map-Signal $signals "RunStateRunning" "$tag.Status.Running" "Bool" $plc.id $token | Out-Null
        Map-Signal $signals "RunStateIdle" "$tag.Status.Idle" "Bool" $plc.id $token | Out-Null
        Map-Signal $signals "RunStateFaulted" "$tag.Status.Faulted" "Bool" $plc.id $token | Out-Null

        if ($mDef.Rework) {
            Map-Signal $signals "ReworkCount" "$tag.Counters.Rework" "Dint" $plc.id $token | Out-Null
        }

        # Control maps on representative machines (Operator Station write tests)
        if ($mDef.Name -in @("Filler", "Press 1", "Weld", "Slitter", "Shear")) {
            foreach ($cmd in @(
                @{ Command = "StartPermissive"; Path = "$tag.Cmd.StartPermissive" },
                @{ Command = "Ack"; Path = "$tag.Cmd.Ack" },
                @{ Command = "Reset"; Path = "$tag.Cmd.Reset" }
            )) {
                try {
                    Invoke-Api POST "/api/plc/controls" @{
                        machineId = $machine.id
                        plcConnectionId = $plc.id
                        command = $cmd.Command
                        tagPath = $cmd.Path
                        dataType = "Bool"
                    } -Token $token | Out-Null
                } catch {
                    Write-Host "    (control $($cmd.Command) skipped: $($_.Exception.Message))"
                }
            }
        }

        $mappedMachines++
    }
}

Write-Host "Waiting for driver re-init..."
Start-Sleep -Seconds 8
$plcOk = Wait-PlcConnected -Token $token -ConnectionId $plc.id -TimeoutSec 45

Write-Host "Create 3x8 shift pattern..."
$pattern = Invoke-Api POST "/api/shifts/patterns" @{
    name = "3x8 Fixed"
    description = "Connect Demo Plant default"
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

try {
    Write-Host "Generate dashboards..."
    $gen = Invoke-Api POST "/api/wizard/generate-dashboards" @{} -Token $token
    Write-Host "Created $($gen.created) dashboard(s)"
} catch {
    Write-Host "Dashboard generate skipped: $($_.Exception.Message)"
}

Write-Host "`nMapped $mappedMachines machines on plant $($plant.name)"
Write-Host "Login: $AdminUser / $AdminPassword"
Write-Host "See TAG_MAP.md for manual remapping details."
if (-not $plcOk) {
    Write-Warning "PLC not Connected — verify Emulate/controller IP ($PlcEndpoint), CIP path ($PlcPath), and that the L5X is running."
    exit 1
}
Write-Host "Done."
