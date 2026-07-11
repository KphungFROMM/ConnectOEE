# Template Audit — v8 curated catalog

Fresh system templates (not densified v7.2). Visual language: [WIDGET-VISUAL-LANGUAGE-2026-07.md](WIDGET-VISUAL-LANGUAGE-2026-07.md).

## Catalog

| Template | Profile | Max rows | Identity strip | Hero |
|----------|---------|----------|----------------|------|
| Operator Floor | kioskWall | 8 | Yes | OEE |
| Line Andon | kioskWall | 8 | Yes | Andon |
| Maintenance Wall | kioskWall | 8 | Yes | Reliability KPIs |
| Plant Overview | plantWall | 9 | Via plant hero | Plant KPIs |
| Shift Supervisor | plantWall | 8 | Yes | Shift + production |
| Quality Pulse | plantWall | 8 | — | Scrap/FPY rings |
| Production Board | plantWall | 8 | Yes | Pace / attainment |
| Analytics Starter | plantWall | 8 | — | Charts |

## QA checklist

- [ ] `/dev/templates` lists only the 8 names above
- [ ] Operator Floor / Line Andon / Maintenance Wall: no full-bleed green calm slabs; fill 8 rows
- [ ] Light + dark wall screenshots under `docs/template-screenshots/v8/`
- [ ] Kiosk anonymous session still loads published Operator Floor / Line Andon
- [ ] Continuous-line rollup widgets still topology-aware
- [ ] `POST /api/dashboards/refresh-system-layouts` remaps legacy wizard names

## Screenshots

Capture from Template Audit Gallery (`/dev/templates`) at 1920×1080 wall-fit, light and dark, into `docs/template-screenshots/v8/{slug}-{light|dark}.png`.
