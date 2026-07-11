# 06 - OEE Engine: Rich Metrics & Downtime Analytics

Beyond core A/P/Q/OEE, the engine computes a full reliability and loss-analysis metric set, calculated live and persisted at every rollup tier (hour/shift/day/week/month) so they are queryable, trendable, and reportable.

> Note: "MLTD" is not a standard acronym; it is assumed below to mean **Mean Lost Time per Downtime**. Confirm if a different metric was intended.

## Core OEE & production

- **Availability %**, **Performance %**, **Quality %**, **OEE %**.
- **TEEP %** (adds calendar/loading utilization).
- Good / Reject / **Rework** / Total counts, **Scrap %**, **Yield %**, **FPY** (first-pass yield: good / (good + reject + rework); good count should be first-pass only).
- Ideal vs actual cycle time, actual rate vs ideal rate.
- **Actual rate (pph)** is computed live as `(good + reject) / run time` for the shift — not read from a PLC Speed tag.
- **Ideal cycle resolution (live)**: `LineProductRate` for (line, product) → `ProductRecipe` default → line `OeeConfig` fallback. Performance % = `(idealCycle × totalCount) / runTime`. Live snapshots expose `idealCycleSource` (`line-rate`, `product-default`, `line-default`) so Explorer/Operator can show which tier is active.
- **Three-tier model (do not confuse layers)**:
  1. **Line speeds** (`LineProductRate`) — per-line capability for an active SKU (e.g. PKG-STD at 1.66 s on Line 1).
  2. **Product catalog** (`ProductRecipe.IdealCycleTimeSec`) — plant-wide engineering default (e.g. PKG-STD at 1.8 s).
  3. **Line fallback** (`OeeConfig.IdealRatePerHour` / `IdealCycleTimeSec`) — used when no product is active or cycle is unknown (e.g. 2168 pph ≈ 1.66 s only when that is the stored fallback, not when a faster line-speed override is resolving live).
- **Line operating profile** (`OeeConfig.ProductionMode`): `MultiProduct` (default), `DedicatedProduct` (single-SKU line — keep fallback aligned with that product’s line speed), `NoProductTracking` (performance uses line fallback only).
- **Line topology** (`OeeConfig.Topology`):
  - **`Independent`** (default): machines are parallel peers. Line rollups **sum** good/reject and **average** A/P (Explorer, dashboards, historian, closed shift).
  - **`Continuous`**: product feeds A→B→C. Line good/reject come from the **output machine** (`LineOutputMachineId`, default = last by `SequenceIndex`). Performance uses the **pacing machine** (`PacingMachineId`, default = output). Live A uses the **minimum** station availability; status remains worst-child. Map Good/Reject primarily on the output station in Tag Mapping.
  - Shared helper: `LineKpiRollup` / `LineTopologyResolver` — one definition for hierarchy tree, `GET /api/live/line/{id}/rollup`, historian Line scope, and shift close.
- **Industry examples**:
  - *Mixed-product line*: catalog defaults per SKU; line speeds tune each SKU per line; fallback used between changeovers or when PartId is missing.
  - *Dedicated single-SKU line*: one catalog entry; line speed often matches catalog; fallback synced to that product.
  - *No product tracking*: catalog and line speeds unused; only line fallback drives performance.
  - *Same SKU, different lines*: one catalog entry (1.8 s); Line 1 line speed 1.66 s (2169 pph live ideal); Line 2 may differ.
- **Changeover modes** (`OeeConfig.ChangeoverMode`):
  - **`SetupTracked`** (default): when the running product changes (PLC PartId or manual selection), the engine closes/opens `ProductionRun`, updates ideal rate, and auto-starts a **planned** downtime event (`SetupAndAdjustment`, reason `Changeover: A → B`); it auto-closes when the line returns to **Running**.
  - **`LogOnly` (quick changeover)**: product changes still close/open `ProductionRun` and write audit entries, but **no** auto downtime events are created. Use on lines where SKU swaps do not require tracked setup time.
- **`ProductionRun` as changeover log**: each open/closed run segment records which product was active and when. Recent segments are exposed via `GET /api/hierarchy/lines/{id}/production-context` for Explorer and Operator UI.
- **Operator-assigned changeover**: tagging an **existing stop** with a Changeover reason **labels the stop only** — it does not change the line's active product. For **live or recent** stops (line down now, or stop ended within ~60 minutes), the UI may offer an optional product picker with **Skip** (default) or **Apply product** when the operator actually switched SKU. **Backfilled** end-of-shift queue cleanup saves the reason only (no product modal). Deliberate SKU changes remain on the **Product strip** in Operator/Explorer. Manual product apply still respects `ChangeoverMode` (`SetupTracked` vs `LogOnly`); it does not create a second auto changeover event on `LogOnly` lines when only the reason is assigned.
- **Performance loss** and **availability loss** minutes (loss attribution by Six Big Losses).

