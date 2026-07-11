# Best-in-class accelerator finish (Jul 2026)

Closes the post-commission gaps so ConnectOEE’s widget library is composition-complete and write-safe for an OEE Accelerator.

## Shipped

| Area | Outcome |
|------|---------|
| Nesting | Flat `parentId` / `tabKey` on widgets (FE + BE + migration). Viewer CSS inner grid; Builder nested RGL. One nesting level. |
| Builder UX | Drop/click-add into selected container or active tab; cascade delete/duplicate; depth guard. |
| Write sandbox | `ctx.allowInteractiveWrites` — false in builder/gallery; true on live dashboards. Interactive widgets show blocked reasons. |
| Mock PLC | `MockDriver` implements `IControllableDriver` (Ack/Reset/StartPermissive). |
| Operator Station | Fault Ack when `plc.write` present. |
| Kiosk | Anonymous stays read-only; **Sign in to act** enables writes when Operator/Supervisor is signed in and board has interactive widgets. |
| Polish | Line-status scope, Andon pill/minimal layouts, OEE by Shift uses Shift granularity. |
| Templates | Operator Floor + Line Andon prove nesting + interactive (pad/ack). |

## Commission score

Target: **111 Pass / 0 Fix / 0 Defer** (regenerate with `node scripts/generate-commission-scorecard.mjs`).

## QA checklist

### Nesting (Builder D1–D7)

| # | Check |
|---|--------|
| D1 | Select container → palette add places child with `parentId` set |
| D2 | Nested RGL moves update only relative child coords |
| D3 | Delete container cascades children |
| D4 | Duplicate container deep-copies children |
| D5 | Reject nesting container inside container (toast) |
| D6 | Tabbed panel: children respect active `tabKey` |
| D7 | Properties chip shows “Contains N widgets” |

### Write sandbox

| # | Check |
|---|--------|
| W1 | Builder edit/preview: interactive widgets blocked |
| W2 | `/dev/widgets` gallery: writes blocked |
| W3 | Live `/present` or dashboard: writes allowed with permission |
| W4 | Operator Station: Fault Ack with `plc.write` |
| W5 | Anonymous kiosk: view-only; **Sign in to act** → `returnUrl` back to kiosk; writes enabled when permitted |

### Templates / polish

| # | Check |
|---|--------|
| T1 | Refresh system layouts; Operator Floor has nested sections + downtime pad |
| T2 | Line Andon has status strip + nested KPI cluster |
| T3 | Line-status widgets honor binding/dashboard line scope |
| T4 | Andon `pill` / `minimal` distinct from beacon |
| T5 | OEE by Shift uses historian Shift granularity |

## Screenshots

- Widgets (post-nesting): [`docs/widget-screenshots/v4/`](widget-screenshots/v4/) — 111 light + 111 dark.
- Templates (nested Operator Floor / Line Andon): [`docs/template-screenshots/v9/`](template-screenshots/v9/).
- Recapture: `OUT_DIR=docs/widget-screenshots/v4 AUDIT_TOKEN=… node scripts/capture-widget-screenshots.mjs` and `OUT_DIR=docs/template-screenshots/v9 … node scripts/capture-template-screenshots.mjs`.

## Verify (smoke)

1. `/dev/widgets` — container/tab cards show nested demo children; Pass badges on former Defer types.
2. Builder — select container → add KPI from palette → child appears inside; delete container removes children.
3. Builder preview — downtime pad / PLC controls show “Writes disabled…”.
4. Live dashboard (signed-in Admin) — same widgets can write.
5. `/kiosk/:id` with interactive widgets — “Sign in to act”; after login, “Operator actions enabled”.
6. Operator Station — Acknowledge fault visible with `plc.write`.
7. `POST /api/dashboards/refresh-system-layouts` — Operator Floor / Line Andon pick up nested layouts.

## Non-goals (unchanged)

- Multi-level nested containers
- Writing downtime reasons back to PLC tags
- Anonymous kiosk JWT with write permissions
- Speculative new widget types

## Related

- [WIDGET-COMMISSION-2026-07.md](WIDGET-COMMISSION-2026-07.md)
- [WIDGET-COMMISSION-SCORECARD-2026-07.md](WIDGET-COMMISSION-SCORECARD-2026-07.md)
- [11-wysiwyg-builder.md](11-wysiwyg-builder.md)
