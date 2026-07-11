import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveWidget } from '../../components/widgets/registry'
import { createMockWidgetCtx } from './mockWidgetCtx'
import { createAuditWidget } from './widgetAuditDefaults'
import type { FlavorOptions } from './defaultFlavors'

interface PaletteWidgetPreviewProps {
  type: string
  flavors?: FlavorOptions
  height?: number
}

/**
 * Lazy live mini-render for palette gallery cards.
 * Uses mock snapshot ctx only — does NOT enable global audit API mode
 * (that was hijacking hierarchy bind dropdowns to "Demo Plant").
 */
export function PaletteWidgetPreview({ type, flavors, height = 96 }: PaletteWidgetPreviewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const ctx = useMemo(() => createMockWidgetCtx(), [])
  const Widget = resolveWidget(type)
  const widget = useMemo(() => {
    const base = createAuditWidget(type, 0)
    return {
      ...base,
      options: { ...base.options, ...flavors },
    }
  }, [type, flavors])

  return (
    <div
      ref={ref}
      style={{
        height,
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-gray-0)',
        pointerEvents: 'none',
        position: 'relative',
      }}
    >
      {visible ? (
        <div
          style={{
            transform: 'scale(0.42)',
            transformOrigin: 'top left',
            width: `${100 / 0.42}%`,
            height: `${100 / 0.42}%`,
          }}
        >
          <Widget widget={widget} ctx={ctx} />
        </div>
      ) : (
        <div
          style={{
            height: '100%',
            background:
              'linear-gradient(90deg, var(--mantine-color-gray-1) 25%, var(--mantine-color-gray-0) 50%, var(--mantine-color-gray-1) 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      )}
    </div>
  )
}