### ConnectOEE-owned counting

ConnectOEE is the **authoritative source** for good/reject production counts used in live OEE, dashboards, historian roll-ups, and closed-shift aggregates. PLC tags are **inputs only**:

- **Cumulative delta (default)** — monotonic DINT/INT counters; the engine computes increments since the last sample. If the PLC counter drops (operator reset), the drop is detected, logged, and **shift totals are not reduced** — only fresh increments after the reset are added.
- **Pulse (rising edge)** — BOOL tags that pulse once per part; ConnectOEE counts +1 on each false→true transition.
- **Shift scope** — shift good/reject totals reset only on **shift boundary**, never because the PLC was reset.
- **Persistence** — `MachineProductionState` stores shift/lifetime totals and ingest bookkeeping so counts survive API restarts (with historian sum as fallback).

Live snapshots and OEE inputs always use ConnectOEE shift totals, not raw PLC cumulative values.

## OEE vs target (gap metrics)

Line `OeeConfig` stores independent targets for OEE and each factor:

| Field | Default | Purpose |
|-------|---------|---------|
| `TargetOeePct` | 85 | Headline OEE goal |
| `TargetAvailabilityPct` | 90 | Availability target |
| `TargetPerformancePct` | 95 | Performance target |
| `TargetQualityPct` | 99 | Quality target |

Computed gap fields (actual − target, negative = below target):

- `oeeGapPct` = OEE − TargetOee
- `availabilityGapPct` = A − TargetA
- `performanceGapPct` = P − TargetP
- `qualityGapPct` = Q − TargetQ

Plant/line roll-ups **recompute** gaps from rolled-up A/P/Q/OEE vs line targets — they do not average per-machine gap values.

## Production attainment (run + shift)

Attainment uses **good count only** (rejects/rework do not count toward order fulfillment).

**Run target** resolution (active order/SKU segment), same tier model as ideal cycle:

1. `ProductionRun.TargetQuantity` (open run on the line)
2. `LineProductRate.TargetQuantity` for (line, active product)
3. `ProductRecipe.TargetQuantity`

**Shift target** resolution:

1. `ProductionSchedule.TargetQuantity` overlapping the current shift window for the line

Computed when the respective target &gt; 0:

| Field | Formula |
|-------|---------|
| `runAttainmentPct` | Good ÷ Run target × 100 |
| `runPartsRemaining` | max(0, Run target − Good) |
| `shiftAttainmentPct` | Good ÷ Shift target × 100 |
| `shiftPartsRemaining` | max(0, Shift target − Good) |
| `theoreticalOutput` | floor(Run time ÷ Ideal cycle) |
| `outputGap` | Theoretical output − Total count |

Snapshots expose `runTargetQuantitySource` / `shiftTargetQuantitySource` strings (mirrors `idealCycleSource`).

## Production parts loss (ideal-rate parts)

Computed when resolved ideal cycle > 0. Converts OEE time losses into parts using `ideal rate (pph) = 3600 ÷ ideal cycle`.

| Field | Formula |
|-------|---------|
| `maxPossibleParts` | floor(Planned time ÷ Ideal cycle) |
| `expectedPartsPace` | Ideal rate × elapsed shift hours |
| `theoreticalOutput` | floor(Run time ÷ Ideal cycle) |
| `partsLostAvailability` | Availability loss min × ideal pph ÷ 60 |
| `partsLostPerformance` | Performance loss min × ideal pph ÷ 60 |
| `partsLostQuality` | Reject count |
| `partsLostBreakdown` | Down state sec ÷ ideal cycle (live) or breakdown downtime sec ÷ cycle (historian) |
| `partsCouldHaveMade` | Good + parts lost (A + P + Q) |
| `outputGapParts` | Theoretical output − Total count |

Historian: `GET /api/historian/production-parts-loss` returns summary + per-category parts. `KpiSnapshot.partsLoss` mirrors live snapshot fields.

## Derived rates & rework policy

| Field | Formula |
|-------|---------|
| `utilizationPct` | Planned production time ÷ All calendar time × 100 |
| `cycleVariancePct` | (Actual cycle − Ideal cycle) ÷ Ideal cycle × 100 |
| `reworkPct` | Rework ÷ (Good + Reject + Rework) × 100 **when rework tracking active** |

