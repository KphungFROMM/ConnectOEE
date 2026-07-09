# ConnectOEE

On-prem, fully browser-based OEE (Overall Equipment Effectiveness) Accelerator for Windows.
Real-time OEE, KPI/downtime analytics, multi-plant hierarchy, PLC connectivity (Rockwell
EtherNet/IP first, Mock driver for dev), WYSIWYG dashboards, kiosk displays, guided setup
wizard, historian, and reporting.

> Project memory and design docs live in [`AGENTS.md`](AGENTS.md) and [`docs/`](docs/).
> The build roadmap (source of truth for sequencing) is [`docs/14-roadmap-phases.md`](docs/14-roadmap-phases.md).

## Tech stack

| Layer | Choice |
|-------|--------|
| Backend | .NET 8 (ASP.NET Core), hostable as a Windows Service |
| Frontend | React 18 + TypeScript + Vite + Mantine |
| Database | PostgreSQL 16 + TimescaleDB (Docker for dev) |
| Real-time | SignalR |
| Auth | ASP.NET Core Identity + JWT |
| Logging | Serilog |

## Prerequisites

- Docker Desktop (for the dev database)
- .NET SDK 8 or newer (the .NET 10 SDK builds `net8.0`)
- Node.js 20+
- Git

## Quick start (development)

```powershell
# 1. Copy env defaults and start the database (TimescaleDB on host port 5433)
Copy-Item .env.example .env
docker compose up -d

# 2. Apply database migrations
dotnet tool install --global dotnet-ef   # once, if not installed
dotnet ef database update --project src/ConnectOEE.Infrastructure --startup-project src/ConnectOEE.Api

# 3. Run the backend API (http://localhost:5080, Swagger at /swagger)
dotnet run --project src/ConnectOEE.Api --urls http://localhost:5080

# 4. In a second terminal, run the frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api`, `/hubs`, and `/health` to the backend on `:5080`.

Or start everything with the helper script:

```powershell
./scripts/dev.ps1
```

## Health checks

- `GET /health` - liveness (process is up)
- `GET /health/ready` - readiness (database reachable)

## Repository layout

```
src/
  ConnectOEE.Api/             ASP.NET Core host, controllers, SignalR hubs, SPA serving
  ConnectOEE.Core/            Domain entities, enums, interfaces, OEE math
  ConnectOEE.Infrastructure/  EF Core (Npgsql) DbContext, Identity, migrations
  ConnectOEE.Drivers/         IPlcDriver abstraction + Mock/Rockwell drivers
  ConnectOEE.Historian/       Rollups, retention, query engine
  ConnectOEE.Reporting/       PDF (QuestPDF) + CSV reports
tests/
  ConnectOEE.Tests/           Unit/integration tests
frontend/                     Vite + React + Mantine SPA
docker/initdb/                First-run SQL (enables TimescaleDB extension)
docs/                         Design docs and roadmap
```

## Notes

- Secrets/local config (`.env`, `appsettings.Development.local.json`) are gitignored.
  Copy the `*.example` files to create local versions.
- The `Logix Simulator/` folder (if present) is for manual PLC testing only and is never
  referenced in code.
