# Patch generator: bulletproof counts + all sims in MainProgram
$ErrorActionPreference = "Stop"
$p = "C:\Users\KNPhu\OneDrive\Desktop\Projects\Connect Software Suite\ConnectOEE\PLC Simulator\tools\Generate-ConnectOEESimL5X.ps1"
$c = [System.IO.File]::ReadAllText($p)

$newSimPath = Join-Path $PSScriptRoot "_simlogic_snippet.ps1"
$newSim = @'
# Inline state-machine ST - literal scan ticks so UDT Cfg packing cannot block counts
function Get-SimLogic([string]$M) {
    @"
// --- sim $M ---
IF $M.Cmd.Ack AND NOT $M.LastAck THEN
    $M.FaultCode := 0;
    $M.Status.Faulted := 0;
    $M.RunState := 1;
    $M.StateMs := 0;
END_IF;
IF $M.Cmd.Reset AND NOT $M.LastReset THEN
    $M.FaultCode := 0;
    $M.Status.Faulted := 0;
    $M.RunState := 2;
    $M.StateMs := 0;
    $M.CycleMsAcc := 0;
END_IF;
$M.LastAck := $M.Cmd.Ack;
$M.LastReset := $M.Cmd.Reset;

IF NOT $M.Cmd.StartPermissive THEN
    $M.RunState := 2;
    $M.FaultCode := 0;
    $M.Status.Running := 0;
    $M.Status.Idle := 1;
    $M.Status.Faulted := 0;
    $M.Speed := 0.0;
ELSIF $M.ForcePlannedDown THEN
    $M.RunState := 4;
    $M.FaultCode := 250;
    $M.Status.Running := 0;
    $M.Status.Idle := 0;
    $M.Status.Faulted := 0;
    $M.Speed := 0.0;
ELSIF $M.ForceStarved THEN
    $M.RunState := 6;
    $M.FaultCode := 301;
    $M.Status.Running := 0;
    $M.Status.Idle := 0;
    $M.Status.Faulted := 0;
    $M.Speed := 0.0;
ELSIF $M.ForceBlocked THEN
    $M.RunState := 7;
    $M.FaultCode := 351;
    $M.Status.Running := 0;
    $M.Status.Idle := 0;
    $M.Status.Faulted := 0;
    $M.Speed := 0.0;
ELSE
    IF ($M.RunState = 4) OR ($M.RunState = 6) OR ($M.RunState = 7) OR ($M.RunState = 0) THEN
        $M.RunState := 1;
        $M.FaultCode := 0;
        $M.StateMs := 0;
    END_IF;

    $M.StateMs := $M.StateMs + 1;
    Plant_Rng := (Plant_Rng * 1103515245 + 12345) AND 16#7FFFFFFF;
    Plant_Roll := Plant_Rng MOD 1000;

    CASE $M.RunState OF
        1:
            $M.Status.Running := 1;
            $M.Status.Idle := 0;
            $M.Status.Faulted := 0;
            $M.FaultCode := 0;
            $M.Speed := 1000.0;
            $M.CycleMsAcc := $M.CycleMsAcc + 1;
            IF $M.CycleMsAcc >= 25 THEN
                $M.CycleMsAcc := 0;
                Plant_Rng := (Plant_Rng * 1103515245 + 12345) AND 16#7FFFFFFF;
                Plant_Roll2 := Plant_Rng MOD 100;
                IF Plant_Roll2 < 2 THEN
                    $M.Counters.Reject := $M.Counters.Reject + 1;
                    $M.Counters.Total := $M.Counters.Total + 1;
                ELSE
                    $M.Counters.Good := $M.Counters.Good + 1;
                    $M.Counters.Total := $M.Counters.Total + 1;
                END_IF;
            END_IF;
            IF $M.StateMs >= 500 THEN
                $M.StateMs := 0;
                IF Plant_Roll < 5 THEN
                    $M.RunState := 3;
                    $M.FaultCode := 101;
                ELSIF Plant_Roll < 15 THEN
                    $M.RunState := 2;
                    $M.FaultCode := 2;
                ELSIF Plant_Roll < 20 THEN
                    $M.RunState := 5;
                    $M.FaultCode := 201;
                END_IF;
            END_IF;
        2:
            $M.Status.Running := 0;
            $M.Status.Idle := 1;
            $M.Status.Faulted := 0;
            $M.Speed := 0.0;
            IF $M.StateMs >= 80 THEN
                $M.RunState := 1;
                $M.FaultCode := 0;
                $M.StateMs := 0;
            END_IF;
        3:
            $M.Status.Running := 0;
            $M.Status.Idle := 0;
            $M.Status.Faulted := 1;
            $M.Speed := 0.0;
            IF $M.StateMs >= 200 THEN
                $M.RunState := 1;
                $M.FaultCode := 0;
                $M.Status.Faulted := 0;
                $M.StateMs := 0;
            END_IF;
        4:
            $M.Status.Running := 0;
            $M.Status.Idle := 0;
            $M.Status.Faulted := 0;
            $M.Speed := 0.0;
            IF $M.StateMs >= 300 THEN
                $M.RunState := 1;
                $M.FaultCode := 0;
                $M.StateMs := 0;
            END_IF;
        5:
            $M.Status.Running := 0;
            $M.Status.Idle := 0;
            $M.Status.Faulted := 0;
            $M.Speed := 0.0;
            IF $M.StateMs >= 300 THEN
                $M.RunState := 1;
                $M.FaultCode := 0;
                $M.StateMs := 0;
            END_IF;
        6:
            $M.RunState := 1;
            $M.FaultCode := 0;
            $M.StateMs := 0;
        7:
            $M.RunState := 1;
            $M.FaultCode := 0;
            $M.StateMs := 0;
        ELSE
            $M.RunState := 1;
            $M.StateMs := 0;
    END_CASE;
END_IF;
"@
}

