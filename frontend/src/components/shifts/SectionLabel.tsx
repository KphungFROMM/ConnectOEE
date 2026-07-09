import { Group, Text, useMantineColorScheme } from '@mantine/core'
import { HelpTrigger } from '../help/HelpTrigger'
import { darkTheme, lightTheme } from '../../theme/tokens'

interface SectionLabelProps {
  children: React.ReactNode
  mb?: number | string
  helpId?: string
}

export function SectionLabel({ children, mb = 4, helpId }: SectionLabelProps) {
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  return (
    <Group gap={6} mb={mb} align="center" wrap="nowrap">
      <Text
        size="xs"
        fw={700}
        tt="uppercase"
        style={{ letterSpacing: '0.06em', color: isDark ? darkTheme.sectionLabel : lightTheme.sectionLabel }}
      >
        {children}
      </Text>
      {helpId ? <HelpTrigger helpId={helpId} size="xs" /> : null}
    </Group>
  )
}
