# 05 - RBAC, Security & Audit

## Roles

- **Admin** - full configuration, runs the wizard, PLC write-back enabled.
- **Supervisor** - tag browsing, builds dashboards, manages only dashboards they created, acknowledges faults.
- **Manager** - read all + reports + operator station (downtime reason entry at assigned scope).
- **Operator** - Operator Station only for assigned lines/machines; no dashboards or analytics.
- **Kiosk** - anonymous; public dashboards only, no login.

## Permission model

- Permission-based checks enforced server-side (not just UI gating).
- Roles map to permissions via `RolePermission`.
- Plant/line scoping via `UserPlantScope` so users only see/act on their assigned scope.
- PLC write-back and tag browsing are gated to Admin/Supervisor.
- Supervisors can delete only dashboards they created.
- The **Plant Explorer** (full plant/department/line/machine hierarchy navigation - see 10) is available to **Admin, Manager, and Supervisor** (Supervisors scoped to their `UserPlantScope`). **Operators are excluded** and remain limited to their assigned line view.
- **Appearance (KPI identity, status/Andon colors, header branding)**: `users.manage` — Admin → Appearance can edit OEE/A/P/Q identity hex colors, running/warning/fault/idle status colors, and header title/logo (`GET` any authenticated user; `PUT`/`POST …/reset`/`POST …/logo` require `users.manage`).
- **Product catalog & selection**: `products.manage` (Admin, Manager, Supervisor) for catalog + per-line ideal cycle rates; `products.select` (Admin, Manager, Supervisor, Operator) to assign running product when PLC PartId is not mapped. Unknown PLC PartIds auto-create catalog stubs.

## Authentication

- ASP.NET Core Identity + JWT for app users (15-minute access tokens + httpOnly refresh cookie).
- Account lockout (5 failures / 15 min), aligned password policy (8+ upper/lower/digit).
- TOTP MFA for Admin accounts (`/api/auth/mfa/*`).
- Forced password change for seeded/commission users (`MustChangePassword`).
- Kiosk: signed line-scoped JWT in httpOnly cookie (`POST /api/dashboards/kiosk/{id}/session`).

## Audit logging

`AuditLog` captures:

- User actions (logins, lockouts, config edits, dashboard publish/delete, MFA changes).
- PLC writes (who, when, which tag, command + result) - always audited.
- Configuration changes (hierarchy, tags, shifts, fault maps, retention).
- HTTP mutations via audit middleware (POST/PUT/PATCH/DELETE under `/api/`).

## User administration API

- `PUT /api/users/{id}` — update display name and replace roles (cannot remove the last Admin).
- `PUT /api/users/{id}/password` — admin password reset (audited as `user.password-reset`).
- `DELETE /api/users/{id}` — soft-deactivate (cannot delete self or last Admin).

## Downtime reason permissions

- `downtime.enter` — operator one-tap reason entry (`POST /api/shifts/downtime-reason`) and supervisor correction (`PATCH /api/events/downtime/{id}/reason`).
- `GET /api/downtime-reasons/operator-catalog` and `operator-pending` — read-only catalog for operators (scoped by line); does **not** require `tags.map`.
- Full downtime reason CRUD (`/api/downtime-reasons`) requires `tags.map`; Admin **Downtime Reasons** tab is gated on that permission.

Audit records are append-only (PostgreSQL trigger prevents UPDATE/DELETE). Admin UI exports CSV.
