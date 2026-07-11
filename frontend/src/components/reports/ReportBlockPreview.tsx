import type { ReactNode } from 'react'
import { Box, Group, Stack, Text } from '@mantine/core'
import type { ReportBlock, ReportBlockType } from '../../lib/reportBlocks'
import { optionBool, optionString } from '../../lib/reportBlocks'

const Ink = '#212529'
const Muted = '#868e96'
const Border = '#dee2e6'
const Surface = '#f8f9fa'
const Accent = '#1c7ed6'
const Green = '#2f9e44'

function SectionChrome({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      style={{
        border: `1px solid ${Border}`,
        borderRadius: 4,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <Group gap={6} wrap="nowrap" px={8} py={5} style={{ borderBottom: `1px solid ${Border}` }}>
        <Box style={{ width: 3, height: 12, background: Accent, borderRadius: 1, flexShrink: 0 }} />
        <Text size="xs" fw={700} c={Ink} truncate>
          {title}
        </Text>
      </Group>
      <Box p={8}>{children}</Box>
    </Box>
  )
}

function FakeBar({ pct, color }: { pct: number; color: string }) {
  return (
    <Box style={{ height: 6, background: '#f1f3f5', borderRadius: 3, overflow: 'hidden' }}>
      <Box style={{ width: `${pct}%`, height: '100%', background: color }} />
    </Box>
  )
}

function Sparkline() {
  return (
    <svg width="100%" height="14" viewBox="0 0 80 14" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={Accent}
        strokeWidth="1.5"
        points="0,10 12,8 24,11 36,5 48,7 60,3 72,6 80,4"
      />
    </svg>
  )
}

function ChartSilhouette({ bars }: { bars?: number[] }) {
  const vals = bars ?? [40, 55, 35, 70, 50, 65, 45, 80]
  return (
    <Box
      style={{
        height: 56,
        background: Surface,
        borderRadius: 4,
        border: `1px solid ${Border}`,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        padding: '6px 8px',
      }}
    >
      {vals.map((h, i) => (
        <Box
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            background: i === vals.length - 1 ? Accent : '#a5d8ff',
            borderRadius: '2px 2px 0 0',
            minWidth: 4,
          }}
        />
      ))}
    </Box>
  )
}

function TableStub({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <Box style={{ fontSize: 9, lineHeight: 1.35 }}>
      <Group gap={0} wrap="nowrap" style={{ background: Ink, color: '#fff', padding: '3px 4px' }}>
        {headers.map((h) => (
          <Text key={h} size="10px" fw={700} c="#fff" style={{ flex: 1 }} truncate>
            {h}
          </Text>
        ))}
      </Group>
      {rows.map((row, i) => (
        <Group
          key={i}
          gap={0}
          wrap="nowrap"
          style={{ background: i % 2 === 0 ? Surface : '#fff', padding: '3px 4px' }}
        >
          {row.map((cell, j) => (
            <Text key={j} size="10px" c={Ink} style={{ flex: 1 }} truncate>
              {cell}
            </Text>
          ))}
        </Group>
      ))}
    </Box>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <Box
      style={{
        flex: 1,
        minWidth: 0,
        background: Surface,
        border: `1px solid ${Border}`,
        borderRadius: 4,
        padding: '4px 6px',
      }}
    >
      <Text size="10px" c={Muted} truncate>
        {label}
      </Text>
      <Text size="xs" fw={700} c={Ink} truncate>
        {value}
      </Text>
    </Box>
  )
}

