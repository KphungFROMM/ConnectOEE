import { ActionIcon, Group, Popover, Text, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconHelpCircle } from '@tabler/icons-react'
import { getHelpEntry } from '../../lib/help'
import type { WidgetDensity } from '../widgets/design/widgetTheme'
import { HelpPopoverContent } from './HelpPopoverContent'

export function HelpTrigger({
  helpId,
  size = 'sm',
  touchTarget = false,
}: {
  helpId: string
  size?: 'xs' | 'sm' | 'md'
  touchTarget?: boolean
}) {
  const entry = getHelpEntry(helpId)
  const [opened, { toggle, close }] = useDisclosure(false)

  if (!entry) return null

  const iconSize = size === 'md' ? 18 : size === 'sm' ? 16 : 14
  const buttonSize = touchTarget ? 32 : size === 'md' ? 28 : 22

  return (
    <Popover
      opened={opened}
      onChange={(o) => {
        if (!o) close()
      }}
      position="bottom-start"
      withArrow
      shadow="md"
      width={340}
      trapFocus
    >
      <Popover.Target>
        <Tooltip label={entry.summary} multiline w={260} withArrow disabled={opened}>
          <ActionIcon
            variant="subtle"
            color="dimmed"
            size={buttonSize}
            aria-label={`Help: ${entry.title}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggle()
            }}
          >
            <IconHelpCircle size={iconSize} stroke={1.75} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
        <HelpPopoverContent entry={entry} />
      </Popover.Dropdown>
    </Popover>
  )
}

export function MetricLabel({
  label,
  helpId,
  density,
  centered,
  touchTarget,
}: {
  label: string
  helpId?: string
  density?: WidgetDensity
  centered?: boolean
  touchTarget?: boolean
}) {
  return (
    <Group
      gap={4}
      wrap="nowrap"
      justify={centered ? 'center' : 'flex-start'}
      align="center"
      onClick={(e) => e.stopPropagation()}
    >
      <Text
        size={density === 'kiosk' ? 'sm' : 'xs'}
        c="dimmed"
        fw={700}
        tt="uppercase"
        ta={centered ? 'center' : undefined}
        style={{ letterSpacing: 0.6 }}
      >
        {label}
      </Text>
      {helpId ? <HelpTrigger helpId={helpId} size={density === 'kiosk' ? 'md' : 'sm'} touchTarget={touchTarget ?? density === 'kiosk'} /> : null}
    </Group>
  )
}
