# Slow production to realistic rates using a 500ms TON gate in MainProgram
$ErrorActionPreference = "Stop"
$p = Join-Path $PSScriptRoot "Generate-ConnectOEESimL5X.ps1"
$c = [System.IO.File]::ReadAllText($p)

# 1) Point output to v6
$c = $c.Replace('ConnectOEE_Sim_v5.L5X', 'ConnectOEE_Sim_v6.L5X')

# 2) Replace machine timing catalog (500ms ticks → CycleMs = ticks/part)
$oldMachines = [regex]::Match($c, '(?s)\$machines = @\((.*?)\r?\n\)\r?\n\r?\nfunction Esc').Groups[1].Value
if (-not $oldMachines) { throw "Could not find machines catalog" }

$newMachines = @'

    # CycleMs = production ticks per part at 500ms Plant_ProdTimer (realistic pph)
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
'@

$c = $c.Remove($c.IndexOf($oldMachines), $oldMachines.Length).Insert($c.IndexOf($oldMachines), $newMachines)
# Fix - Remove/Insert with IndexOf of oldMachines after first replace may be wrong. Use regex instead.
$c = [System.IO.File]::ReadAllText($p)
$c = $c.Replace('ConnectOEE_Sim_v5.L5X', 'ConnectOEE_Sim_v6.L5X')
$c = [regex]::Replace($c, '(?s)\$machines = @\(.*?\)\r?\n\r?\nfunction Esc', "`$machines = @($newMachines`r`n)`r`n`r`nfunction Esc")

# 3) Use Cfg.CycleMs instead of literal 25; restore Cfg-based idle/break times; fault roll every 40 ticks (~20s)
$c = $c.Replace('IF $M.CycleMsAcc >= 25 THEN', 'IF $M.CycleMsAcc >= $M.Cfg.CycleMs THEN')
$c = $c.Replace('IF $M.StateMs >= 500 THEN', 'IF $M.StateMs >= 40 THEN')
$c = $c.Replace('IF $M.StateMs >= 80 THEN', 'IF $M.StateMs >= $M.Cfg.IdleMs THEN')
$c = $c.Replace('IF $M.StateMs >= 200 THEN', 'IF $M.StateMs >= $M.Cfg.BreakMs THEN')
# Setup states 4 and 5 both use 300 - replace carefully with SetupMs
$c = $c.Replace('IF $M.StateMs >= 300 THEN', 'IF $M.StateMs >= $M.Cfg.SetupMs THEN')

# 4) Replace plant running / guaranteed count block with 500ms TON gate
$oldPlantHead = [regex]::Match($c, '(?s)IF Plant_Running THEN.*?END_IF;\r?\n\r?\nPlant_Rng :=').Value
if (-not $oldPlantHead) { throw "Could not find plant head block" }

$newPlantHead = @'
IF Plant_Running THEN
    Plant_ProdTimer.PRE := 500;
    Plant_ProdTimer.TimerEnable := 1;
    TON(Plant_ProdTimer);
    IF Plant_ProdTimer.DN THEN
        Plant_ProdTimer.ACC := 0;
        Plant_ProdTick := 1;
        Plant_Tick := Plant_Tick + 1;
        Plant_SimHeartbeat := Plant_SimHeartbeat + 1;
    ELSE
        Plant_ProdTick := 0;
    END_IF;
ELSE
    Plant_ProdTimer.TimerEnable := 0;
    Plant_ProdTimer.ACC := 0;
    Plant_ProdTick := 0;
    TON(Plant_ProdTimer);
END_IF;

Plant_Rng :=
'@

$c = $c.Replace($oldPlantHead, $newPlantHead)

# 5) Wrap area simulators in Plant_ProdTick
$c = $c.Replace(
    '$plantST = $plantST + "`r`n`r`n// ===== AREA SIMULATORS (in MainProgram so they always scan) =====`r`n" + $bevST + "`r`n" + $autoST + "`r`n" + $foodST + "`r`n" + $moldST + "`r`n" + $pharmaST + "`r`n" + $filmST + "`r`n" + $coilST',
    '$plantST = $plantST + "`r`n`r`n// ===== AREA SIMULATORS (500ms production ticks) =====`r`nIF Plant_ProdTick THEN`r`n" + $bevST + "`r`n" + $autoST + "`r`n" + $foodST + "`r`n" + $moldST + "`r`n" + $pharmaST + "`r`n" + $filmST + "`r`n" + $coilST + "`r`nEND_IF;`r`n"'
)

# 6) Add TIMER + ProdTick tags after Plant_SimHeartbeat
if ($c -notmatch 'Plant_ProdTimer') {
    $c = $c.Replace(
        '<Tag Name="Plant_SimHeartbeat" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>',
        '<Tag Name="Plant_SimHeartbeat" TagType="Base" DataType="DINT" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="DINT" Radix="Decimal" Value="0"/></Data>
</Tag>
<Tag Name="Plant_ProdTick" TagType="Base" DataType="BOOL" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated"><DataValue DataType="BOOL" Value="0"/></Data>
</Tag>
<Tag Name="Plant_ProdTimer" TagType="Base" DataType="TIMER" Constant="false" ExternalAccess="Read/Write">
<Data Format="Decorated">
<Structure DataType="TIMER">
<DataValueMember Name="PRE" DataType="DINT" Radix="Decimal" Value="500"/>
<DataValueMember Name="ACC" DataType="DINT" Radix="Decimal" Value="0"/>
<DataValueMember Name="EN" DataType="BOOL" Value="0"/>
<DataValueMember Name="TT" DataType="BOOL" Value="0"/>
<DataValueMember Name="DN" DataType="BOOL" Value="0"/>
</Structure>
</Data>
</Tag>'
    )
}

# Scale changeover thresholds for 500ms ticks (~minutes)
$c = $c.Replace('ChangeoverMs > 8000', 'ChangeoverMs > 600')
$c = $c.Replace('ChangeoverMs > 10000', 'ChangeoverMs > 720')
$c = $c.Replace('ChangeoverMs > 12000', 'ChangeoverMs > 900')
$c = $c.Replace('ChangeoverMs > 7000', 'ChangeoverMs > 480')
$c = $c.Replace('Plant_Tick MOD 20000) > 18000', 'Plant_Tick MOD 720) > 660')

[System.IO.File]::WriteAllText($p, $c)
Write-Host "Patched for realistic 500ms timing"
Write-Host "TON=$($c -match 'TON\(Plant_ProdTimer\)') PRODTICK=$($c -match 'IF Plant_ProdTick THEN') CFGCYCLE=$($c -match 'CycleMsAcc >= \$M.Cfg.CycleMs')"