function KpiHeroPreview({ block, compact }: { block: ReportBlock; compact?: boolean }) {
  const showSpark = optionBool(block, 'showSparklines', true)
  const includeSecondary = optionBool(block, 'includeSecondary', true)
  return (
    <Stack gap={6}>
      <Group align="flex-start" gap="sm" wrap="nowrap">
        <Box style={{ width: compact ? 48 : 64, flexShrink: 0, textAlign: 'center' }}>
          <Box
            mx="auto"
            style={{
              width: compact ? 40 : 52,
              height: compact ? 40 : 52,
              borderRadius: '50%',
              border: `4px solid ${Green}`,
              borderRightColor: Border,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text size={compact ? 'xs' : 'sm'} fw={800} c={Green}>
              82
            </Text>
          </Box>
          <Text size="10px" c={Muted} mt={2}>
            OEE %
          </Text>
          {showSpark && !compact ? <Sparkline /> : null}
        </Box>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          {[
            { label: 'Availability', pct: 88, color: Green },
            { label: 'Performance', pct: 79, color: Accent },
            { label: 'Quality', pct: 96, color: '#7048e8' },
          ].map((f) => (
            <Box key={f.label}>
              <Group justify="space-between" gap={4}>
                <Text size="10px" c={Muted}>
                  {f.label}
                </Text>
                <Text size="10px" fw={700}>
                  {f.pct}%
                </Text>
              </Group>
              <FakeBar pct={f.pct} color={f.color} />
              {showSpark && !compact ? <Sparkline /> : null}
            </Box>
          ))}
        </Stack>
      </Group>
      {includeSecondary && !compact ? (
        <Group gap={4} grow>
          <MetricChip label="Good" value="1,240" />
          <MetricChip label="Scrap" value="2.1%" />
          <MetricChip label="DT" value="48m" />
        </Group>
      ) : null}
    </Stack>
  )
}

function previewBody(block: ReportBlock, compact?: boolean) {
  const title = block.title || block.type
  const text = optionString(block, 'text', 'Notes…')

  switch (block.type as ReportBlockType) {
    case 'cover':
      return (
        <Box
          style={{
            background: Surface,
            border: `1px solid ${Border}`,
            borderRadius: 4,
            overflow: 'hidden',
            minHeight: compact ? 72 : 100,
          }}
        >
          <Box style={{ height: 4, background: Accent }} />
          <Stack gap={6} p={compact ? 8 : 12} align="center">
            <Text size="10px" c={Muted} tt="uppercase" fw={600}>
              ConnectOEE
            </Text>
            <Text size={compact ? 'xs' : 'sm'} fw={800} c={Ink} ta="center">
              {title}
            </Text>
            {!compact ? (
              <Group gap={6} grow w="100%">
                <MetricChip label="OEE" value="82%" />
                <MetricChip label="A" value="88%" />
                <MetricChip label="P" value="79%" />
              </Group>
            ) : null}
          </Stack>
        </Box>
      )
    case 'kpi-hero':
      return <KpiHeroPreview block={block} compact={compact} />
    case 'apq-bars':
      return (
        <Stack gap={4}>
          {[
            { label: 'Availability', pct: 88, color: Green },
            { label: 'Performance', pct: 79, color: Accent },
            { label: 'Quality', pct: 96, color: '#7048e8' },
          ].map((f) => (
            <Box key={f.label}>
              <Group justify="space-between">
                <Text size="10px" c={Muted}>
                  {f.label}
                </Text>
                <Text size="10px" fw={700}>
                  {f.pct}%
                </Text>
              </Group>
              <FakeBar pct={f.pct} color={f.color} />
            </Box>
          ))}
        </Stack>
      )
    case 'secondary-metrics':
      return (
        <Group gap={4} grow>
          <MetricChip label="Good" value="1,240" />
          <MetricChip label="Reject" value="28" />
          <MetricChip label="Scrap" value="2.1%" />
          {!compact ? <MetricChip label="DT" value="48m" /> : null}
        </Group>
      )
    case 'reliability':
      return (
        <SectionChrome title={title}>
          <Group gap={4} grow>
            <MetricChip label="MTTR" value="18m" />
            <MetricChip label="MTBF" value="4.2h" />
            <MetricChip label="MTTF" value="6.1h" />
          </Group>
        </SectionChrome>
      )
    case 'oee-trend':
      return (
        <SectionChrome title={title}>
          <ChartSilhouette />
        </SectionChrome>
      )
    case 'pareto':
      return (
        <SectionChrome title={title}>
          <ChartSilhouette bars={[90, 70, 55, 40, 28, 18, 12]} />
        </SectionChrome>
      )
    case 'production-chart':
      return (
        <Stack gap={6}>
          {!compact ? (
            <Group gap={4} grow>
              <MetricChip label="Good" value="1,240" />
              <MetricChip label="Target" value="1,400" />
              <MetricChip label="Var" value="-160" />
            </Group>
          ) : null}
          <SectionChrome title={title}>
            <ChartSilhouette bars={[60, 72, 68, 80, 75, 85, 70]} />
          </SectionChrome>
        </Stack>
      )
    case 'shift-table':
      return (
        <SectionChrome title={title}>
          <TableStub
            headers={['Shift', 'OEE%', 'Good', 'DT']}
            rows={[
              ['Day', '84.2', '620', '22m'],
              ['Swing', '79.1', '540', '31m'],
              ['Night', '81.5', '580', '18m'],
            ]}
          />
        </SectionChrome>
      )
    case 'trend-table':
      return (
        <SectionChrome title={title}>
          <TableStub
            headers={['Period', 'OEE%', 'A%', 'Good']}
            rows={[
              ['06:00', '81.0', '88', '120'],
              ['07:00', '79.5', '85', '118'],
              ['08:00', '83.2', '90', '125'],
            ]}
          />
        </SectionChrome>
      )
    case 'production-table':
      return (
        <SectionChrome title={title}>
          <TableStub
            headers={['Period', 'Good', 'Target', 'Var']}
            rows={[
              ['06:00', '120', '140', '-20'],
              ['07:00', '118', '140', '-22'],
              ['08:00', '125', '140', '-15'],
            ]}
          />
        </SectionChrome>
      )
    case 'reason-table':
      return (
        <SectionChrome title={title}>
          <TableStub
            headers={['Reason', 'Count', 'Min']}
            rows={[
              ['Jam', '12', '48'],
              ['Changeover', '4', '36'],
              ['No material', '3', '22'],
            ]}
          />
        </SectionChrome>
      )
    case 'fault-table':
      return (
        <SectionChrome title={title}>
          <TableStub
            headers={['Code', 'Reason', 'Count']}
            rows={[
              ['E104', 'Motor fault', '8'],
              ['E210', 'Sensor', '5'],
              ['E033', 'E-stop', '3'],
            ]}
          />
        </SectionChrome>
      )
    case 'breakdown-table':
      return (
        <SectionChrome title={title}>
          <TableStub
            headers={['Node', 'OEE%', 'Good']}
            rows={[
              ['Line 1', '82.1', '1,240'],
              ['Line 2', '76.4', '980'],
              ['Line 3', '85.0', '1,100'],
            ]}
          />
        </SectionChrome>
      )
    case 'section-title':
      return (
        <Text size={compact ? 'xs' : 'sm'} fw={700} c={Accent}>
          {title}
        </Text>
      )
    case 'rich-text':
      return (
        <Box
          style={{
            border: `1px solid ${Border}`,
            background: Surface,
            borderRadius: 4,
            padding: 8,
          }}
        >
          <Text size="xs" c={Ink} lineClamp={compact ? 2 : 4}>
            {text}
          </Text>
        </Box>
      )
    case 'page-break':
      return (
        <Group gap="sm" justify="center" wrap="nowrap">
          <Box style={{ flex: 1, borderTop: `2px dashed ${Border}` }} />
          <Text size="10px" c={Muted} tt="uppercase" fw={600}>
            Page break
          </Text>
          <Box style={{ flex: 1, borderTop: `2px dashed ${Border}` }} />
        </Group>
      )
    default:
      return (
        <Text size="xs" c={Muted}>
          {title}
        </Text>
      )
  }
}

/** Print-styled stub for palette (compact) and A4 canvas (full). */
export function ReportBlockPreview({
  block,
  compact = false,
}: {
  block: ReportBlock
  compact?: boolean
}) {
  return (
    <Box style={{ pointerEvents: 'none', userSelect: 'none' }}>{previewBody(block, compact)}</Box>
  )
}

/** Mini palette card preview using a synthetic block. */
export function ReportBlockPalettePreview({ type }: { type: ReportBlockType }) {
  const block: ReportBlock = {
    id: `preview-${type}`,
    type,
    title: undefined,
    options:
      type === 'rich-text'
        ? { text: 'Notes…' }
        : type === 'kpi-hero'
          ? { showSparklines: true, includeSecondary: false }
          : undefined,
  }
  return (
    <Box
      style={{
        height: 72,
        overflow: 'hidden',
        borderRadius: 6,
        border: `1px solid ${Border}`,
        background: '#fff',
        padding: 6,
      }}
    >
      <ReportBlockPreview block={block} compact />
    </Box>
  )
}
