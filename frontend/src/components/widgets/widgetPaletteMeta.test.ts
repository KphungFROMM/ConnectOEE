import { describe, expect, it } from 'vitest'
import { widgetCatalog } from './registry'
import { WIDGET_PALETTE_META, enrichWidgetMeta } from './widgetPaletteMeta'
import * as TablerIcons from '@tabler/icons-react'

describe('widget palette meta', () => {
  it('covers every catalog widget with icon + description + family', () => {
    for (const item of widgetCatalog) {
      const meta = WIDGET_PALETTE_META[item.type]
      expect(meta, `missing palette meta for ${item.type}`).toBeTruthy()
      expect(meta.description.length).toBeGreaterThan(8)
      expect(meta.icon).toMatch(/^Icon/)
      expect(['oee', 'downtime', 'production', 'status', 'layout']).toContain(meta.visualFamily)
    }
  })

  it('resolves Tabler icons for every catalog entry', () => {
    const icons = TablerIcons as unknown as Record<string, unknown>
    for (const item of widgetCatalog) {
      const enriched = enrichWidgetMeta(item)
      expect(icons[enriched.icon!], `unknown icon ${enriched.icon} for ${item.type}`).toBeTruthy()
    }
  })

  it('enriches catalog entries with description and visual family (live previews are separate)', () => {
    for (const item of widgetCatalog) {
      const enriched = enrichWidgetMeta(item)
      expect(enriched.description).toBeTruthy()
      expect(enriched.visualFamily).toBeTruthy()
    }
  })
})