**Rework tracking** (`OeeConfig.ReworkTracking`):

| Mode | Behavior |
|------|----------|
| `Off` | Ignore rework for KPIs; snapshot `reworkCount` forced to 0; `fpyPct = yieldPct`; hide rework mapping in Admin |
| `Auto` (default) | Active when **any machine on the line** has `ReworkCount` mapped |
| `On` | Always show rework KPIs (count stays 0 if unmapped) |

When rework is inactive, FPY falls back to yield so operators are not misled by a rework-based FPY without data.

## Run-state time breakdown

Per-state accumulators track minutes in each PLC run state **without changing OEE math** (only `Running` accrues run time for A/P/Q).

| Snapshot field | Run states |
|----------------|------------|
| `idleMin` | Idle |
| `downMin` | Down (faulted) |
| `setupMin` | Setup |
| `starvedMin` | Starved |
| `blockedMin` | Blocked |
| `unknownMin` | Unknown |
| `uptimeMin` / `plannedDowntimeMin` | Running / PlannedDown (unchanged) |

Optional `*Pct` fields express each bucket as a share of (uptime + all downtime minutes) for the shift.

**vs Six Big Losses:** state breakdown shows **where time went by machine state** (Idle, Starved, Blocked…). Six Big Losses categorize **why** production was lost (breakdown, setup, reduced speed, etc.). Both are useful together.

**PLC requirement:** full breakdown needs distinct states from the PLC (enum INT or MultiBool). SingleBool lines degrade to Running vs everything else.

Historian: `GET /api/historian/state-breakdown` aggregates `ts_states` over a date range; KPI snapshot/trend include extended gap, utilization, cycle variance, and attainment fields where targets are known.

## Reliability / downtime metrics

Computed per machine, line, shift, reason, and fault code:

- **MTTR** - Mean Time To Repair (total down duration / number of downtime events).
- **MTBF** - Mean Time Between Failures (total uptime / number of failures).
- **MTTF** - Mean Time To Failure (non-repairable / first-failure framing).
- **MTTD** - Mean Time To Detect/acknowledge (event start -> operator acknowledgment).
- **Mean Lost Time per Downtime (assumed "MLTD")** - average lost production time per stop.
- **Failure rate (lambda)** and **availability from reliability** = MTBF / (MTBF + MTTR).
- Downtime **frequency** (stops/hour), **MTBF vs MTTR trend**, planned vs unplanned downtime split.

## Downtime breakdowns & loss model

- **Six Big Losses** categorization: breakdowns, setup/adjustments, small stops, reduced speed, startup rejects, production rejects.
- Top reasons / top categories, Pareto analysis.
- Downtime by shift / operator / machine / reason / fault code.
- Micro-stop vs major-stop classification (configurable threshold).
- Unattributed-downtime tracking.

## Surfacing

These metrics are:

- Broadcast on the live **`MachineSnapshot`** (SignalR + `/api/live`): OEE/A/P/Q/TEEP, good/reject/**rework** counts, scrap/yield/fpy, full reliability cluster (MTTR/MTBF/MTTF/MTTD, mean lost time, failure rate, stops/hour, availability from reliability), downtime event count, **micro-stop count**, **shift-to-date uptime/downtime minutes** (planned + unplanned split, **uptime %**), **availability/performance/quality loss minutes**, **actual vs ideal cycle time**, **actual vs ideal rate (pph)**, **rate variance %**, **`idealCycleSource`**, **OEE/A/P/Q targets and gap %**, **utilization %**, **cycle variance %**, **rework %** (when active), **run/shift attainment** and parts remaining, and **per-state time breakdown** (idle/down/setup/starved/blocked/unknown minutes).
- Exposed via historian trend (`/api/historian/trend`) and **reliability trend** (`/api/historian/reliability-trend`) with uptime/planned/unplanned/micro-stop buckets.
- **Operator downtime rollups** via `GET /api/events/downtime-by-operator?lineId|plantId&from&to`.

`/api/shifts/current` accepts `lineId` or `plantId` (plant roll-up sums downtime minutes across all lines).

## Implementation notes

- Metrics are computed live in the ingestion/OEE engine and persisted per rollup tier.
- Shift-boundary handling (see 07) ensures correct bucketing across midnight and shift changes.
- Comment non-obvious math: availability vs performance loss attribution, ideal-rate derivation, fault debounce.
