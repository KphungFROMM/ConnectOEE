# 09 - Live Tag Browser & Tag Mapping

When the driver supports tag enumeration, provide a full live tag browser. When it does not, fall back to manual entry.

## Live tag browser features

- Hierarchical browsing of controller tags, program tags, AOIs, and UDTs.
- Expand/collapse tree structure (virtualized for large controllers).
- Live value preview with timestamp + quality.
- Search and filter by name or type.
- Metadata panel: type, path, array size, description.
- Bind tags to logical signals via UI.
- Bind tags to widgets in the WYSIWYG builder (Properties → Data → **PLC tag** mode, or add a **Live PLC Tag** widget).
- Real-time updates via SignalR.
- Fallback to manual entry if the driver does not support browsing.
- Only Admins/Supervisors can browse tags.

## Tag mapping UI

- Bind a discovered tag or UDT member to a `LogicalSignal` (run state, good count, reject count, **downtime reason**, part ID, etc.).
- **Throughput / rate** is not mapped — it is computed from counts and run time (`actualRatePph`).
- **Downtime Reason** (optional): bind an INT/DINT tag; unknown PLC codes appear in Admin → Downtime Reasons → **Pending review** for supervisor completion.
- For **count signals** (good / reject / total), choose **Count source**:
  - **Cumulative delta** (default) — DINT/INT counter; ConnectOEE tracks increments and detects PLC resets.
  - **Pulse (rising edge)** — BOOL tag; +1 per false→true transition.
- Validate type compatibility between tag and logical signal (Bool required for pulse mode).
- Show current live value while mapping for confidence.
- Persist as `TagMapping`; ingest mode is stored on `LogicalSignal.CountIngestMode`. Changes are audited.

## Operator downtime catalog

- Operators with `downtime.enter` load reasons via `GET /api/downtime-reasons/operator-catalog?lineId=` (optional `machineId` for machine-specific overrides).
- Admin catalog management (`tags.map`) supports optional per-machine reason mappings; operators see line-wide + machine overrides merged in the catalog.
- Free-text **Other** entry is available in the operator assign modal when no catalog button fits.

## UDT in the browser

- Nested UDTs render as expandable subtrees.
- UDT arrays and nested arrays are browsable and bindable.
- Member metadata and flattened historian path shown in the metadata panel.

See 08 for driver/UDT internals and 11 for widget binding.
