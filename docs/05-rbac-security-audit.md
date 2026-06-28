# 05 - RBAC, Security & Audit

## Roles

- **Admin** - full configuration, runs the wizard, PLC write-back enabled.
- **Supervisor** - tag browsing, builds dashboards, manages only dashboards they created, acknowledges faults.
- **Manager** - read all + reports.
- **Operator** - line view + downtime reasoning entry.
- **Kiosk** - anonymous; public dashboards only, no login.

## Permission model

- Permission-based checks enforced server-side (not just UI gating).
- Roles map to permissions via `RolePermission`.
- Plant/line scoping via `UserPlantScope` so users only see/act on their assigned scope.
- PLC write-back and tag browsing are gated to Admin/Supervisor.
- Supervisors can delete only dashboards they created.
- The **Plant Explorer** (full plant/department/line/machine hierarchy navigation - see 10) is available to **Admin, Manager, and Supervisor** (Supervisors scoped to their `UserPlantScope`). **Operators are excluded** and remain limited to their assigned line view.

## Authentication

- ASP.NET Core Identity + JWT for app users.
- Cookie/anonymous path for kiosk dashboards (public scope only).

## Audit logging

`AuditLog` captures:

- User actions (logins, config edits, dashboard publish/delete).
- PLC writes (who, when, which tag, old/new value, result) - always audited.
- Configuration changes (hierarchy, tags, shifts, fault maps, retention).

Audit logging is implemented as a service + middleware so it consistently captures sensitive operations. Audit records are immutable/append-only.
