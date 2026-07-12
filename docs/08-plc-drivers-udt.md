# 08 - PLC Drivers & UDT Support

## Driver abstraction layer

A modular `IPlcDriver` interface so new drivers can be added without touching the rest of the system. Planned future drivers: Siemens S7.

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
- Implements `IControllableDriver` (`SupportsControl = true`): `Ack` clears the fault latch and returns Down/Setup → Running; `Reset` clears fault and parks Idle; `StartPermissive` holds an in-memory enable bit (blocks auto-recovery when false). Raw `WriteTagAsync` stores values in memory. `DriverRegistry.ControllableFor` returns the mock when a machine is on the simulator, so Operator Station / PLC control widgets round-trip without hardware.

## Rockwell EtherNet/IP driver (libplctag) — implemented

- `ConnectOEE.Drivers.RockwellDriver` (libplctag 1.5.x, `Protocol.ab_eip`). Supports ControlLogix / CompactLogix / GuardLogix (`PlcType.ControlLogix`), **MicroLogix** (`DriverType.RockwellMicroLogix` → `PlcType.MicroLogix`), and **Micro800** (`DriverType.RockwellMicro800` → `PlcType.Micro800`, no CIP path). SLC / PLC-5 kinds are mapped in code but not yet enabled in the Admin driver picker.
- Implements `IPlcDriver` (read mapped signals → `SignalReading`), `ITagBrowsingDriver` (Logix / Micro800: controller `@tags` + UDT expansion where supported; **MicroLogix**: dynamic PCCC discovery — probe file numbers 0–255 per type (`N`/`B`/`F`/`T`/`C`/`R`/`MG`/…), plus `O`/`I`/`S2`, then expose bindable leaves like `N7:0`, `B3:0/0`, `T4:0.ACC`), and `IControllableDriver` (narrow audited writes: `StartPermissive` holds an enable bit, `Reset`/`Ack` pulse a bit; the PLC program owns interlocks).
- Connection health: `Connected → Stale → Faulted` based on consecutive read failures, surfaced per driver via `DriverRegistry` to the Admin **System** tab. Admin → **PLC Connections** also has **Test connection**, which probes form fields without saving — Logix / Micro800 via `@tags`, MicroLogix via a PCCC read of `N7:0` (fallback `B3:0`). Live poller health still requires mapped signals.
- **Multi-PLC per line:** `DriverFactory` builds one driver per enabled `PlcConnection` from its tag mappings; machines not covered by a real connection fall back to the Mock simulator so the platform always has live data. Control-tag mappings live in `MachineControlMap` (per machine + `PlcCommand`).
- **Deferred:** SLC / PLC-5 enablement in the UI picker.

## Modbus TCP driver (FluentModbus) — implemented

- `ConnectOEE.Drivers.ModbusTcpDriver` (`DriverType.ModbusTcp`) via FluentModbus. Connection fields: IP + TCP port (stored as `endpoint` `host` or `host:port`) and Unit ID (stored in `path`).
- **Test connection** probes holding register 0 on the configured unit.
- **Address map (Tag Mapping):** discovers live registers on the slave (scan holding/input up to offset 10000; coils/discretes when non-zero). Lists bindable classic addresses (`40001`, `30001`, `47003:f32`, …). Adjacent holding words that decode as a plausible IEEE float are shown as one Real. Manual entry still accepts `hr0` / `40001` / `c0` / `di0`.
- Live poll reads mapped addresses into `SignalReading`s; connection health follows the same Connected → Stale → Faulted pattern as Rockwell.

## OPC UA driver (OPC Foundation) — implemented

- `ConnectOEE.Drivers.OpcUaDriver` (`DriverType.OpcUa`) via OPC Foundation .NET Standard client. Connection field: full endpoint URL (e.g. `opc.tcp://127.0.0.1:50000`).
- Connects anonymously; prefers SignAndEncrypt, falls back to None. Untrusted server certs are auto-accepted for on-prem commissioning (PKI under `%LocalAppData%/ConnectOEE/opcua-pki`).
- **Test connection** opens a session and counts Objects children.
- **Address space (Tag Mapping):** hierarchical browse from Objects (skips the standard Server diagnostics tree). Bind NodeIds such as `ns=3;s=SlowUInt1` / `ns=3;s=FastUInt1`.
- **Dev simulator:** `docker compose up -d opcua-sim` runs Microsoft opc-plc on port 50000.

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

`PartId` is normally a Logix **STRING** (or integer code). The Rockwell driver decodes CIP STRING via libplctag (`GetString`) into `SignalReading.TextValue` so Tag Mapping preview and auto-recipe resolution see values like `FRM-A12` — not float noise from the STRING buffer.

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
