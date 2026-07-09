import { Badge } from '@mantine/core'
import { explorerRunStateColor, oeeExplorerBadgeColor, oeeExplorerHexColor } from '../widgets/common'

export function ConnectionPill({ connectionState }: { connectionState: string }) {
  const props = connectionPillMeta(connectionState)
  return (
    <Badge size="xs" variant={props.variant} color={props.color}>
      {props.label}
    </Badge>
  )
}

function connectionPillMeta(state: string): { label: string; color: string; variant: 'dot' | 'light' } {
  switch (state) {
    case 'Connected':
      return { label: 'Live', color: 'green', variant: 'dot' }
    case 'Connecting':
      return { label: 'Connecting', color: 'yellow', variant: 'light' }
    case 'Stale':
      return { label: 'Stale', color: 'yellow', variant: 'light' }
    case 'Faulted':
      return { label: 'Faulted', color: 'red', variant: 'light' }
    default:
      return { label: 'Offline', color: 'gray', variant: 'light' }
  }
}

export function ExplorerStatusDot({ status, connectionState }: { status: string; connectionState: string }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: explorerRunStateColor(status, connectionState),
        flex: '0 0 auto',
      }}
    />
  )
}

export function ExplorerOeeBadge({ pct, connectionState }: { pct: number; connectionState: string }) {
  return (
    <Badge size="xs" variant="light" color={oeeExplorerBadgeColor(pct, connectionState)}>
      {pct.toFixed(1)}%
    </Badge>
  )
}

export function isOffline(connectionState: string): boolean {
  return connectionState !== 'Connected'
}

export function ExplorerOeeMiniBar({ pct, connectionState }: { pct: number; connectionState: string }) {
  if (connectionState !== 'Connected') return null
  const color = oeeExplorerHexColor(pct, connectionState) ?? 'var(--mantine-color-teal-6)'
  return (
    <div
      style={{
        height: 3,
        borderRadius: 2,
        background: 'var(--mantine-color-gray-2)',
        overflow: 'hidden',
        marginTop: 2,
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: '100%',
          background: color,
        }}
      />
    </div>
  )
}
