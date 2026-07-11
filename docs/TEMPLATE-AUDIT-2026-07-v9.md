# Template Audit — v9 (best-in-class nesting)

Post–accelerator-finish captures after Operator Floor / Line Andon gained one-level nesting and interactive widgets.

## Screenshots

| Mode | Full gallery |
|------|----------------|
| Light | [gallery-light.png](template-screenshots/v9/gallery-light.png) |
| Dark | [gallery-dark.png](template-screenshots/v9/gallery-dark.png) |

Per-template: `docs/template-screenshots/v9/{slug}-{light|dark}.png` for:

- `operator-floor`, `line-andon`, `maintenance-wall`, `plant-overview`
- `shift-supervisor`, `quality-pulse`, `production-board`, `analytics-starter`

## Prove-out

- **Operator Floor** — `container-panel` hosts OEE / run-state / pace; root has downtime pad + fault ack.
- **Line Andon** — `container-panel` hosts OEE hero + APQ cluster beside Andon stack.

## Recapture

```bash
OUT_DIR=docs/template-screenshots/v9 AUDIT_TOKEN=… node scripts/capture-template-screenshots.mjs
```

See also [BEST-IN-CLASS-FINISH-2026-07.md](BEST-IN-CLASS-FINISH-2026-07.md).
