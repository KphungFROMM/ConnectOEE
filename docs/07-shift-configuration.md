# 07 - Shift Configuration & Handling

Shifts are a core time dimension: nearly every aggregate, report, and downtime/loss attribution is bucketed by shift, so the engine needs robust shift modeling and runtime handling.

## Configuration

- **Shift patterns** - reusable templates (e.g. 3x8 fixed, 2x12 day/night, DuPont/continental rotations, single-shift, 24/7). A pattern contains ordered shift definitions.
- **Shift definitions** - name, start/end time, **cross-midnight handling** (a shift ending 06:00 next day), color/label, and configurable **break/lunch windows** (optionally excluded from planned/available time).
- **Per-scope assignment** - patterns assigned to a plant or line with an **effective date range**, so schedules can change over time without rewriting history. Lines can override the plant default.
- **Calendar** - working days vs non-working days, holidays, and **planned-downtime / no-production windows** (excluded from the Availability denominator per OEE convention).
- **Time zone & DST** - shifts evaluated in the plant's local time zone with correct DST roll-forward/back; data stored in UTC with shift labels resolved on bucket.
- **Crews/rotation (optional)** - assign crews to shifts for operator/crew-level OEE and downtime attribution.

## Runtime handling

- A **shift resolver** determines the active `ShiftInstance` for any timestamp/line, materializing instances ahead of time and at shift boundaries.
- **Shift-boundary events** - at each rollover the engine closes the prior `ShiftInstance` (finalizes shift OEE/counts/downtime), opens the next, and emits a SignalR event so dashboards reset shift tiles live and the daily/shift report can fire.
- **Counter handling at boundary** - shift-scoped good/reject/downtime computed as deltas so a continuously running line attributes production to the correct shift even across midnight.
- **Downtime spanning a boundary** - a stop crossing a shift change is split and attributed proportionally to each shift.
- Mid-shift config changes are versioned (effective-dated) and never retro-rewrite already-closed shift aggregates.

## UI

- Wizard Step 8 and an Admin "Shifts" screen: build/edit patterns, definitions, breaks; assign to plant/line; manage calendar/holidays; preview the resolved weekly schedule grid; assign crews.
- Current shift + time-remaining shown in dashboard context/header.

## Open defaults (confirm)

- Breaks default to **excluded** from available/planned time (so they do not count as downtime).
- Crew/rotation model is **optional** and can be deferred to a later phase.
