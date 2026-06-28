# 02 - Tech Stack (Chosen + Justified)

## Backend: .NET 8 (ASP.NET Core)

Best fit for on-prem Windows hosting:

- Runs as a native Windows Service (`Microsoft.Extensions.Hosting.WindowsServices`).
- Single self-contained publish, easy local deployment on a single port.
- First-class SignalR for real-time updates.
- Mature EF Core ORM with Npgsql for PostgreSQL.
- Strongest path to Rockwell EtherNet/IP via libplctag (.NET wrapper).
- High throughput for tag polling and time-series ingest.

## Frontend: React 18 + TypeScript + Vite

Largest ecosystem for the hard UI pieces this spec needs:

- Drag-and-drop dashboard builder (`dnd-kit` + `react-grid-layout`).
- Charts and gauges (ECharts / Recharts).
- Hierarchical, virtualized tag tree for the tag browser.
- Polished component system (default: Mantine) for zero-learning-curve UX, dark/light mode, touch-friendly industrial layout.

## Database: PostgreSQL 16 + TimescaleDB

- Hypertables for raw 1-5s time-series.
- Continuous aggregates for hourly / shift / daily / weekly / monthly rollups.
- Native compression + retention policies mapping directly to archiving tiers.
- Runs as a Windows service, no cloud, no license cost.

## Real-time: SignalR over WebSockets

- Native to .NET; hub groups for per-line / per-dashboard / per-tag subscriptions.
- Kiosks and builders only receive what they render.

## Auth: ASP.NET Core Identity + JWT

- JWT for app users; cookie option for kiosk mode.
- Custom RBAC permission layer on top (see 05).

## PLC: libplctag

- libplctag (.NET wrapper) for ControlLogix/CompactLogix.
- Behind a driver abstraction so OPC UA / Modbus TCP / Siemens S7 can be added later.
- A Mock/Simulator driver ships first for development and demos.

## Supporting libraries (planned defaults)

- Logging: Serilog.
- PDF reports: QuestPDF. CSV export: built-in/CsvHelper.
- Background jobs/scheduling: hosted services (and a scheduler for reports/rollups).
