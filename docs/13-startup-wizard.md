# 13 - Guided Startup Wizard

On first install (`needsSetup=true`), users are redirected to the guided setup wizard. After setup completes, the wizard is **hidden from the main sidebar** and is only reachable via **Admin → Run setup wizard** (requires `wizard.run`). Re-running skips the admin bootstrap step and starts at plant configuration.

## Steps

1. **Create first admin user** — administrator username and password for this installation.
2. **Create Plant**
3. **Create Departments**
4. **Create Lines**
5. **Add Machines**
6. **Connect PLCs**
7. **Map required tags**
8. **Map optional tags**
9. **Configure shifts** - build shift patterns/definitions/breaks, assign per plant/line with effective dates, set calendar/holidays, preview the weekly schedule grid (see 07).
10. **Generate default dashboards** - generate a ready-to-go dashboard set from the **v7 template library** (18 system templates — see [10](10-dashboards-widgets-templates.md)), pre-bound to the lines/machines just configured. Per line: Overview (**Line Performance Board**), Shift (**Shift Huddle Board**), Detail (**Machine Station Detail**), Downtime (**Downtime Detective**), Production (**Production & Pace**), Quality (**Quality & Yield Lab**), Supervisor (**Supervisor Cockpit**), Setup (**Setup & Changeover**), Operator Kiosk, Andon (**Line Andon Wall**). Per plant: **Plant Command Center**, **Executive Briefing**, **Plant Reliability Hub**, **TEEP & Utilization**, **Maintenance Wallboard** (kiosk). **Floor At-a-Glance** is added when the plant has two or more lines, or any line with multiple machines.

**Upgrading from v6:** v6 system template names are retired on deploy. Run **Refresh layouts** once on the Dashboards page so existing wizard dashboards (matched by `{Line} — {Suffix}` name) receive v7 widget layouts without losing scope or IDs.

## Behavior

- Each step validates before advancing; progress is saved so the wizard can resume.
- Steps reuse the same admin screens used elsewhere (shifts, hierarchy, PLC, tag mapping) so there is one source of truth.
- Re-running the wizard edits existing configuration rather than duplicating it (admin bootstrap step is skipped when setup is already complete).
- Tag mapping steps use the live tag browser when available, with manual-entry fallback (see 09).
