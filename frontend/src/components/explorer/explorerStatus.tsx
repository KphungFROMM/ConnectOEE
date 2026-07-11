import { Badge } from '@mantine/core'

/**
 * Compact PLC/live-connection badge. Distinct from run-state (`StatusPill`/`StatusBeacon`
 * in the widget design system) — this is specifically "is data flowing", not "what is the
 * machine doing".
 */
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
