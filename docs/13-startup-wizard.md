# 13 - Guided Startup Wizard

On first install, launch a guided setup wizard. The wizard must be **re-runnable** at any time.

## Steps

1. **Create Plant**
2. **Create Departments**
3. **Create Lines**
4. **Add Machines**
5. **Connect PLCs**
6. **Map required tags**
7. **Map optional tags**
8. **Configure shifts** - build shift patterns/definitions/breaks, assign per plant/line with effective dates, set calendar/holidays, preview the weekly schedule grid (see 07).
9. **Create first admin user**
10. **Generate default dashboards** - auto-generate a ready-to-go dashboard set from the template library (see 10), pre-bound to the lines/machines just configured.

## Behavior

- Each step validates before advancing; progress is saved so the wizard can resume.
- Steps reuse the same admin screens used elsewhere (shifts, hierarchy, PLC, tag mapping) so there is one source of truth.
- Re-running the wizard edits existing configuration rather than duplicating it.
- Tag mapping steps use the live tag browser when available, with manual-entry fallback (see 09).
