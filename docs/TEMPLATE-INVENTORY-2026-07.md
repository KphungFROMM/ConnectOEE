# Template Inventory — July 2026 (pre–v7.2 reimage)

Baseline from [`DashboardTemplateLayouts.cs`](../src/ConnectOEE.Infrastructure/Seeding/DashboardTemplateLayouts.cs) before flavor/density updates. **Superseded by** [TEMPLATE-AUDIT-2026-07-v7.2.md](TEMPLATE-AUDIT-2026-07-v7.2.md).

| Template | Slug | Scope | Profile | Rows | Widgets | Grade |
|----------|------|-------|---------|------|---------|-------|
| Plant Command Center | plant-command-center | plant | plantWall | 9 | 9 | Needs flavor |
| Executive Briefing | executive-briefing | plant | plantWall | 9 | 7 | Needs flavor |
| Floor At-a-Glance | floor-at-a-glance | plant | plantWall | 9 | 4 | Pass |
| Plant Reliability Hub | plant-reliability-hub | plant | plantWall | 7 | 10 | Needs flavor |
| TEEP & Utilization | teep-and-utilization | plant | plantWall | 6 | 5 | Needs flavor |
| Line Performance Board | line-performance-board | line | plantWall | 7 | 6 | Pass |
| Shift Huddle Board | shift-huddle-board | line | plantWall | 6 | 5 | Pass |
| Machine Station Detail | machine-station-detail | machine | plantWall | 7 | 6 | Pass |
| Production & Pace | production-and-pace | line | plantWall | 8 | 4 | Pass |
| Quality & Yield Lab | quality-and-yield-lab | line | plantWall | 8 | 9 | Needs flavor |
| Downtime Detective | downtime-detective | line | plantWall | 8 | 5 | Pass |
| Setup & Changeover | setup-and-changeover | line | plantWall | 6 | 3 | Pass |
| Supervisor Cockpit | supervisor-cockpit | line | plantWall | 6 | 5 | Pass |
| Operator Kiosk | operator-kiosk | machine | kioskWall | 7 | 6 | Needs density |
| Line Andon Wall | line-andon-wall | line | kioskWall | 7 | 7 | Needs density |
| Maintenance Wallboard | maintenance-wallboard | plant | kioskWall | 8 | 7 | Needs density + flavor |
| Attainment Tracker | attainment-tracker | line | plantWall | 6 | 5 | Pass |
| Shift Compare | shift-compare | line | plantWall | 9 | 6 | Pass |

## Notes

- No seed used `presentation` options (all KPI tiles defaulted to number).
- `systemTemplateMeta.ts` widgetCounts were inflated (pre-v7.1).
- Gallery previews were abstract SVGs, not live layout crops.
- **v7.2 complete:** curated presentations, kiosk 3–5 headlines, PNG previews, accurate meta — see audit report.
