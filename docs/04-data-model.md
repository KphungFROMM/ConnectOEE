# 04 - Data Model

Entities grouped by domain. All schema changes ship as EF Core migrations.

## Hierarchy

- `Plant`, `Department`, `Line`, `Machine`

## Connectivity

- `PlcConnection` - driver type, endpoint, slot/path.
- `TagDefinition` - controller/program tag metadata.
- `TagMapping` - binds a logical signal to a tag / UDT member.
- `UdtType`, `UdtMember` - UDT structure, nested members, flattened path.

## Signals / OEE config

- `LogicalSignal` - run state, good count, reject count, speed, fault code, optional **PartId** (recipe/SKU); `CountIngestMode` on count roles (cumulative delta vs pulse edge).
- `OeeConfig` - line **fallback** ideal rate/cycle (`IdealRatePerHour`, `IdealCycleTimeSec`), targets, micro-stop threshold, and `ProductionMode` (`MultiProduct`, `DedicatedProduct`, `NoProductTracking`). Admin Hierarchy edits this stored config — not the live-resolved ideal on the hierarchy tree KPI.
- `FaultCodeMap` - numeric code -> human-readable reason, per machine/line.
- **`ProductRecipe`** - plant-wide product/SKU catalog (`Code`, `Name`, `PlcAlias`, default `IdealCycleTimeSec`, `IsAutoCreated` for PLC stubs).
- **`LineProductRate`** - per-line ideal cycle override for a catalog product (same SKU, different line speeds). Takes priority over catalog default when a product is active on that line.

## Time / scheduling (see 07)

- `ShiftPattern` - named reusable pattern (3x8, 2x12, DuPont, etc.).
- `ShiftDefinition` - name, start/end, crosses-midnight flag, break windows, color.
- `ShiftAssignment` - which pattern applies to which plant/line, with effective date range.
- `ShiftCalendar` - working days, holidays, planned-downtime / no-production windows.
- `ShiftInstance` - materialized concrete shift occurrence used to bucket data.
- `ProductionSchedule`.
- `Crew`, `ShiftCrew` (optional) - crew rotation for operator/crew attribution.

## Security (see 05)

- `User`, `Role`, `Permission`, `RolePermission`, `UserPlantScope`.

## Events

- `DowntimeEvent` - includes reason/category and optional operator entry.
- `ProductionRun` - open/close on product change; `ProductId` is the active SKU code.
- `MachineProductionState` - software-owned shift/lifetime counters + ingest bookkeeping per machine; tracks `ActiveRecipeId`, `SoftwareRecipeId`, `ActiveProductionRunId`.
- `FaultOccurrence`.
- `StateTransition`.

## Time-series (TimescaleDB hypertables)

- `ts_counts`, `ts_states`, `ts_speeds`.
- Continuous aggregates: `oee_hourly`, `oee_shift`, `oee_daily`, `oee_monthly`. These also carry reliability/loss metrics (MTTR, MTBF, MTTF, MTTD, mean lost time per downtime, failure rate, loss minutes by category - see 06).

## Dashboards

- `Dashboard` - scope (private / role-restricted / public-kiosk), draft/published, version.
- `DashboardVersion` - version history for autosave + rollback.
- `Widget` - type, layout, data binding.
- `DashboardTemplate` - system/built-in vs user-saved, category, thumbnail, layout JSON, binding placeholders (instantiated against any line/machine by remapping placeholders).

## Reporting (see 12)

- `ReportTemplate` - system/built-in vs user-saved, category, layout/blocks JSON, parameter + binding placeholders (plant/line/machine, date range, shift).
- `ReportSchedule` - report template + parameters, cadence (daily/weekly/monthly), delivery (email/file drop), recipients/path.
- `ReportRun` - execution history, status, generated artifact path.
- `SmtpSettings` - host/port/credentials/from for email delivery.

## Audit

- `AuditLog` - user actions, PLC writes, config changes.
