# Generates ConnectOEE_Sim.L5X ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â multi-industry autonomous plant for ConnectOEE testing.
# Run: powershell -File .\tools\Generate-ConnectOEESimL5X.ps1

$ErrorActionPreference = "Stop"
$outPath = Join-Path (Split-Path $PSScriptRoot -Parent) "ConnectOEE_Sim.L5X"
$outPathAlt = Join-Path (Split-Path $PSScriptRoot -Parent) "ConnectOEE_Sim_fixed.L5X"
$outPathAlt2 = Join-Path (Split-Path $PSScriptRoot -Parent) "ConnectOEE_Sim_v3.L5X"
$outPathAlt3 = Join-Path (Split-Path $PSScriptRoot -Parent) "ConnectOEE_Sim_v10.L5X"
$now = Get-Date -Format "ddd MMM dd HH:mm:ss yyyy"
$iso = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$machines = @(
    # CycleMs = production ticks per part (MainTask PERIODIC 500ms = 1 tick)
    # IdleMs/BreakMs/SetupMs = ticks (tick=0.5s): 6=3s, 30=15s, 60=30s
    @{ Name = "Bev_Infeed";        Area = "Bev";    CycleMs = 2;   RejectPct = 1; ReworkPct = 0; IdleChance = 8;  BreakChance = 4;  SetupChance = 2; IdleMs = 6;   BreakMs = 30;  SetupMs = 40;  IdealPph = 3600; FaultBase = 10; EnableCounts = 1; EnableRework = 0; PartId = "BTL-500" }
    @{ Name = "Bev_Filler";        Area = "Bev";    CycleMs = 2;   RejectPct = 2; ReworkPct = 0; IdleChance = 8;  BreakChance = 5;  SetupChance = 2; IdleMs = 6;   BreakMs = 30;  SetupMs = 40;  IdealPph = 3600; FaultBase = 20; EnableCounts = 1; EnableRework = 0; PartId = "BTL-500" }
    @{ Name = "Bev_Capper";        Area = "Bev";    CycleMs = 2;   RejectPct = 1; ReworkPct = 0; IdleChance = 7;  BreakChance = 4;  SetupChance = 2; IdleMs = 6;   BreakMs = 28;  SetupMs = 40;  IdealPph = 3600; FaultBase = 30; EnableCounts = 1; EnableRework = 0; PartId = "BTL-500" }
    @{ Name = "Bev_Labeler";       Area = "Bev";    CycleMs = 2;   RejectPct = 3; ReworkPct = 0; IdleChance = 8;  BreakChance = 3;  SetupChance = 3; IdleMs = 8;   BreakMs = 26;  SetupMs = 45;  IdealPph = 3600; FaultBase = 40; EnableCounts = 1; EnableRework = 0; PartId = "BTL-500" }
    @{ Name = "Auto_Weld";         Area = "Auto";   CycleMs = 8;   RejectPct = 1; ReworkPct = 0; IdleChance = 6;  BreakChance = 6;  SetupChance = 3; IdleMs = 10;  BreakMs = 40;  SetupMs = 80;  IdealPph = 900;  FaultBase = 50; EnableCounts = 1; EnableRework = 0; PartId = "FRM-A12" }
    @{ Name = "Auto_Assemble";     Area = "Auto";   CycleMs = 8;   RejectPct = 2; ReworkPct = 1; IdleChance = 6;  BreakChance = 5;  SetupChance = 3; IdleMs = 10;  BreakMs = 38;  SetupMs = 75;  IdealPph = 900;  FaultBase = 60; EnableCounts = 1; EnableRework = 0; PartId = "FRM-A12" }
    @{ Name = "Auto_Test";         Area = "Auto";   CycleMs = 7;   RejectPct = 4; ReworkPct = 2; IdleChance = 5;  BreakChance = 4;  SetupChance = 2; IdleMs = 8;   BreakMs = 36;  SetupMs = 70;  IdealPph = 1028; FaultBase = 70; EnableCounts = 1; EnableRework = 1; PartId = "FRM-A12" }
    @{ Name = "Food_Mixer";        Area = "Food";   CycleMs = 90;  RejectPct = 0; ReworkPct = 0; IdleChance = 4;  BreakChance = 4;  SetupChance = 5; IdleMs = 12;  BreakMs = 50;  SetupMs = 90;  IdealPph = 80;   FaultBase = 10; EnableCounts = 1; EnableRework = 0; PartId = "SOUP-01" }
    @{ Name = "Food_Cooker";       Area = "Food";   CycleMs = 120; RejectPct = 1; ReworkPct = 0; IdleChance = 4;  BreakChance = 5;  SetupChance = 6; IdleMs = 12;  BreakMs = 55;  SetupMs = 100; IdealPph = 60;   FaultBase = 20; EnableCounts = 1; EnableRework = 0; PartId = "SOUP-01" }
    @{ Name = "Food_Packer";       Area = "Food";   CycleMs = 4;   RejectPct = 2; ReworkPct = 0; IdleChance = 7;  BreakChance = 3;  SetupChance = 4; IdleMs = 10;  BreakMs = 35;  SetupMs = 70;  IdealPph = 1800; FaultBase = 30; EnableCounts = 1; EnableRework = 0; PartId = "SOUP-01" }
    @{ Name = "Mold_Press1";       Area = "Mold";   CycleMs = 24;  RejectPct = 5; ReworkPct = 0; IdleChance = 5;  BreakChance = 6;  SetupChance = 8; IdleMs = 12;  BreakMs = 45;  SetupMs = 120; IdealPph = 300;  FaultBase = 10; EnableCounts = 1; EnableRework = 0; PartId = "CAP-BLK" }
    @{ Name = "Mold_Press2";       Area = "Mold";   CycleMs = 28;  RejectPct = 4; ReworkPct = 0; IdleChance = 5;  BreakChance = 5;  SetupChance = 7; IdleMs = 12;  BreakMs = 45;  SetupMs = 110; IdealPph = 257;  FaultBase = 20; EnableCounts = 1; EnableRework = 0; PartId = "CAP-RED" }
    @{ Name = "Pharma_Filler";     Area = "Pharma"; CycleMs = 2;   RejectPct = 1; ReworkPct = 0; IdleChance = 6;  BreakChance = 4;  SetupChance = 8; IdleMs = 8;   BreakMs = 40;  SetupMs = 100; IdealPph = 3600; FaultBase = 10; EnableCounts = 1; EnableRework = 0; PartId = "LOT-1001" }
    @{ Name = "Pharma_Inspector";  Area = "Pharma"; CycleMs = 2;   RejectPct = 3; ReworkPct = 5; IdleChance = 5;  BreakChance = 3;  SetupChance = 5; IdleMs = 8;   BreakMs = 35;  SetupMs = 80;  IdealPph = 3600; FaultBase = 20; EnableCounts = 1; EnableRework = 1; PartId = "LOT-1001" }
    @{ Name = "Pharma_Cartoner";   Area = "Pharma"; CycleMs = 3;   RejectPct = 1; ReworkPct = 0; IdleChance = 7;  BreakChance = 3;  SetupChance = 6; IdleMs = 8;   BreakMs = 35;  SetupMs = 90;  IdealPph = 2400; FaultBase = 30; EnableCounts = 1; EnableRework = 0; PartId = "LOT-1001" }
    @{ Name = "Film_Unwind";       Area = "Film";   CycleMs = 1;   RejectPct = 0; ReworkPct = 0; IdleChance = 6;  BreakChance = 6;  SetupChance = 5; IdleMs = 8;   BreakMs = 40;  SetupMs = 90;  IdealPph = 7200; FaultBase = 10; EnableCounts = 1; EnableRework = 0; PartId = "PE-12UM" }
    @{ Name = "Film_Treat";        Area = "Film";   CycleMs = 1;   RejectPct = 1; ReworkPct = 0; IdleChance = 5;  BreakChance = 5;  SetupChance = 3; IdleMs = 8;   BreakMs = 38;  SetupMs = 80;  IdealPph = 7200; FaultBase = 20; EnableCounts = 1; EnableRework = 0; PartId = "PE-12UM" }
    @{ Name = "Film_Slitter";      Area = "Film";   CycleMs = 1;   RejectPct = 3; ReworkPct = 0; IdleChance = 7;  BreakChance = 5;  SetupChance = 4; IdleMs = 8;   BreakMs = 40;  SetupMs = 85;  IdealPph = 7200; FaultBase = 30; EnableCounts = 1; EnableRework = 0; PartId = "PE-12UM" }
    @{ Name = "Film_Rewind";       Area = "Film";   CycleMs = 1;   RejectPct = 2; ReworkPct = 0; IdleChance = 6;  BreakChance = 4;  SetupChance = 6; IdleMs = 8;   BreakMs = 36;  SetupMs = 90;  IdealPph = 7200; FaultBase = 40; EnableCounts = 1; EnableRework = 0; PartId = "PE-12UM" }
    @{ Name = "Coil_Uncoil";       Area = "Coil";   CycleMs = 2;   RejectPct = 0; ReworkPct = 0; IdleChance = 5;  BreakChance = 5;  SetupChance = 8; IdleMs = 10;  BreakMs = 45;  SetupMs = 110; IdealPph = 3600; FaultBase = 10; EnableCounts = 1; EnableRework = 0; PartId = "CRS-0.8" }
    @{ Name = "Coil_Leveler";      Area = "Coil";   CycleMs = 2;   RejectPct = 1; ReworkPct = 0; IdleChance = 4;  BreakChance = 5;  SetupChance = 3; IdleMs = 10;  BreakMs = 42;  SetupMs = 80;  IdealPph = 3600; FaultBase = 20; EnableCounts = 1; EnableRework = 0; PartId = "CRS-0.8" }
    @{ Name = "Coil_Shear";        Area = "Coil";   CycleMs = 4;   RejectPct = 2; ReworkPct = 0; IdleChance = 6;  BreakChance = 6;  SetupChance = 4; IdleMs = 10;  BreakMs = 48;  SetupMs = 90;  IdealPph = 1800; FaultBase = 30; EnableCounts = 1; EnableRework = 0; PartId = "CRS-0.8" }
    @{ Name = "Coil_Recoil";       Area = "Coil";   CycleMs = 2;   RejectPct = 1; ReworkPct = 0; IdleChance = 5;  BreakChance = 4;  SetupChance = 7; IdleMs = 10;  BreakMs = 40;  SetupMs = 100; IdealPph = 3600; FaultBase = 40; EnableCounts = 1; EnableRework = 0; PartId = "CRS-0.8" }
)

