# ConnectOEE — Commissioning QA Matrix

Repeatable checklist for greenfield installs and release verification. Dev stack: API `:5080`, Vite `:5173`, Postgres via Docker.

## Prerequisites

1. `docker compose up -d` (Postgres + TimescaleDB)
2. `.\scripts\reset-fresh-install.ps1` — clears tenant data, keeps roles/templates
3. Start API + frontend; open `http://localhost:5173/wizard`

## Greenfield wizard (10 steps)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Create admin | `needsSetup: false`; auto-login |
| 2–5 | Plant → dept → line → machine | Hierarchy saved; wizard progress advances |
| 6 | Mock PLC enabled for line | Connection visible in Admin → PLC |
| 7–8 | Tag mapping | Run State + Good Count on **every** machine |
| 9 | Shift pattern assigned | Current shift shown in header |
| 10 | Generate dashboards | **15** dashboards (10/line + 5 plant/kiosk) |

**Automation:** `.\scripts\greenfield-commission.ps1` performs the same flow via API after reset.

**Test users** (seeded after admin bootstrap): `supervisor`, `manager`, `operator` — password `ChangeMe!123` (**must change on first login**).

## Commissioning (Admin → System)

Per-line go/no-go checks:

| Check | Blocking | Notes |
|-------|----------|-------|
| Run State mapped (every machine) | Yes | Matches wizard step 7 |
| Run State BOOL ingest mode | Yes | Only when Run State is BOOL |
| Good Count mapped (every machine) | Yes | Per-machine, not any-one |
| Part ID mapped | No | Informational |
| Product catalog | No | Auto-stub available |
| Kiosk bound to line | Yes | Published kiosk with `lineId` |
| PLC driver connected for line | Yes | Line-scoped driver health |

**Ready for field connect** = all blocking checks green.

## Rockwell EtherNet/IP (live PLC)

| Check | Blocking | Notes |
|-------|----------|-------|
| Tag browse returns bindable leaves | Yes | `GET /api/tags/browse/leaves?connectionId=` |
| Run State + Good Count per machine (unique paths) | Yes | Not one global path for all machines |
| `GET /api/plc/status` → `Connected` | Yes | After mapping; wait ~12s for driver re-init |
| Wizard PLC step shows green or actionable fault detail | Yes | `statusDetail` on FAULTED connections |
| Operator grid not all OFFLINE | Yes | At least one line Connected |

**Automation:** `.\scripts\fromm-3line-commission.ps1` — fails if browse or PLC connect validation fails.

## Security commissioning (Admin → System)

Blocking checks before factory go-live (see [16-factory-deployment-security.md](16-factory-deployment-security.md)):

| Check | Blocking | Notes |
|-------|----------|-------|
| HTTPS enabled | Yes | Or TLS at IIS/nginx reverse proxy |
| Default passwords changed | Yes | No users with `MustChangePassword` |
| Admin MFA enabled | Yes | TOTP via `/api/auth/mfa/*` |
| Production JWT key set | Yes | Not the dev placeholder |

**Ready for factory LAN** = line commissioning **and** security commissioning green.

## Kiosk / display device setup

Wall PCs and Andon displays run **without login**:

1. In **Builder**, set dashboard scope to **Public Kiosk**, bind a **line**, and **publish**.
2. On the device, open ConnectOEE (`https://<host>/login` in production).
3. Use **Display a dashboard** — pick the Andon or Operator Kiosk board.
4. Click **Open and remember on this device** (establishes signed kiosk session cookie).
5. Tap the screen once to enter full-screen mode (browser gesture required).
6. Verify **Admin → System → Active kiosk displays** shows the session after ~30 seconds.

Operators who enter downtime reasons still **sign in** and use **Operator Station** (`/operator`).

## Route × role matrix

| Route | Admin | Supervisor | Manager | Operator | Kiosk |
|-------|-------|------------|---------|----------|-------|
| `/` Dashboards | ✓ | ✓ | ✓ | — | — |
| `/dashboards/:id` | ✓ | ✓ | ✓ | — | — |
| `/kiosk/:id` | anon | — | — | — | ✓ |
| `/builder` | ✓ | ✓ | deny | deny | — |
| `/plant-explorer` | ✓ | ✓ | ✓ | deny | — |
| `/analytics` | ✓ | ✓ | ✓ | deny | — |
| `/reports` | ✓ | ✓ | ✓ | deny | — |
| `/tags` | ✓ | ✓ | deny | deny | — |
| `/operator` | ✓ | ✓ | ✓ | ✓ | — |
| `/admin` | ✓ | deny | deny | deny | — |
| `/wizard` | ✓ | deny | deny | deny | — |

Verify **light + dark** theme on each accessible route; connection/shift header visible.

## Verification gate

```powershell
dotnet build
dotnet test tests/ConnectOEE.Tests --filter "FullyQualifiedName!~ShiftPatternSaveTests"
cd frontend; npm run build
```

Re-walk any failed browser items; confirm commissioning green on greenfield + existing plant lines.

## Known fixes (commission pass)

- **Setup detection:** `needsSetup` requires an Admin user (commission users alone do not complete setup).
- **Shift/historian ideal cycle:** time-weighted product-aware ideal via `IdealCycleResolver`.
- **DriverManager:** re-initializes when machines appear after wizard (no API restart required).
- **Dashboard copy:** v5 refresh messaging; wizard step 10 cites 15 dashboards.
