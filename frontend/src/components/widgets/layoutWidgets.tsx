import { Anchor, Divider, Image, Stack, Tabs, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { IconClock } from '@tabler/icons-react'
import QRCode from 'qrcode'
import { Link } from 'react-router-dom'
import { getDowntime, type DowntimeEvent } from '../../lib/metrics'
import { readTagValues } from '../../lib/tags'
import { WidgetFrame } from './common'
import type { WidgetProps } from './common'
import { MetricHero } from './design/MetricHero'
import { StatusMetricTile } from './design/StatusMetricTile'
import { NestedWidgetHost } from './NestedWidgetHost'
import { useBuilderNestEdit } from '../../features/builder/BuilderNestEditContext'
import { usePolling } from './usePolling'

export function TextLabelWidget({ widget }: WidgetProps) {
  const content = (widget.options.content as string) ?? widget.title ?? 'Label'
  const align = (widget.options.align as 'left' | 'center' | 'right') ?? 'left'
  const fontSize = (widget.options.fontSize as string) ?? 'md'
  return (
    <WidgetFrame title={null} variant="compact">
      <Text fw={600} size={fontSize} ta={align} lh={1.3}>
        {content}
      </Text>
    </WidgetFrame>
  )
}

export function RichNotesWidget({ widget }: WidgetProps) {
  const content = (widget.options.content as string) ?? ''
  return (
    <WidgetFrame title={widget.title ?? 'Notes'} variant="compact">
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} c={content ? undefined : 'dimmed'}>
        {content || 'Add notes in the builder.'}
      </Text>
    </WidgetFrame>
  )
}

export function ImageLogoWidget({ widget }: WidgetProps) {
  const url = (widget.options.url as string) ?? ''
  const alt = (widget.options.alt as string) ?? widget.title ?? 'Image'
  return (
    <WidgetFrame title={widget.title} noData={!url}>
      {url ? (
        <Stack align="center" justify="center" h="100%">
          <Image src={url} alt={alt} fit="contain" mah="100%" maw="100%" />
        </Stack>
      ) : null}
    </WidgetFrame>
  )
}

export function DividerWidget({ widget }: WidgetProps) {
  return (
    <WidgetFrame title={null} variant="compact">
      <Stack justify="center" h="100%">
        <Divider label={widget.title ?? undefined} labelPosition="center" />
      </Stack>
    </WidgetFrame>
  )
}

export function ContainerPanelWidget({ widget, ctx }: WidgetProps) {
  const title = (widget.options.title as string) ?? widget.title ?? 'Panel'
  const nestEdit = useBuilderNestEdit()
  return (
    <WidgetFrame title={title} stale={!ctx.hubConnected} tone="info" variant="compact">
      {nestEdit ? nestEdit.renderNestedEdit(widget.id) : (
        <NestedWidgetHost parentId={widget.id} ctx={ctx} emptyHint="Container — drop widgets in the builder" />
      )}
    </WidgetFrame>
  )
}