function Esc([string]$s) {
    return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;')
}

# 1769-L36ERM (5370) ST cannot assign STRING literals or STRING:=STRING.
# Write ASCII into .DATA[] / .LEN (Rockwell-recommended workaround).
function Get-StringWriteST([string]$Dest, [string]$Text) {
    $lines = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $Text.Length; $i++) {
        $code = [int][char]$Text[$i]
        [void]$lines.Add("$Dest.DATA[$i] := $code;")
    }
    [void]$lines.Add("$Dest.LEN := $($Text.Length);")
    return ($lines -join "`r`n")
}

function Get-SetPartIds([string[]]$Dests, [string]$Text) {
    return (($Dests | ForEach-Object { Get-StringWriteST $_ $Text }) -join "`r`n")
}

function Get-MachineTagXml($m) {
    $sp = [int]$m.EnableCounts
    $rw = [int]$m.EnableRework
    $partIdStr = Esc $m.PartId
    $partIdLen = $m.PartId.Length
    @"
<Tag Name="$($m.Name)" TagType="Base" DataType="Sim_Machine_t" Constant="false" ExternalAccess="Read/Write">
<Description><![CDATA[$($m.Area) simulated machine]]></Description>
<Data Format="Decorated">
<Structure DataType="Sim_Machine_t">
<StructureMember Name="Status" DataType="Sim_Status_t">
<DataValueMember Name="Running" DataType="BOOL" Value="1"/>
<DataValueMember Name="Idle" DataType="BOOL" Value="0"/>
<DataValueMember Name="Faulted" DataType="BOOL" Value="0"/>
</StructureMember>
<StructureMember Name="Counters" DataType="Sim_Counters_t">
<DataValueMember Name="Good" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="Reject" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="Rework" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="Total" DataType="DINT" Radix="Decimal" Value="0"/>
</StructureMember>
<StructureMember Name="Cmd" DataType="Sim_Cmd_t">
<DataValueMember Name="Ack" DataType="BOOL" Value="0"/>
<DataValueMember Name="Reset" DataType="BOOL" Value="0"/>
<DataValueMember Name="StartPermissive" DataType="BOOL" Value="1"/>
</StructureMember>
<StructureMember Name="Cfg" DataType="Sim_Cfg_t">
<DataValueMember Name="CycleMs" DataType="DINT" Radix="Decimal" Value="$($m.CycleMs)"/>
<DataValueMember Name="RejectPct" DataType="DINT" Radix="Decimal" Value="$($m.RejectPct)"/>
<DataValueMember Name="ReworkPct" DataType="DINT" Radix="Decimal" Value="$($m.ReworkPct)"/>
<DataValueMember Name="IdleChance" DataType="DINT" Radix="Decimal" Value="$($m.IdleChance)"/>
<DataValueMember Name="BreakChance" DataType="DINT" Radix="Decimal" Value="$($m.BreakChance)"/>
<DataValueMember Name="SetupChance" DataType="DINT" Radix="Decimal" Value="$($m.SetupChance)"/>
<DataValueMember Name="IdleMs" DataType="DINT" Radix="Decimal" Value="$($m.IdleMs)"/>
<DataValueMember Name="BreakMs" DataType="DINT" Radix="Decimal" Value="$($m.BreakMs)"/>
<DataValueMember Name="SetupMs" DataType="DINT" Radix="Decimal" Value="$($m.SetupMs)"/>
<DataValueMember Name="IdealPph" DataType="REAL" Radix="Float" Value="$($m.IdealPph)"/>
<DataValueMember Name="FaultBase" DataType="DINT" Radix="Decimal" Value="$($m.FaultBase)"/>
<DataValueMember Name="EnableCounts" DataType="DINT" Radix="Decimal" Value="$sp"/>
<DataValueMember Name="EnableRework" DataType="DINT" Radix="Decimal" Value="$rw"/>
</StructureMember>
<DataValueMember Name="RunState" DataType="DINT" Radix="Decimal" Value="1"/>
<DataValueMember Name="FaultCode" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="Speed" DataType="REAL" Radix="Float" Value="0.0"/>
<StructureMember Name="PartId" DataType="STRING">
<DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="$partIdLen"/>
<DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="$partIdStr"/>
</StructureMember>
<DataValueMember Name="StateMs" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="CycleMsAcc" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="ChangeoverMs" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="LastAck" DataType="BOOL" Value="0"/>
<DataValueMember Name="LastReset" DataType="BOOL" Value="0"/>
<DataValueMember Name="ForceStarved" DataType="BOOL" Value="0"/>
<DataValueMember Name="ForceBlocked" DataType="BOOL" Value="0"/>
<DataValueMember Name="ForcePlannedDown" DataType="BOOL" Value="0"/>
</Structure>
</Data>
</Tag>
"@
}


