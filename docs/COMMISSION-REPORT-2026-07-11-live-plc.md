# ConnectOEE Commission Report — Live PLC 2026-07-11

**Auditor role:** software tester / commissioning auditor  
**Target:** Greenfield install → full Connect Demo Plant against **192.168.1.21**  
**Stack:** API `:5080`, Vite `:5173`, Postgres Docker `:5433`  
**Admin:** `admin` / `ChangeMe!123` (Personal — Development license)

## Verdict

**PASS with defects noted.** Hierarchy, PLC connection, tag maps, System commissioning checks, Explorer, and Operator Station are live against the Rockwell controller. One ingest bug blocked live OEE until fixed mid-audit; PartId STRING decode is fixed in the Rockwell driver (see D2).

## Plant commissioned

```
Connect Demo Plant (SIM)
└── Production
    ├── Beverage Line (Continuous · pacing Filler · output Labeler) — 4 machines
    ├── Automotive Line (Continuous · output Test) — 3 machines
    ├── Food Line (Continuous · output Packer) — 3 machines
    ├── Molding Line (Independent) — Press 1, Press 2
    ├── Pharma Line (Continuous · output Cartoner) — 3 machines
    ├── Film Converting Line (Continuous · pacing Slitter · output Rewind) — 4 machines
    └── Metal Coil Line (Continuous · pacing Shear · output Recoil) — 4 machines
```

**23 machines**, **186 tag mappings**, **38 dashboards**, **3×8 Fixed** shift pattern assigned.

## PLC / tag discovery

| Check | Result |
|-------|--------|
| Ping 192.168.1.21 | Pass (TTL 64, ~4 ms) |
| Test connection (`RockwellEthernetIp`, path `1,0`) | Pass — Logix, **151** controller tags listed |
| Driver status after map | **Connected** — Polling **186** tag(s), 23 machines |
| Tag roots present | `Bev_*`, `Auto_*`, `Food_*`, `Mold_*`, `Pharma_*`, `Film_*`, `Coil_*` (ConnectOEE_Sim) |
| Mapping style | DirectEnum `*.RunState`; CumulativeDelta `*.Counters.*`; `*.FaultCode`; `*.PartId` STRING |

Full inventory: [commissioning-screenshots/2026-07-11-live-plc/tag-inventory-full.csv](commissioning-screenshots/2026-07-11-live-plc/tag-inventory-full.csv)

## System commissioning (all lines)

| Line | Topology | Ready |
|------|----------|-------|
| Automotive Line | Continuous | Yes |
| Beverage Line | Continuous | Yes |
| Film Converting Line | Continuous | Yes |
| Food Line | Continuous | Yes |
| Metal Coil Line | Continuous | Yes |
| Molding Line | Independent | Yes |
| Pharma Line | Continuous | Yes |

Blocking checks verified via API (`runStateMapped`, `goodCountMapped`, `kioskBound`, `plcHealthy`): **all green**.

## Live product audit

| Surface | Result |
|---------|--------|
| Admin → PLC | ConnectOEE_Sim Connected @ 192.168.1.21 |
| Admin → Tag Mapping | Browse shows live UDT values; Run State + Good Count mapped |
| Plant Explorer Beverage | Running · 4/4 children · LIVE |
| Plant Explorer Molding | Running · Independent presses · LIVE |
| Operator Station | 23 stations RUNNING with incrementing Good counts |
| Live pipeline (System) | Connected 23 / Stale 0 / Disconnected 0 |
| Dashboards | 38 boards generated (Andon / Operator / Production / Quality / Supervisor per line) |

Screenshots: [commissioning-screenshots/2026-07-11-live-plc/](commissioning-screenshots/2026-07-11-live-plc/)

## Defects found

### D1 — CRITICAL (fixed during audit): ingest EF tracking crash

**Symptom:** PLC reported Connected and polling 186 tags, but Explorer/Operator stayed Offline / empty snapshots. API log:

`InvalidOperationException: MachineProductionState cannot be tracked because another instance with the same key value for {'MachineId'} is already being tracked`  
at `IngestionService.PersistCounterStateAsync`.

**Cause:** Same poll batch — `RecipeResolverService` may `Add` a `MachineProductionState`, then `PersistCounterStateAsync` attempted a second `Add` for the same `MachineId`.

**Fix shipped:** check `_db.MachineProductionStates.Local` before `Add` in [`IngestionService.cs`](../src/ConnectOEE.Api/Live/IngestionService.cs). After restart, all 23 machines published Connected snapshots.

### D2 — MEDIUM (fixed): PartId STRING not decoded by Rockwell driver

**Symptom:** Auto-created recipe code `9.80908925027372E-45` when STRING `PartId` tags returned empty `TextValue` and numeric noise in `Value`. Tag Mapping preview showed blank/`—` for `Auto_Weld.PartId` while Studio 5000 showed `'FRM-A12'`.

**Root cause:** `RockwellDriver` discovered CIP STRING types but never called libplctag `GetString`; `FormatDisplay` returned `"-"` and `PollAsync` omitted `TextValue`.

**Fix:** Decode STRING via `Tag.GetString(0)` (with Logix LEN+DATA fallback), pass text through preview display and `SignalReading.TextValue` so recipe resolution sees PartIds like `FRM-A12`.

**Mitigation retained:** PartId ingest still prefers `TextValue` and only accepts integer-like numeric fallbacks (no scientific-notation SKUs).

### D3 — LOW: `mappedTagCount` always 0 on `/api/plc/status`

Status shows `Polling 186 tag(s)` but `mappedTagCount: 0`. Cosmetic / telemetry bug — does not block polling.

### D4 — LOW: `commission-sim-plant.ps1` encoding parse errors

Script failed to run under PowerShell (smart-dash / string parse). Commission used an inline equivalent. Repair the script for future one-click demos.

### D5 — INFO: Availability % near 0 early after connect

Shift window is long (Swing); tracked uptime starts at connect. OEE looks low until the shift accumulates run time — expected for a mid-shift greenfield attach, not a mapping failure.

## Procedure used

1. Purged obsolete screenshot packs under `docs/*screenshots*`.
2. `scripts/reset-fresh-install.ps1` → `needsSetup: true`.
3. Wizard UI: bootstrap admin + plant form screenshots.
4. API commission: plant / 7 lines / 23 machines / Rockwell @ 192.168.1.21 / tag maps / shifts / generate dashboards.
5. Hit D1 → fixed ingest → restarted API → verified live.
6. Captured Explorer / Operator / System / Dashboards screenshots.
7. Authored this report + help outline + brochure draft.

## Credentials / URLs

| Item | Value |
|------|-------|
| UI | http://localhost:5173 |
| API | http://localhost:5080 |
| Admin | admin / ChangeMe!123 |
| PLC | 192.168.1.21 path `1,0` RockwellEthernetIp |
| Connection name | ConnectOEE_Sim |
