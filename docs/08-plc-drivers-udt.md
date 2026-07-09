# 08 - PLC Drivers & UDT Support

## Driver abstraction layer

A modular `IPlcDriver` interface so new drivers can be added without touching the rest of the system. Planned future drivers: OPC UA, Modbus TCP, Siemens S7.

Driver responsibilities:

- Read tags (run state, counts, fault code, etc.); live throughput rate is computed from counts + run time.
- Optional write tags: start permissive bit, reset/acknowledge bits.
- Tag enumeration/browsing when supported (see 09).
- Report connection state and handle communication loss gracefully (reconnect, mark stale).
- Support multiple PLCs per line or machine.

A **Driver Manager** supervises driver instances, polling, and connection health, feeding the ingestion/OEE engine.

## Mock / Simulator driver (ships first)

- Simulates run state, counts, speed, fault codes, and UDT-based values.
- Enables full development and demos without hardware.
- Supports UDT-based simulation mode.

## Rockwell EtherNet/IP driver (libplctag) — implemented

- `ConnectOEE.Drivers.RockwellDriver` (libplctag 1.5.x, `Protocol.ab_eip`). Supports ControlLogix / CompactLogix / GuardLogix (`PlcType.ControlLogix`), Micro800, MicroLogix, SLC500, PLC-5, Omron via the `PlcKind` option.
- Implements `IPlcDriver` (read mapped signals → `SignalReading`), `ITagBrowsingDriver` (controller `@tags` listing + `@udt/<id>` UDT enumeration into the hierarchical browse tree), and `IControllableDriver` (narrow audited writes: `StartPermissive` holds an enable bit, `Reset`/`Ack` pulse a bit; the PLC program owns interlocks).
- Connection health: `Connected → Stale → Faulted` based on consecutive read failures, surfaced per driver via `DriverRegistry` to the Admin **System** tab.
- **Multi-PLC per line:** `DriverFactory` builds one driver per enabled `PlcConnection` from its tag mappings; machines not covered by a real connection fall back to the Mock simulator so the platform always has live data. Control-tag mappings live in `MachineControlMap` (per machine + `PlcCommand`).
- **Deferred:** live read/write verification against physical hardware (pending a controller). With no PLC reachable the driver reports `Faulted` and yields no readings; everything else keeps running.

## Downtime reason catalog — implemented

- Map numeric PLC stop codes to human-readable descriptions via `FaultCodeMap` (Admin → **Downtime Reasons**; machine-specific wins over line-level).
- Optional **Downtime Reason** signal (`SignalRole.DowntimeReason`): when bound, each stop records code + text on `DowntimeEvent`.
- Unknown codes are **auto-stubbed** in the catalog (`IsAutoCreated`, `NeedsReview`) with placeholder text; supervisors complete description and loss category in Admin.
- Initial category/kind for stubs uses `RockwellFaultCatalog` banding once at creation time.
- Operator manual reason entry applies only when the signal is unbound or the PLC sends code 0.

## Standard machine signals

Each machine exposes logical **signal roles** mapped to PLC tags (or mock values):

| Role | Purpose |
|------|---------|
| `RunState` | Running / idle / down / etc. |
| `GoodCount` | Good parts (cumulative or pulse) |
| `RejectCount` | Rejects/scrap (cumulative or pulse) |
| `ReworkCount` | **Optional** — parts sent to rework (cumulative or pulse); used for true FPY (good should be first-pass only) |
| `DowntimeReason` | **Optional** — numeric PLC stop reason; auto-cataloged when unknown |
| `PartId` / `ProductCode` | Current product/run context |

`ReworkCount` is optional — when unmapped, rework defaults to zero and FPY equals yield.

**Live throughput (pph)** is not a mapped PLC signal. ConnectOEE computes `actualRatePph` from shift good+reject counts and run time (see 06).

## UDT support (required, across all layers)

- Parse UDT structures and nested UDTs.
- Display UDTs in the tag browser as hierarchical trees (see 09).
- Live value preview for UDT members.
- Bind logical signals to UDT members.
- Bind WYSIWYG widgets to UDT members.
- Support UDT arrays and nested arrays.
- Flatten UDTs for historian storage (`UdtMember` flattened path).
- Support UDT-based fault code fields.
- Support UDT-based simulation mode (mock driver).