'@

$c2 = [regex]::Replace($c, '(?s)# Inline state-machine ST.*?function Get-STCall', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) return $newSim + "function Get-STCall" })

if ($c2 -notmatch 'AREA SIMULATORS') {
    $merge = @"

# Merge industry sims into MainProgram so they share the heartbeat scan path
`$plantST = `$plantST + ``n``n + '// ===== AREA SIMULATORS (in MainProgram so they always scan) =====' + ``n + `$bevST + ``n + `$autoST + ``n + `$foodST + ``n + `$moldST + ``n + `$pharmaST + ``n + `$filmST + ``n + `$coilST

"@
    # Use proper PowerShell concatenation without backtick mess
    $merge = @'

# Merge industry sims into MainProgram so they share the heartbeat scan path
$plantST = $plantST + "`r`n`r`n// ===== AREA SIMULATORS (in MainProgram so they always scan) =====`r`n" + $bevST + "`r`n" + $autoST + "`r`n" + $foodST + "`r`n" + $moldST + "`r`n" + $pharmaST + "`r`n" + $filmST + "`r`n" + $coilST

'@
    $c2 = $c2.Replace('function New-ProgramXml', $merge + "`r`nfunction New-ProgramXml")
}

$taskXml = '<Task Name="MainTask" Type="CONTINUOUS" Priority="10" Watchdog="500" DisableUpdateOutputs="false" InhibitTask="false">' + "`r`n" +
'<ScheduledPrograms>' + "`r`n" +
'<ScheduledProgram Name="MainProgram"/>' + "`r`n" +
'</ScheduledPrograms>' + "`r`n" +
'</Task>'

$c2 = [regex]::Replace($c2, '(?s)<Task Name="MainTask".*?</Task>', $taskXml)

$c2 = $c2.Replace('ConnectOEE_Sim_v4.L5X', 'ConnectOEE_Sim_v5.L5X')
$c2 = $c2.Replace('ConnectOEE_Sim_v5.L5X.L5X', 'ConnectOEE_Sim_v5.L5X')

# Ensure outPathAlt3 points to v5
if ($c2 -notmatch 'ConnectOEE_Sim_v5') {
    $c2 = $c2.Replace('ConnectOEE_Sim_v3.L5X', 'ConnectOEE_Sim_v5.L5X')
}

[System.IO.File]::WriteAllText($p, $c2)
Write-Host "Patched generator. AREA=$($c2 -match 'AREA SIMULATORS') LITERAL25=$($c2 -match 'CycleMsAcc >= 25') MAINONLY=$($c2 -match 'ScheduledProgram Name=`"MainProgram`"/>\s*</ScheduledPrograms>')"

# Quick syntax check
$null = [System.Management.Automation.Language.Parser]::ParseFile($p, [ref]$null, [ref]$errs)
if ($errs) { $errs | ForEach-Object { $_.ToString() }; exit 1 }
Write-Host "Generator parses OK"