# Inline state-machine ST with LITERAL timing (nested Cfg.CycleMs reads as 0 on some Logix imports)
# NOTE: PowerShell vars are case-insensitive — never use $M and $m as different values.
function Get-SimLogic($machine) {
    $tag = $machine.Name
    $cyc = [int]$machine['CycleMs']
    $idle = [int]$machine['IdleMs']
    $brk = [int]$machine['BreakMs']
    $setup = [int]$machine['SetupMs']
    $rej = [int]$machine['RejectPct']
    $ideal = [double]$machine['IdealPph']
    $pphApprox = if ($cyc -gt 0) { [math]::Round(7200.0 / $cyc, 0) } else { 0 }
    @"
// --- sim $tag (cycle=${cyc} ticks @500ms => ~${pphApprox}/hr IdealPph=$ideal) ---
IF $tag.Cmd.Ack AND NOT $tag.LastAck THEN
    $tag.FaultCode := 0;
    $tag.Status.Faulted := 0;
    $tag.RunState := 1;
    $tag.StateMs := 0;
END_IF;
IF $tag.Cmd.Reset AND NOT $tag.LastReset THEN
    $tag.FaultCode := 0;
    $tag.Status.Faulted := 0;
    $tag.RunState := 2;
    $tag.StateMs := 0;
    $tag.CycleMsAcc := 0;
END_IF;
$tag.LastAck := $tag.Cmd.Ack;
$tag.LastReset := $tag.Cmd.Reset;

IF NOT $tag.Cmd.StartPermissive THEN
    $tag.RunState := 2;
    $tag.FaultCode := 0;
    $tag.Status.Running := 0;
    $tag.Status.Idle := 1;
    $tag.Status.Faulted := 0;
    $tag.Speed := 0.0;
ELSIF $tag.ForcePlannedDown THEN
    $tag.RunState := 4;
    $tag.FaultCode := 250;
    $tag.Status.Running := 0;
    $tag.Status.Idle := 0;
    $tag.Status.Faulted := 0;
    $tag.Speed := 0.0;
ELSIF $tag.ForceStarved THEN
    $tag.RunState := 6;
    $tag.FaultCode := 301;
    $tag.Status.Running := 0;
    $tag.Status.Idle := 0;
    $tag.Status.Faulted := 0;
    $tag.Speed := 0.0;
ELSIF $tag.ForceBlocked THEN
    $tag.RunState := 7;
    $tag.FaultCode := 351;
    $tag.Status.Running := 0;
    $tag.Status.Idle := 0;
    $tag.Status.Faulted := 0;
    $tag.Speed := 0.0;
ELSE
    IF ($tag.RunState = 4) OR ($tag.RunState = 6) OR ($tag.RunState = 7) OR ($tag.RunState = 0) THEN
        $tag.RunState := 1;
        $tag.FaultCode := 0;
        $tag.StateMs := 0;
    END_IF;

    $tag.StateMs := $tag.StateMs + 1;
    Plant_Rng := (Plant_Rng * 1103515245 + 12345) AND 16#7FFFFFFF;
    Plant_Roll := Plant_Rng MOD 1000;

    CASE $tag.RunState OF
        1:
            $tag.Status.Running := 1;
            $tag.Status.Idle := 0;
            $tag.Status.Faulted := 0;
            $tag.FaultCode := 0;
            $tag.Speed := $($ideal.ToString([System.Globalization.CultureInfo]::InvariantCulture));
            $tag.CycleMsAcc := $tag.CycleMsAcc + 1;
            IF $tag.CycleMsAcc >= $cyc THEN
                $tag.CycleMsAcc := 0;
                Plant_Rng := (Plant_Rng * 1103515245 + 12345) AND 16#7FFFFFFF;
                Plant_Roll2 := Plant_Rng MOD 100;
                IF Plant_Roll2 < $rej THEN
                    $tag.Counters.Reject := $tag.Counters.Reject + 1;
                    $tag.Counters.Total := $tag.Counters.Total + 1;
                ELSE
                    $tag.Counters.Good := $tag.Counters.Good + 1;
                    $tag.Counters.Total := $tag.Counters.Total + 1;
                END_IF;
            END_IF;
            IF $tag.StateMs >= 40 THEN
                $tag.StateMs := 0;
                IF Plant_Roll < 5 THEN
                    $tag.RunState := 3;
                    $tag.FaultCode := 101;
                ELSIF Plant_Roll < 15 THEN
                    $tag.RunState := 2;
                    $tag.FaultCode := 2;
                ELSIF Plant_Roll < 20 THEN
                    $tag.RunState := 5;
                    $tag.FaultCode := 201;
                END_IF;
            END_IF;
        2:
            $tag.Status.Running := 0;
            $tag.Status.Idle := 1;
            $tag.Status.Faulted := 0;
            $tag.Speed := 0.0;
            IF $tag.StateMs >= $idle THEN
                $tag.RunState := 1;
                $tag.FaultCode := 0;
                $tag.StateMs := 0;
            END_IF;
        3:
            $tag.Status.Running := 0;
            $tag.Status.Idle := 0;
            $tag.Status.Faulted := 1;
            $tag.Speed := 0.0;
            IF $tag.StateMs >= $brk THEN
                $tag.RunState := 1;
                $tag.FaultCode := 0;
                $tag.Status.Faulted := 0;
                $tag.StateMs := 0;
            END_IF;
        4:
            $tag.Status.Running := 0;
            $tag.Status.Idle := 0;
            $tag.Status.Faulted := 0;
            $tag.Speed := 0.0;
            IF $tag.StateMs >= $setup THEN
                $tag.RunState := 1;
                $tag.FaultCode := 0;
                $tag.StateMs := 0;
            END_IF;
        5:
            $tag.Status.Running := 0;
            $tag.Status.Idle := 0;
            $tag.Status.Faulted := 0;
            $tag.Speed := 0.0;
            IF $tag.StateMs >= $setup THEN
                $tag.RunState := 1;
                $tag.FaultCode := 0;
                $tag.StateMs := 0;
            END_IF;
        6:
            $tag.RunState := 1;
            $tag.FaultCode := 0;
            $tag.StateMs := 0;
        7:
            $tag.RunState := 1;
            $tag.FaultCode := 0;
            $tag.StateMs := 0;
        ELSE
            $tag.RunState := 1;
            $tag.StateMs := 0;
    END_CASE;
END_IF;
"@
}
function Get-STCall($mName) {
    $found = $null
    foreach ($x in $machines) {
        if ($x['Name'] -eq $mName) { $found = $x; break }
    }
    if (-not $found) { throw "Unknown machine $mName" }
    Get-SimLogic $found
}