export function TabbedPanelWidget({ widget, ctx }: WidgetProps) {
  const tabs = (widget.options.tabs as string[]) ?? ['Tab 1', 'Tab 2']
  const nestEdit = useBuilderNestEdit()
  const [localActive, setLocalActive] = useState(0)
  const active = nestEdit ? Number(nestEdit.getActiveTab(widget.id) || '0') : localActive
  const setActive = (i: number) => {
    if (nestEdit) nestEdit.setActiveTab(widget.id, String(i))
    else setLocalActive(i)
  }
  return (
    <WidgetFrame title={widget.title ?? 'Tabs'} stale={!ctx.hubConnected} variant="compact">
      <Tabs
        value={String(active)}
        onChange={(v) => setActive(Number(v))}
        h="100%"
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <Tabs.List>
          {tabs.map((t, i) => (
            <Tabs.Tab key={`${t}-${i}`} value={String(i)}>
              {t}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {tabs.map((t, i) => (
          <Tabs.Panel
            key={`${t}-${i}`}
            value={String(i)}
            pt="xs"
            style={{ flex: 1, minHeight: 0, display: active === i ? 'flex' : undefined, flexDirection: 'column' }}
          >
            {nestEdit ? (
              nestEdit.renderNestedEdit(widget.id, String(i))
            ) : (
              <NestedWidgetHost
                parentId={widget.id}
                tabKey={String(i)}
                ctx={ctx}
                emptyHint={`${t} — drop widgets in the builder`}
              />
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
    </WidgetFrame>
  )
}

export function IframeEmbedWidget({ widget }: WidgetProps) {
  const url = (widget.options.url as string) ?? ''
  return (
    <WidgetFrame title={widget.title} noData={!url}>
      {url ? (
        <iframe
          src={url}
          title={widget.title ?? 'Embed'}
          style={{ width: '100%', height: '100%', border: 0, borderRadius: 8 }}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      ) : null}
    </WidgetFrame>
  )
}

export function ClockDateWidget({ widget, ctx }: WidgetProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const snap = ctx.snapshot ?? ctx.lineSnapshots[0]
  const shiftName = snap?.shiftName
  const shiftEnd = snap?.shiftEndUtc ? new Date(snap.shiftEndUtc) : null
  const rem =
    shiftEnd && shiftEnd.getTime() > now.getTime()
      ? Math.floor((shiftEnd.getTime() - now.getTime()) / 60000)
      : null

  return (
    <WidgetFrame title={widget.title ?? 'Clock'} stale={!ctx.hubConnected} variant="default" density={ctx.density}>
      <StatusMetricTile
        label={now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        value={now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        subtitle={
          shiftName
            ? `${shiftName}${rem != null ? ` · ${Math.floor(rem / 60)}h ${rem % 60}m left` : ''}`
            : undefined
        }
        color="var(--mantine-color-blue-6)"
        density={ctx.density}
        icon={<IconClock size={18} stroke={2} />}
      />
    </WidgetFrame>
  )
}

export function MarqueeTickerWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<DowntimeEvent[]>(
    () => getDowntime(ctx.lineId, ctx.plantId),
    8000,
    [ctx.lineId, ctx.plantId],
  )
  const text = useMemo(() => {
    const rows = data ?? []
    if (rows.length === 0) return 'No downtime events this shift'
    return rows
      .slice(0, 12)
      .map((e) => `${new Date(e.startUtc).toLocaleTimeString()} · ${e.category}${e.reason ? `: ${e.reason}` : ''}`)
      .join('   ·   ')
  }, [data])

  return (
    <WidgetFrame title={widget.title ?? 'Ticker'} stale={!ctx.hubConnected}>
      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', height: '100%', display: 'flex', alignItems: 'center' }}>
        <Text
          size="sm"
          style={{
            display: 'inline-block',
            paddingLeft: '100%',
            animation: 'connectoee-marquee 30s linear infinite',
          }}
        >
          {text}
        </Text>
        <style>{`@keyframes connectoee-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }`}</style>
      </div>
    </WidgetFrame>
  )
}

export function QrLinkTileWidget({ widget }: WidgetProps) {
  const url = (widget.options.url as string) ?? ''
  const [qrSrc, setQrSrc] = useState('')
  useEffect(() => {
    if (!url) {
      setQrSrc('')
      return
    }
    void QRCode.toDataURL(url, { width: 120, margin: 1 }).then(setQrSrc).catch(() => setQrSrc(''))
  }, [url])
  return (
    <WidgetFrame title={widget.title ?? 'QR Link'} noData={!url}>
      <Stack align="center" justify="center" gap="xs" h="100%">
        {qrSrc ? <Image src={qrSrc} alt="QR code" w={96} h={96} /> : null}
        <Anchor href={url} target="_blank" rel="noopener noreferrer" size="xs" ta="center" lineClamp={2}>
          {url}
        </Anchor>
      </Stack>
    </WidgetFrame>
  )
}

export function DashboardLinkWidget({ widget }: WidgetProps) {
  const dashboardId = (widget.options.dashboardId as string) ?? ''
  const label = (widget.options.label as string) ?? widget.title ?? 'Open dashboard'
  return (
    <WidgetFrame title={widget.title} noData={!dashboardId}>
      <Stack align="center" justify="center" h="100%">
        {dashboardId ? (
          <Anchor component={Link} to={`/dashboards/${dashboardId}`} size="lg" fw={700}>
            {label}
          </Anchor>
        ) : (
          <Text size="sm" c="dimmed">
            Set dashboard ID in builder
          </Text>
        )}
      </Stack>
    </WidgetFrame>
  )
}

export function NavigationDrillWidget({ widget }: WidgetProps) {
  const path = (widget.options.path as string) ?? '/plant-explorer'
  const label = (widget.options.label as string) ?? widget.title ?? 'Navigate'
  return (
    <WidgetFrame title={widget.title}>
      <Stack align="center" justify="center" h="100%">
        <Anchor component={Link} to={path} size="md" fw={600}>
          {label} →
        </Anchor>
      </Stack>
    </WidgetFrame>
  )
}

export function UdtMemberValueWidget({ widget }: WidgetProps) {
  const tagPath = widget.binding.tagPath
  const connectionId = widget.binding.connectionId
  const decimals = (widget.options.decimals as number) ?? 2
  const unit = (widget.options.unit as string) ?? ''

  const { data: sample } = usePolling(
    () =>
      connectionId && tagPath
        ? readTagValues(connectionId, [{ path: tagPath }]).then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    2000,
    [connectionId, tagPath],
  )

  const display =
    sample?.display ??
    (sample?.value !== undefined && sample?.value !== null ? Number(sample.value).toFixed(decimals) : '—')

  return (
    <WidgetFrame
      title={widget.title ?? 'UDT Member'}
      noData={!tagPath}
      stale={sample?.quality === 'Stale'}
    >
      <Stack gap={4} justify="center" h="100%">
        <MetricHero label={tagPath?.split(':').pop() ?? 'Member'} value={`${display}${unit ? ` ${unit}` : ''}`} />
      </Stack>
    </WidgetFrame>
  )
}
