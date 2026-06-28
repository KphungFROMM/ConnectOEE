# 08 - PLC Drivers & UDT Support

## Driver abstraction layer

A modular `IPlcDriver` interface so new drivers can be added without touching the rest of the system. Planned future drivers: OPC UA, Modbus TCP, Siemens S7.

Driver responsibilities:

- Read tags (run state, counts, speed, fault code, etc.).
- Optional write tags: start permissive bit, reset/acknowledge bits.
- Tag enumeration/browsing when supported (see 09).
- Report connection state and handle communication loss gracefully (reconnect, mark stale).
- Support multiple PLCs per line or machine.

A **Driver Manager** supervises driver instances, polling, and connection health, feeding the ingestion/OEE engine.

## Mock / Simulator driver (ships first)

- Simulates run state, counts, speed, fault codes, and UDT-based values.
- Enables full development and demos without hardware.
- Supports UDT-based simulation mode.

## Rockwell EtherNet/IP driver (libplctag)

- ControlLogix / CompactLogix via libplctag (.NET wrapper).
- Read/write supported tags (start permissive, reset/acknowledge - audited writes).
- UDT enumeration and member reads.
- Multiple PLCs per line/machine.

## Smart fault code detection & mapping

- Map numeric codes to human-readable reasons.
- Configurable per machine/line via `FaultCodeMap`.
- Drives fault summaries, downtime reasons, and Maintenance/Fault dashboards.

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
