import { describe, expect, it } from 'vitest'
import { widgetCatalog } from '../../components/widgets/registry'
import { allAuditWidgets, createAuditWidget } from './widgetAuditDefaults'

describe('widget audit defaults', () => {
  it('creates an audit instance for every catalog type', () => {
    for (const meta of widgetCatalog) {
      const w = createAuditWidget(meta.type, 0)
      expect(w.type).toBe(meta.type)
      expect(w.w).toBe(meta.defaultW)
      expect(w.h).toBe(meta.defaultH)
      expect(w.id).toBe(`audit-${meta.type}`)
    }
  })

  it('allAuditWidgets matches catalog length', () => {
    expect(allAuditWidgets()).toHaveLength(widgetCatalog.length)
  })
})