function Format-STLines([string]$code) {
    $lines = $code -split "`r?`n"
    $sb = New-Object System.Text.StringBuilder
    $n = 0
    foreach ($line in $lines) {
        [void]$sb.AppendLine("<Line Number=`"$n`"><![CDATA[$line]]></Line>")
        $n++
    }
    return $sb.ToString()
}

# Area coordinator ST (sets Force bits on machine tags, then inlines sim logic)
$bevST = @"
// Beverage continuous line coordination + machine sims
IF NOT Plant_Running THEN
    Bev_Infeed.Cmd.StartPermissive := 0;
    Bev_Filler.Cmd.StartPermissive := 0;
    Bev_Capper.Cmd.StartPermissive := 0;
    Bev_Labeler.Cmd.StartPermissive := 0;
ELSE
    Bev_Infeed.Cmd.StartPermissive := 1;
    Bev_Filler.Cmd.StartPermissive := 1;
    Bev_Capper.Cmd.StartPermissive := 1;
    Bev_Labeler.Cmd.StartPermissive := 1;
END_IF;

// Downstream starved if upstream not producing
Bev_Infeed.ForceStarved := 0;
IF (Bev_Filler.RunState = 3) OR (Bev_Filler.RunState = 7) THEN
    Bev_Infeed.ForceBlocked := 1;
ELSE
    Bev_Infeed.ForceBlocked := 0;
END_IF;
Bev_Infeed.ForcePlannedDown := 0;

IF (Bev_Infeed.RunState <> 1) AND (Bev_Infeed.RunState <> 2) THEN
    Bev_Filler.ForceStarved := 1;
ELSE
    Bev_Filler.ForceStarved := 0;
END_IF;
IF (Bev_Capper.RunState = 3) OR (Bev_Capper.RunState = 7) OR (Bev_Capper.RunState = 5) THEN
    Bev_Filler.ForceBlocked := 1;
ELSE
    Bev_Filler.ForceBlocked := 0;
END_IF;
Bev_Filler.ForcePlannedDown := 0;

IF (Bev_Filler.RunState >= 3) THEN
    Bev_Capper.ForceStarved := 1;
ELSE
    Bev_Capper.ForceStarved := 0;
END_IF;
IF (Bev_Labeler.RunState = 3) OR (Bev_Labeler.RunState = 7) THEN
    Bev_Capper.ForceBlocked := 1;
ELSE
    Bev_Capper.ForceBlocked := 0;
END_IF;
Bev_Capper.ForcePlannedDown := 0;

IF (Bev_Capper.RunState >= 3) THEN
    Bev_Labeler.ForceStarved := 1;
ELSE
    Bev_Labeler.ForceStarved := 0;
END_IF;
Bev_Labeler.ForceBlocked := 0;
Bev_Labeler.ForcePlannedDown := 0;

// Product running (5370 ST: write .DATA/.LEN — no string literals)
$(Get-SetPartIds @('Bev_Infeed.PartId','Bev_Filler.PartId','Bev_Capper.PartId','Bev_Labeler.PartId','Bev_Infeed_PartId','Bev_Filler_PartId','Bev_Capper_PartId','Bev_Labeler_PartId') 'BTL-500')

$(Get-STCall "Bev_Infeed")
$(Get-STCall "Bev_Filler")
$(Get-STCall "Bev_Capper")
$(Get-STCall "Bev_Labeler")
"@

$autoST = @"
// Automotive discrete assembly coordination
IF NOT Plant_Running THEN
    Auto_Weld.Cmd.StartPermissive := 0;
    Auto_Assemble.Cmd.StartPermissive := 0;
    Auto_Test.Cmd.StartPermissive := 0;
ELSE
    Auto_Weld.Cmd.StartPermissive := 1;
    Auto_Assemble.Cmd.StartPermissive := 1;
    Auto_Test.Cmd.StartPermissive := 1;
END_IF;

Auto_Weld.ForceStarved := 0;
IF (Auto_Assemble.RunState = 3) OR (Auto_Assemble.RunState = 7) OR (Auto_Assemble.RunState = 5) THEN
    Auto_Weld.ForceBlocked := 1;
ELSE
    Auto_Weld.ForceBlocked := 0;
END_IF;
Auto_Weld.ForcePlannedDown := 0;

IF (Auto_Weld.RunState >= 3) THEN
    Auto_Assemble.ForceStarved := 1;
ELSE
    Auto_Assemble.ForceStarved := 0;
END_IF;
IF (Auto_Test.RunState = 3) OR (Auto_Test.RunState = 7) OR (Auto_Test.RunState = 5) THEN
    Auto_Assemble.ForceBlocked := 1;
ELSE
    Auto_Assemble.ForceBlocked := 0;
END_IF;
Auto_Assemble.ForcePlannedDown := 0;

IF (Auto_Assemble.RunState >= 3) THEN
    Auto_Test.ForceStarved := 1;
ELSE
    Auto_Test.ForceStarved := 0;
END_IF;
Auto_Test.ForceBlocked := 0;
Auto_Test.ForcePlannedDown := 0;

// Product running
$(Get-SetPartIds @('Auto_Weld.PartId','Auto_Assemble.PartId','Auto_Test.PartId','Auto_Weld_PartId','Auto_Assemble_PartId','Auto_Test_PartId') 'FRM-A12')

$(Get-STCall "Auto_Weld")
$(Get-STCall "Auto_Assemble")
$(Get-STCall "Auto_Test")
"@

$foodST = @"
// Food batch process ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Mixer -> Cooker -> Packer + CIP
IF NOT Plant_Running THEN
    Food_Mixer.Cmd.StartPermissive := 0;
    Food_Cooker.Cmd.StartPermissive := 0;
    Food_Packer.Cmd.StartPermissive := 0;
ELSE
    Food_Mixer.Cmd.StartPermissive := 1;
    Food_Cooker.Cmd.StartPermissive := 1;
    Food_Packer.Cmd.StartPermissive := 1;
END_IF;

// CIP window every ~8 minutes plant time
Food_CipActive := (Plant_Tick MOD 720) > 660;

// SKU rotation — COP unsupported in ST; write STRING literals every tick
Food_Mixer.ChangeoverMs := Food_Mixer.ChangeoverMs + 1;
IF Food_Mixer.ChangeoverMs > 600 THEN
    Food_Mixer.ChangeoverMs := 0;
    Food_SkuIndex := Food_SkuIndex + 1;
    IF Food_SkuIndex > 2 THEN
        Food_SkuIndex := 0;
    END_IF;
END_IF;
IF Food_SkuIndex = 0 THEN
$(Get-SetPartIds @('Food_Mixer.PartId','Food_Cooker.PartId','Food_Packer.PartId','Food_Mixer_PartId','Food_Cooker_PartId','Food_Packer_PartId') 'SOUP-01')
ELSIF Food_SkuIndex = 1 THEN
$(Get-SetPartIds @('Food_Mixer.PartId','Food_Cooker.PartId','Food_Packer.PartId','Food_Mixer_PartId','Food_Cooker_PartId','Food_Packer_PartId') 'SAUCE-02')
ELSE
$(Get-SetPartIds @('Food_Mixer.PartId','Food_Cooker.PartId','Food_Packer.PartId','Food_Mixer_PartId','Food_Cooker_PartId','Food_Packer_PartId') 'BROTH-03')
END_IF;

Food_Mixer.ForceStarved := 0;
IF (Food_Cooker.RunState = 3) OR (Food_Cooker.RunState = 5) THEN
    Food_Mixer.ForceBlocked := 1;
ELSE
    Food_Mixer.ForceBlocked := 0;
END_IF;
IF Food_CipActive THEN
    Food_Mixer.ForcePlannedDown := 1;
ELSE
    Food_Mixer.ForcePlannedDown := 0;
END_IF;
IF (Food_Mixer.RunState >= 3) AND NOT Food_CipActive THEN
    Food_Cooker.ForceStarved := 1;
ELSE
    Food_Cooker.ForceStarved := 0;
END_IF;
IF (Food_Packer.RunState = 3) OR (Food_Packer.RunState = 7) THEN
    Food_Cooker.ForceBlocked := 1;
ELSE
    Food_Cooker.ForceBlocked := 0;
END_IF;
IF Food_CipActive THEN
    Food_Cooker.ForcePlannedDown := 1;
ELSE
    Food_Cooker.ForcePlannedDown := 0;
END_IF;
IF (Food_Cooker.RunState >= 3) AND NOT Food_CipActive THEN
    Food_Packer.ForceStarved := 1;
ELSE
    Food_Packer.ForceStarved := 0;
END_IF;
Food_Packer.ForceBlocked := 0;
IF Food_CipActive THEN
    Food_Packer.ForcePlannedDown := 1;
ELSE
    Food_Packer.ForcePlannedDown := 0;
END_IF;
$(Get-STCall "Food_Mixer")
$(Get-STCall "Food_Cooker")
$(Get-STCall "Food_Packer")
"@

$moldST = @"
// Injection molding ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â independent presses with mold-change PartId
IF NOT Plant_Running THEN
    Mold_Press1.Cmd.StartPermissive := 0;
    Mold_Press2.Cmd.StartPermissive := 0;
ELSE
    Mold_Press1.Cmd.StartPermissive := 1;
    Mold_Press2.Cmd.StartPermissive := 1;
END_IF;

Mold_Press1.ChangeoverMs := Mold_Press1.ChangeoverMs + 1;
IF Mold_Press1.ChangeoverMs > 720 THEN
    Mold_Press1.ChangeoverMs := 0;
    Mold_Press1_SkuFlip := Mold_Press1_SkuFlip + 1;
END_IF;
IF (Mold_Press1_SkuFlip MOD 2) = 0 THEN
$(Get-SetPartIds @('Mold_Press1.PartId','Mold_Press1_PartId') 'CAP-BLK')
ELSE
$(Get-SetPartIds @('Mold_Press1.PartId','Mold_Press1_PartId') 'CAP-WHT')
END_IF;

Mold_Press2.ChangeoverMs := Mold_Press2.ChangeoverMs + 1;
IF Mold_Press2.ChangeoverMs > 900 THEN
    Mold_Press2.ChangeoverMs := 0;
    Mold_Press2_SkuFlip := Mold_Press2_SkuFlip + 1;
END_IF;
IF (Mold_Press2_SkuFlip MOD 2) = 0 THEN
$(Get-SetPartIds @('Mold_Press2.PartId','Mold_Press2_PartId') 'CAP-RED')
ELSE
$(Get-SetPartIds @('Mold_Press2.PartId','Mold_Press2_PartId') 'CAP-BLU')
END_IF;

Mold_Press1.ForceStarved := 0;
Mold_Press1.ForceBlocked := 0;
Mold_Press1.ForcePlannedDown := 0;

Mold_Press2.ForceStarved := 0;
Mold_Press2.ForceBlocked := 0;
Mold_Press2.ForcePlannedDown := 0;

$(Get-STCall "Mold_Press1")
$(Get-STCall "Mold_Press2")
"@

$pharmaST = @"
// Pharma fill/finish ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â lot change + CIP + rework on inspector
IF NOT Plant_Running THEN
    Pharma_Filler.Cmd.StartPermissive := 0;
    Pharma_Inspector.Cmd.StartPermissive := 0;
    Pharma_Cartoner.Cmd.StartPermissive := 0;
ELSE
    Pharma_Filler.Cmd.StartPermissive := 1;
    Pharma_Inspector.Cmd.StartPermissive := 1;
    Pharma_Cartoner.Cmd.StartPermissive := 1;
END_IF;

Pharma_CipActive := (Plant_Tick MOD 720) > 660;

Pharma_Filler.ChangeoverMs := Pharma_Filler.ChangeoverMs + 1;
IF Pharma_Filler.ChangeoverMs > 480 THEN
    Pharma_Filler.ChangeoverMs := 0;
    Pharma_LotIndex := Pharma_LotIndex + 1;
    IF Pharma_LotIndex > 3 THEN
        Pharma_LotIndex := 0;
    END_IF;
END_IF;
IF Pharma_LotIndex = 0 THEN
$(Get-SetPartIds @('Pharma_Filler.PartId','Pharma_Inspector.PartId','Pharma_Cartoner.PartId','Pharma_Filler_PartId','Pharma_Inspector_PartId','Pharma_Cartoner_PartId') 'LOT-1001')
ELSIF Pharma_LotIndex = 1 THEN
$(Get-SetPartIds @('Pharma_Filler.PartId','Pharma_Inspector.PartId','Pharma_Cartoner.PartId','Pharma_Filler_PartId','Pharma_Inspector_PartId','Pharma_Cartoner_PartId') 'LOT-1002')
ELSIF Pharma_LotIndex = 2 THEN
$(Get-SetPartIds @('Pharma_Filler.PartId','Pharma_Inspector.PartId','Pharma_Cartoner.PartId','Pharma_Filler_PartId','Pharma_Inspector_PartId','Pharma_Cartoner_PartId') 'LOT-2001')
ELSE
$(Get-SetPartIds @('Pharma_Filler.PartId','Pharma_Inspector.PartId','Pharma_Cartoner.PartId','Pharma_Filler_PartId','Pharma_Inspector_PartId','Pharma_Cartoner_PartId') 'LOT-2002')
END_IF;

Pharma_Filler.ForceStarved := 0;
IF (Pharma_Inspector.RunState = 3) OR (Pharma_Inspector.RunState = 7) THEN
    Pharma_Filler.ForceBlocked := 1;
ELSE
    Pharma_Filler.ForceBlocked := 0;
END_IF;
IF Pharma_CipActive THEN
    Pharma_Filler.ForcePlannedDown := 1;
ELSE
    Pharma_Filler.ForcePlannedDown := 0;
END_IF;
IF (Pharma_Filler.RunState >= 3) AND NOT Pharma_CipActive THEN
    Pharma_Inspector.ForceStarved := 1;
ELSE
    Pharma_Inspector.ForceStarved := 0;
END_IF;
IF (Pharma_Cartoner.RunState = 3) OR (Pharma_Cartoner.RunState = 7) THEN
    Pharma_Inspector.ForceBlocked := 1;
ELSE
    Pharma_Inspector.ForceBlocked := 0;
END_IF;
IF Pharma_CipActive THEN
    Pharma_Inspector.ForcePlannedDown := 1;
ELSE
    Pharma_Inspector.ForcePlannedDown := 0;
END_IF;
IF (Pharma_Inspector.RunState >= 3) AND NOT Pharma_CipActive THEN
    Pharma_Cartoner.ForceStarved := 1;
ELSE
    Pharma_Cartoner.ForceStarved := 0;
END_IF;
Pharma_Cartoner.ForceBlocked := 0;
IF Pharma_CipActive THEN
    Pharma_Cartoner.ForcePlannedDown := 1;
ELSE
    Pharma_Cartoner.ForcePlannedDown := 0;
END_IF;
$(Get-STCall "Pharma_Filler")
$(Get-STCall "Pharma_Inspector")
$(Get-STCall "Pharma_Cartoner")
"@

$filmST = @"
// Film converting web line ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Unwind -> Treat -> Slitter -> Rewind
// Web break = breakdown; splice/roll change = setup; low tension = small stop / starved
IF NOT Plant_Running THEN
    Film_Unwind.Cmd.StartPermissive := 0;
    Film_Treat.Cmd.StartPermissive := 0;
    Film_Slitter.Cmd.StartPermissive := 0;
    Film_Rewind.Cmd.StartPermissive := 0;
ELSE
    Film_Unwind.Cmd.StartPermissive := 1;
    Film_Treat.Cmd.StartPermissive := 1;
    Film_Slitter.Cmd.StartPermissive := 1;
    Film_Rewind.Cmd.StartPermissive := 1;
END_IF;

// Parent-roll / film SKU change (~4 min) — ST string literals every tick
Film_Unwind.ChangeoverMs := Film_Unwind.ChangeoverMs + 1;
IF Film_Unwind.ChangeoverMs > 720 THEN
    Film_Unwind.ChangeoverMs := 0;
    Film_SkuIndex := Film_SkuIndex + 1;
    IF Film_SkuIndex > 2 THEN
        Film_SkuIndex := 0;
    END_IF;
END_IF;
IF Film_SkuIndex = 0 THEN
$(Get-SetPartIds @('Film_Unwind.PartId','Film_Treat.PartId','Film_Slitter.PartId','Film_Rewind.PartId','Film_Unwind_PartId','Film_Treat_PartId','Film_Slitter_PartId','Film_Rewind_PartId') 'PE-12UM')
ELSIF Film_SkuIndex = 1 THEN
$(Get-SetPartIds @('Film_Unwind.PartId','Film_Treat.PartId','Film_Slitter.PartId','Film_Rewind.PartId','Film_Unwind_PartId','Film_Treat_PartId','Film_Slitter_PartId','Film_Rewind_PartId') 'PET-23UM')
ELSE
$(Get-SetPartIds @('Film_Unwind.PartId','Film_Treat.PartId','Film_Slitter.PartId','Film_Rewind.PartId','Film_Unwind_PartId','Film_Treat_PartId','Film_Slitter_PartId','Film_Rewind_PartId') 'BOPP-18')
END_IF;

Film_Unwind.ForceStarved := 0;
IF (Film_Treat.RunState = 3) OR (Film_Treat.RunState = 7) OR (Film_Slitter.RunState = 3) THEN
    Film_Unwind.ForceBlocked := 1;
ELSE
    Film_Unwind.ForceBlocked := 0;
END_IF;
Film_Unwind.ForcePlannedDown := 0;

IF (Film_Unwind.RunState >= 3) THEN
    Film_Treat.ForceStarved := 1;
ELSE
    Film_Treat.ForceStarved := 0;
END_IF;
IF (Film_Slitter.RunState = 3) OR (Film_Slitter.RunState = 7) OR (Film_Slitter.RunState = 5) THEN
    Film_Treat.ForceBlocked := 1;
ELSE
    Film_Treat.ForceBlocked := 0;
END_IF;
Film_Treat.ForcePlannedDown := 0;

IF (Film_Treat.RunState >= 3) THEN
    Film_Slitter.ForceStarved := 1;
ELSE
    Film_Slitter.ForceStarved := 0;
END_IF;
IF (Film_Rewind.RunState = 3) OR (Film_Rewind.RunState = 7) OR (Film_Rewind.RunState = 5) THEN
    Film_Slitter.ForceBlocked := 1;
ELSE
    Film_Slitter.ForceBlocked := 0;
END_IF;
Film_Slitter.ForcePlannedDown := 0;

IF (Film_Slitter.RunState >= 3) THEN
    Film_Rewind.ForceStarved := 1;
ELSE
    Film_Rewind.ForceStarved := 0;
END_IF;
Film_Rewind.ForceBlocked := 0;
Film_Rewind.ForcePlannedDown := 0;

$(Get-STCall "Film_Unwind")
$(Get-STCall "Film_Treat")
$(Get-STCall "Film_Slitter")
$(Get-STCall "Film_Rewind")
"@

$coilST = @"
// Metal coil / strip webbing ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Uncoil -> Leveler -> Shear -> Recoil
// Coil change = long setup; tip break / jam = breakdown; waiting coil = starved
IF NOT Plant_Running THEN
    Coil_Uncoil.Cmd.StartPermissive := 0;
    Coil_Leveler.Cmd.StartPermissive := 0;
    Coil_Shear.Cmd.StartPermissive := 0;
    Coil_Recoil.Cmd.StartPermissive := 0;
ELSE
    Coil_Uncoil.Cmd.StartPermissive := 1;
    Coil_Leveler.Cmd.StartPermissive := 1;
    Coil_Shear.Cmd.StartPermissive := 1;
    Coil_Recoil.Cmd.StartPermissive := 1;
END_IF;

// Coil / gauge change (~5 min) — ST string literals every tick
Coil_Uncoil.ChangeoverMs := Coil_Uncoil.ChangeoverMs + 1;
IF Coil_Uncoil.ChangeoverMs > 900 THEN
    Coil_Uncoil.ChangeoverMs := 0;
    Coil_SkuIndex := Coil_SkuIndex + 1;
    IF Coil_SkuIndex > 2 THEN
        Coil_SkuIndex := 0;
    END_IF;
END_IF;
IF Coil_SkuIndex = 0 THEN
$(Get-SetPartIds @('Coil_Uncoil.PartId','Coil_Leveler.PartId','Coil_Shear.PartId','Coil_Recoil.PartId','Coil_Uncoil_PartId','Coil_Leveler_PartId','Coil_Shear_PartId','Coil_Recoil_PartId') 'CRS-0.8')
ELSIF Coil_SkuIndex = 1 THEN
$(Get-SetPartIds @('Coil_Uncoil.PartId','Coil_Leveler.PartId','Coil_Shear.PartId','Coil_Recoil.PartId','Coil_Uncoil_PartId','Coil_Leveler_PartId','Coil_Shear_PartId','Coil_Recoil_PartId') 'SS-1.2')
ELSE
$(Get-SetPartIds @('Coil_Uncoil.PartId','Coil_Leveler.PartId','Coil_Shear.PartId','Coil_Recoil.PartId','Coil_Uncoil_PartId','Coil_Leveler_PartId','Coil_Shear_PartId','Coil_Recoil_PartId') 'AL-1.0')
END_IF;

Coil_Uncoil.ForceStarved := 0;
IF (Coil_Leveler.RunState = 3) OR (Coil_Leveler.RunState = 7) OR (Coil_Shear.RunState = 3) THEN
    Coil_Uncoil.ForceBlocked := 1;
ELSE
    Coil_Uncoil.ForceBlocked := 0;
END_IF;
Coil_Uncoil.ForcePlannedDown := 0;

IF (Coil_Uncoil.RunState >= 3) THEN
    Coil_Leveler.ForceStarved := 1;
ELSE
    Coil_Leveler.ForceStarved := 0;
END_IF;
IF (Coil_Shear.RunState = 3) OR (Coil_Shear.RunState = 7) OR (Coil_Shear.RunState = 5) THEN
    Coil_Leveler.ForceBlocked := 1;
ELSE
    Coil_Leveler.ForceBlocked := 0;
END_IF;
Coil_Leveler.ForcePlannedDown := 0;

IF (Coil_Leveler.RunState >= 3) THEN
    Coil_Shear.ForceStarved := 1;
ELSE
    Coil_Shear.ForceStarved := 0;
END_IF;
IF (Coil_Recoil.RunState = 3) OR (Coil_Recoil.RunState = 7) OR (Coil_Recoil.RunState = 5) THEN
    Coil_Shear.ForceBlocked := 1;
ELSE
    Coil_Shear.ForceBlocked := 0;
END_IF;
Coil_Shear.ForcePlannedDown := 0;

IF (Coil_Shear.RunState >= 3) THEN
    Coil_Recoil.ForceStarved := 1;
ELSE
    Coil_Recoil.ForceStarved := 0;
END_IF;
Coil_Recoil.ForceBlocked := 0;
Coil_Recoil.ForcePlannedDown := 0;

$(Get-STCall "Coil_Uncoil")
$(Get-STCall "Coil_Leveler")
$(Get-STCall "Coil_Shear")
$(Get-STCall "Coil_Recoil")
"@

$plantST = @"
// Plant orchestrator - MainTask is PERIODIC 500ms (no TON; ST does not support timer instructions)
IF Plant_Running THEN
    Plant_ProdTick := 1;
    Plant_Tick := Plant_Tick + 1;
    Plant_SimHeartbeat := Plant_SimHeartbeat + 1;
ELSE
    Plant_ProdTick := 0;
END_IF;

// Keep Sku_* and Part_Id filled via .DATA/.LEN (5370 ST has no string literals)
$(Get-StringWriteST 'Sku_Soup01' 'SOUP-01')
$(Get-StringWriteST 'Sku_Sauce02' 'SAUCE-02')
$(Get-StringWriteST 'Sku_Broth03' 'BROTH-03')
$(Get-StringWriteST 'Sku_CapBlk' 'CAP-BLK')
$(Get-StringWriteST 'Sku_CapWht' 'CAP-WHT')
$(Get-StringWriteST 'Sku_CapRed' 'CAP-RED')
$(Get-StringWriteST 'Sku_CapBlu' 'CAP-BLU')
$(Get-StringWriteST 'Sku_Lot1001' 'LOT-1001')
$(Get-StringWriteST 'Sku_Lot1002' 'LOT-1002')
$(Get-StringWriteST 'Sku_Lot2001' 'LOT-2001')
$(Get-StringWriteST 'Sku_Lot2002' 'LOT-2002')
$(Get-StringWriteST 'Sku_PE12' 'PE-12UM')
$(Get-StringWriteST 'Sku_PET23' 'PET-23UM')
$(Get-StringWriteST 'Sku_Bopp18' 'BOPP-18')
$(Get-StringWriteST 'Sku_Crs08' 'CRS-0.8')
$(Get-StringWriteST 'Sku_Ss12' 'SS-1.2')
$(Get-StringWriteST 'Sku_Al10' 'AL-1.0')
$(Get-StringWriteST 'Part_Id' 'BTL-500')

Plant_Rng := (Plant_Rng * 1103515245 + 12345) AND 16#7FFFFFFF;
IF Plant_Rng = 0 THEN
    Plant_Rng := 1;
END_IF;

// Flat aliases (BOOL / DINT) for simple SingleBool + CumulativeDelta mapping
Bev_Filler_Running := Bev_Filler.Status.Running;
Bev_Filler_GoodCount := Bev_Filler.Counters.Good;
Bev_Filler_BadCount := Bev_Filler.Counters.Reject;
Bev_Filler_FaultCode := Bev_Filler.FaultCode;
Bev_Filler_RunState := Bev_Filler.RunState;

Bev_Labeler_Running := Bev_Labeler.Status.Running;
Bev_Labeler_GoodCount := Bev_Labeler.Counters.Good;
Bev_Labeler_BadCount := Bev_Labeler.Counters.Reject;

Auto_Weld_Running := Auto_Weld.Status.Running;
Auto_Weld_GoodCount := Auto_Weld.Counters.Good;
Auto_Weld_BadCount := Auto_Weld.Counters.Reject;
Auto_Assemble_Running := Auto_Assemble.Status.Running;
Auto_Assemble_GoodCount := Auto_Assemble.Counters.Good;
Auto_Assemble_BadCount := Auto_Assemble.Counters.Reject;
Auto_Test_Running := Auto_Test.Status.Running;
Auto_Test_GoodCount := Auto_Test.Counters.Good;
Auto_Test_BadCount := Auto_Test.Counters.Reject;
Auto_Test_ReworkCount := Auto_Test.Counters.Rework;

Food_Packer_Running := Food_Packer.Status.Running;
Food_Packer_GoodCount := Food_Packer.Counters.Good;
Food_Packer_BadCount := Food_Packer.Counters.Reject;
Food_Packer_RunState := Food_Packer.RunState;
Food_Packer_FaultCode := Food_Packer.FaultCode;

Mold_Press1_Running := Mold_Press1.Status.Running;
Mold_Press1_GoodCount := Mold_Press1.Counters.Good;
Mold_Press1_BadCount := Mold_Press1.Counters.Reject;
Mold_Press2_Running := Mold_Press2.Status.Running;
Mold_Press2_GoodCount := Mold_Press2.Counters.Good;
Mold_Press2_BadCount := Mold_Press2.Counters.Reject;

Pharma_Filler_Running := Pharma_Filler.Status.Running;
Pharma_Filler_GoodCount := Pharma_Filler.Counters.Good;
Pharma_Filler_BadCount := Pharma_Filler.Counters.Reject;
Pharma_Inspector_Running := Pharma_Inspector.Status.Running;
Pharma_Inspector_GoodCount := Pharma_Inspector.Counters.Good;
Pharma_Inspector_BadCount := Pharma_Inspector.Counters.Reject;
Pharma_Inspector_ReworkCount := Pharma_Inspector.Counters.Rework;
Pharma_Cartoner_Running := Pharma_Cartoner.Status.Running;
Pharma_Cartoner_GoodCount := Pharma_Cartoner.Counters.Good;
Pharma_Cartoner_BadCount := Pharma_Cartoner.Counters.Reject;

Film_Slitter_Running := Film_Slitter.Status.Running;
Film_Slitter_GoodCount := Film_Slitter.Counters.Good;
Film_Slitter_BadCount := Film_Slitter.Counters.Reject;
Film_Slitter_FaultCode := Film_Slitter.FaultCode;
Film_Slitter_RunState := Film_Slitter.RunState;
Film_Rewind_Running := Film_Rewind.Status.Running;
Film_Rewind_GoodCount := Film_Rewind.Counters.Good;
Film_Rewind_BadCount := Film_Rewind.Counters.Reject;

Coil_Shear_Running := Coil_Shear.Status.Running;
Coil_Shear_GoodCount := Coil_Shear.Counters.Good;
Coil_Shear_BadCount := Coil_Shear.Counters.Reject;
Coil_Shear_FaultCode := Coil_Shear.FaultCode;
Coil_Shear_RunState := Coil_Shear.RunState;
Coil_Recoil_Running := Coil_Recoil.Status.Running;
Coil_Recoil_GoodCount := Coil_Recoil.Counters.Good;
Coil_Recoil_BadCount := Coil_Recoil.Counters.Reject;

Line_Running := Plant_Running AND (Bev_Filler.RunState = 1);
Good_Count := Bev_Filler.Counters.Good;
Reject_Count := Bev_Filler.Counters.Reject;
Total_Count := Bev_Filler.Counters.Total;
Fault_Code := Bev_Filler.FaultCode;
Line_Speed := Bev_Filler.Speed;

OEE_Data.Status.Running := Bev_Filler.Status.Running;
OEE_Data.Status.Faulted := Bev_Filler.Status.Faulted;
OEE_Data.Status.Idle := Bev_Filler.Status.Idle;
OEE_Data.Counters.Good := Bev_Filler.Counters.Good;
OEE_Data.Counters.Reject := Bev_Filler.Counters.Reject;
OEE_Data.Counters.Total := Bev_Filler.Counters.Total;
OEE_Data.Speed := Bev_Filler.Speed;
OEE_Data.FaultCode := Bev_Filler.FaultCode;
"@


# Merge industry sims into MainProgram so they share the heartbeat scan path
$plantST = $plantST + "`r`n`r`n// ===== AREA SIMULATORS (500ms production ticks) =====`r`nIF Plant_ProdTick THEN`r`n" + $bevST + "`r`n" + $autoST + "`r`n" + $foodST + "`r`n" + $moldST + "`r`n" + $pharmaST + "`r`n" + $filmST + "`r`n" + $coilST + "`r`nEND_IF;`r`n"

function New-ProgramXml($name, $mainRoutine, $stBody, $extraTags = "") {
    $stLines = Format-STLines $stBody
    @"
<Program Name="$name" TestEdits="false" MainRoutineName="$mainRoutine" Disabled="false" UseAsFolder="false">
<Tags>
$extraTags
</Tags>
<Routines>
<Routine Name="$mainRoutine" Type="ST">
<STContent>
$stLines
</STContent>
</Routine>
</Routines>
</Program>
"@
}

$machineTagsXml = ($machines | ForEach-Object { Get-MachineTagXml $_ }) -join "`n"

# Flat alias tags
$flatTags = @"
<Tag Name="Plant_Running" TagType="Base" DataType="BOOL" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="BOOL" Value="1"/></Data>
</Tag>
<Tag Name="Plant_Tick" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Plant_Rng" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="123456789"/></Data>
</Tag>
<Tag Name="Plant_SimHeartbeat" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Plant_ProdTick" TagType="Base" DataType="BOOL" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="BOOL" Value="0"/></Data>
</Tag>
<Tag Name="Plant_Roll" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Plant_Roll2" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Food_CipActive" TagType="Base" DataType="BOOL" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="BOOL" Value="0"/></Data>
</Tag>
<Tag Name="Food_SkuIndex" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Pharma_CipActive" TagType="Base" DataType="BOOL" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="BOOL" Value="0"/></Data>
</Tag>
<Tag Name="Pharma_LotIndex" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Film_SkuIndex" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Mold_Press1_SkuFlip" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Mold_Press2_SkuFlip" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Coil_SkuIndex" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Sku_Soup01" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="SOUP-01"/></Structure></Data>
</Tag>
<Tag Name="Sku_Sauce02" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="8"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="SAUCE-02"/></Structure></Data>
</Tag>
<Tag Name="Sku_Broth03" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="8"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="BROTH-03"/></Structure></Data>
</Tag>
<Tag Name="Sku_CapBlk" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="CAP-BLK"/></Structure></Data>
</Tag>
<Tag Name="Sku_CapWht" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="CAP-WHT"/></Structure></Data>
</Tag>
<Tag Name="Sku_CapRed" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="CAP-RED"/></Structure></Data>
</Tag>
<Tag Name="Sku_CapBlu" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="CAP-BLU"/></Structure></Data>
</Tag>
<Tag Name="Sku_Lot1001" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="8"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="LOT-1001"/></Structure></Data>
</Tag>
<Tag Name="Sku_Lot1002" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="8"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="LOT-1002"/></Structure></Data>
</Tag>
<Tag Name="Sku_Lot2001" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="8"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="LOT-2001"/></Structure></Data>
</Tag>
<Tag Name="Sku_Lot2002" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="8"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="LOT-2002"/></Structure></Data>
</Tag>
<Tag Name="Sku_PE12" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="PE-12UM"/></Structure></Data>
</Tag>
<Tag Name="Sku_PET23" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="8"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="PET-23UM"/></Structure></Data>
</Tag>
<Tag Name="Sku_Bopp18" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="BOPP-18"/></Structure></Data>
</Tag>
<Tag Name="Sku_Crs08" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="CRS-0.8"/></Structure></Data>
</Tag>
<Tag Name="Sku_Ss12" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="6"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="SS-1.2"/></Structure></Data>
</Tag>
<Tag Name="Sku_Al10" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><Structure DataType="STRING"><DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="6"/><DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="AL-1.0"/></Structure></Data>
</Tag>
<Tag Name="Line_Running" TagType="Base" DataType="BOOL" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="BOOL" Value="0"/></Data>
</Tag>
<Tag Name="Good_Count" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Reject_Count" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Total_Count" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Line_Speed" TagType="Base" DataType="REAL" Radix="Float" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="REAL" Radix="Float" Value="0.0"/></Data>
</Tag>
<Tag Name="Fault_Code" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Part_Id" TagType="Base" DataType="STRING" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated">
<Structure DataType="STRING">
<DataValueMember Name="LEN" DataType="DINT" Radix="Decimal" Value="7"/>
<DataValueMember Name="DATA" DataType="STRING" Radix="ASCII" Value="BTL-500"/>
</Structure>
</Data>
</Tag>
<Tag Name="OEE_Data" TagType="Base" DataType="OEE_Machine" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated">
<Structure DataType="OEE_Machine">
<StructureMember Name="Status" DataType="Status_t">
<DataValueMember Name="Running" DataType="BOOL" Value="0"/>
<DataValueMember Name="Faulted" DataType="BOOL" Value="0"/>
<DataValueMember Name="Idle" DataType="BOOL" Value="1"/>
</StructureMember>
<StructureMember Name="Counters" DataType="Counters_t">
<DataValueMember Name="Good" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="Reject" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="Total" DataType="DINT" Radix="Decimal" Value="0"/>
</StructureMember>
<DataValueMember Name="Speed" DataType="REAL" Radix="Float" Value="0.0"/>
<DataValueMember Name="FaultCode" DataType="DINT" Radix="Decimal" Value="0"/>
</Structure>
</Data>
</Tag>
"@

$flatAliasNames = @(
    "Bev_Filler_Running","Bev_Filler_GoodCount","Bev_Filler_BadCount","Bev_Filler_FaultCode","Bev_Filler_RunState",
    "Bev_Labeler_Running","Bev_Labeler_GoodCount","Bev_Labeler_BadCount",
    "Auto_Weld_Running","Auto_Weld_GoodCount","Auto_Weld_BadCount",
    "Auto_Assemble_Running","Auto_Assemble_GoodCount","Auto_Assemble_BadCount",
    "Auto_Test_Running","Auto_Test_GoodCount","Auto_Test_BadCount","Auto_Test_ReworkCount",
    "Food_Packer_Running","Food_Packer_GoodCount","Food_Packer_BadCount","Food_Packer_RunState","Food_Packer_FaultCode",
    "Mold_Press1_Running","Mold_Press1_GoodCount","Mold_Press1_BadCount",
    "Mold_Press2_Running","Mold_Press2_GoodCount","Mold_Press2_BadCount",
    "Pharma_Filler_Running","Pharma_Filler_GoodCount","Pharma_Filler_BadCount",
    "Pharma_Inspector_Running","Pharma_Inspector_GoodCount","Pharma_Inspector_BadCount","Pharma_Inspector_ReworkCount",
    "Pharma_Cartoner_Running","Pharma_Cartoner_GoodCount","Pharma_Cartoner_BadCount",
    "Film_Slitter_Running","Film_Slitter_GoodCount","Film_Slitter_BadCount","Film_Slitter_FaultCode","Film_Slitter_RunState",
    "Film_Rewind_Running","Film_Rewind_GoodCount","Film_Rewind_BadCount",
    "Coil_Shear_Running","Coil_Shear_GoodCount","Coil_Shear_BadCount","Coil_Shear_FaultCode","Coil_Shear_RunState",
    "Coil_Recoil_Running","Coil_Recoil_GoodCount","Coil_Recoil_BadCount"
)

$flatPartIdNames = @(
    "Bev_Infeed_PartId","Bev_Filler_PartId","Bev_Capper_PartId","Bev_Labeler_PartId",
    "Auto_Weld_PartId","Auto_Assemble_PartId","Auto_Test_PartId",
    "Food_Mixer_PartId","Food_Cooker_PartId","Food_Packer_PartId",
    "Mold_Press1_PartId","Mold_Press2_PartId",
    "Pharma_Filler_PartId","Pharma_Inspector_PartId","Pharma_Cartoner_PartId",
    "Film_Unwind_PartId","Film_Treat_PartId","Film_Slitter_PartId","Film_Rewind_PartId",
    "Coil_Uncoil_PartId","Coil_Leveler_PartId","Coil_Shear_PartId","Coil_Recoil_PartId"
)

$flatAliasXml = foreach ($n in $flatAliasNames) {
    if ($n -match "Running") {
        "<Tag Name=`"$n`" TagType=`"Base`" DataType=`"BOOL`" Radix=`"Decimal`" Constant=`"false`" ExternalAccess=`"Read/Write`"><Data Format=`"Decorated`"><DataValue DataType=`"BOOL`" Value=`"0`"/></Data></Tag>"
    } else {
        "<Tag Name=`"$n`" TagType=`"Base`" DataType=`"DINT`" Radix=`"Decimal`" Constant=`"false`" ExternalAccess=`"Read/Write`"><Data Format=`"Decorated`"><DataValue DataType=`"DINT`" Radix=`"Decimal`" Value=`"0`"/></Data></Tag>"
    }
}
$flatPartIdXml = foreach ($n in $flatPartIdNames) {
    "<Tag Name=`"$n`" TagType=`"Base`" DataType=`"STRING`" Constant=`"false`" ExternalAccess=`"Read/Write`"><Data Format=`"L5K`"><![CDATA[[0,'']]]></Data></Tag>"
}
$flatAliasXml = @($flatAliasXml) + @($flatPartIdXml)

$l5x = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<RSLogix5000Content SchemaRevision="1.0" SoftwareRevision="37.02" TargetName="ConnectOEE_Sim" TargetType="Controller" ContainsContext="false" ExportDate="$now" ExportOptions="NoRawData L5KData DecoratedData ForceProtectedEncoding AllProjDocTrans">
<Controller Use="Target" Name="ConnectOEE_Sim" ProcessorType="1769-L36ERM" MajorRev="37" MinorRev="11" TimeSlice="20" ShareUnusedTimeSlice="1" ProjectCreationDate="$now" LastModifiedDate="$now" SFCExecutionControl="CurrentActive" SFCRestartPosition="MostRecent" SFCLastScan="DontScan" ProjectSN="16#0000_0000" MatchProjectToController="false" CanUseRPIFromProducer="false" InhibitAutomaticFirmwareUpdate="0" PassThroughConfiguration="EnabledWithAppend" DownloadProjectDocumentationAndExtendedProperties="true" DownloadProjectCustomProperties="true" ReportMinorOverflow="false">
<RedundancyInfo Enabled="false" KeepTestEditsOnSwitchOver="false" IOMemoryPadPercentage="90" DataTablePadPercentage="50"/>
<Security Code="0" ChangesToDetect="16#ffff_ffff_ffff_ffff"/>
<SafetyInfo/>
<DataTypes>
<DataType Name="Sim_Status_t" Family="NoFamily" Class="User">
<Members>
<Member Name="Running" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Idle" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Faulted" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
</Members>
</DataType>
<DataType Name="Sim_Counters_t" Family="NoFamily" Class="User">
<Members>
<Member Name="Good" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Reject" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Rework" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Total" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
</Members>
</DataType>
<DataType Name="Sim_Cmd_t" Family="NoFamily" Class="User">
<Members>
<Member Name="Ack" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Reset" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="StartPermissive" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
</Members>
</DataType>
<DataType Name="Sim_Cfg_t" Family="NoFamily" Class="User">
<Members>
<Member Name="CycleMs" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="RejectPct" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="ReworkPct" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="IdleChance" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="BreakChance" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="SetupChance" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="IdleMs" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="BreakMs" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="SetupMs" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="IdealPph" DataType="REAL" Dimension="0" Radix="Float" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="FaultBase" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="EnableCounts" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="EnableRework" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
</Members>
</DataType>
<DataType Name="Sim_Machine_t" Family="NoFamily" Class="User">
<Members>
<Member Name="Status" DataType="Sim_Status_t" Dimension="0" Radix="NullType" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Counters" DataType="Sim_Counters_t" Dimension="0" Radix="NullType" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Cmd" DataType="Sim_Cmd_t" Dimension="0" Radix="NullType" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Cfg" DataType="Sim_Cfg_t" Dimension="0" Radix="NullType" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="RunState" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="FaultCode" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Speed" DataType="REAL" Dimension="0" Radix="Float" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="PartId" DataType="STRING" Dimension="0" Radix="NullType" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="StateMs" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="CycleMsAcc" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="ChangeoverMs" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="LastAck" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="LastReset" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="ForceStarved" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="ForceBlocked" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="ForcePlannedDown" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
</Members>
</DataType>
<DataType Name="Status_t" Family="NoFamily" Class="User">
<Members>
<Member Name="Running" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Faulted" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Idle" DataType="BOOL" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
</Members>
</DataType>
<DataType Name="Counters_t" Family="NoFamily" Class="User">
<Members>
<Member Name="Good" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Reject" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Total" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
</Members>
</DataType>
<DataType Name="OEE_Machine" Family="NoFamily" Class="User">
<Members>
<Member Name="Status" DataType="Status_t" Dimension="0" Radix="NullType" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Counters" DataType="Counters_t" Dimension="0" Radix="NullType" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="Speed" DataType="REAL" Dimension="0" Radix="Float" Hidden="false" ExternalAccess="Read/Write"/>
<Member Name="FaultCode" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
</Members>
</DataType>
</DataTypes>
<Modules>
<Module Name="Local" CatalogNumber="1769-L36ERM" Vendor="1" ProductType="14" ProductCode="108" Major="37" Minor="11" ParentModule="Local" ParentModPortId="1" Inhibited="false" MajorFault="true">
<EKey State="Disabled"/>
<Ports>
<Port Id="1" Address="0" Type="Compact" Upstream="false">
<Bus Size="31"/>
</Port>
<Port Id="2" Type="Ethernet" Upstream="false">
<Bus/>
</Port>
</Ports>
</Module>
</Modules>
<AddOnInstructionDefinitions/>
<Tags>
$machineTagsXml
$flatTags
$($flatAliasXml -join "`n")
</Tags>
<Programs>
$(New-ProgramXml "MainProgram" "MainRoutine" $plantST)
$(New-ProgramXml "P_Beverage" "R_Beverage" $bevST)
$(New-ProgramXml "P_Automotive" "R_Automotive" $autoST)
$(New-ProgramXml "P_Food" "R_Food" $foodST)
$(New-ProgramXml "P_Molding" "R_Molding" $moldST)
$(New-ProgramXml "P_Pharma" "R_Pharma" $pharmaST)
$(New-ProgramXml "P_Film" "R_Film" $filmST)
$(New-ProgramXml "P_Coil" "R_Coil" $coilST)
</Programs>
<Tasks>
<Task Name="MainTask" Type="PERIODIC" Rate="500" Priority="10" Watchdog="2500" DisableUpdateOutputs="false" InhibitTask="false">
<ScheduledPrograms>
<ScheduledProgram Name="MainProgram"/>
</ScheduledPrograms>
</Task>
</Tasks>
<CST MasterID="0"/>
<WallClockTime LocalTimeAdjustment="0" TimeZone="0"/>
<Trends/>
<DataLogs/>
<TimeSynchronize Priority1="128" Priority2="128" PTPEnable="false"/>
<EthernetPorts>
<EthernetPort Port="1" Label="1" PortEnabled="true"/>
<EthernetPort Port="2" Label="2" PortEnabled="true"/>
</EthernetPorts>
<EthernetNetwork SupervisorModeEnabled="false" SupervisorPrecedence="0" BeaconInterval="400" BeaconTimeout="1960" VLANID="0"/>
</Controller>
</RSLogix5000Content>
"@

# Write without BOM — try several filenames (Studio often locks open L5X files)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$targets = @($outPathAlt3, $outPath, $outPathAlt2, $outPathAlt)
$written = $false
foreach ($t in $targets) {
    try {
        [System.IO.File]::WriteAllText($t, $l5x, $utf8NoBom)
        Write-Host "Wrote $t ($([math]::Round((Get-Item $t).Length/1KB,1)) KB)"
        $written = $true
        break
    } catch {
        Write-Host "Locked: $t"
    }
}
if (-not $written) { throw "Could not write any L5X. Close Studio locks and retry." }
