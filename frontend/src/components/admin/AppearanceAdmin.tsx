import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon,
  Button,
  ColorPicker,
  ColorSwatch,
  FileButton,
  Group,
  Image,
  Paper,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFolderOpen, IconTrash } from '@tabler/icons-react'
import { GaugeRing } from '../widgets/design/GaugeRing'
import { useAppearance } from '../../lib/AppearanceProvider'
import {
  DEFAULT_HEADER_LOGO,
  PRODUCT_NAME,
  defaultAppearanceSettings,
  isCustomHeaderTitle,
  resolveHeaderLogoUrl,
  resolveHeaderTitle,
  uploadAppearanceLogo,
  type AppearanceSettings,
} from '../../lib/appearance'
import { isCssColorHex, resolveCssColorToHex } from '../../theme/resolveCssColor'

function isValidColors(settings: AppearanceSettings): boolean {
  return (
    isCssColorHex(settings.oeeHex) &&
    isCssColorHex(settings.availabilityHex) &&
    isCssColorHex(settings.performanceHex) &&
    isCssColorHex(settings.qualityHex) &&
    isCssColorHex(settings.runningHex) &&
    isCssColorHex(settings.warningHex) &&
    isCssColorHex(settings.faultHex) &&
    isCssColorHex(settings.idleHex)
  )
}

function FactorColorField({
  label,
  value,
  onHex,
  swatch,
}: {
  label: string
  value: string
  onHex: (hex: string) => void
  swatch: string
}) {
  const [text, setText] = useState(value)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    setText(value)
  }, [value])

  function commit(raw: string): boolean {
    const hex = resolveCssColorToHex(raw)
    if (!hex) return false
    setText(hex)
    onHex(hex)
    return true
  }

  const preview = resolveCssColorToHex(text) ?? value

  return (
    <TextInput
      label={label}
      description="Hex or name (blue, cyan, purple…)"
      value={text}
      leftSection={<ColorSwatch color={preview} size={16} />}
      rightSection={
        <Popover opened={pickerOpen} onChange={setPickerOpen} position="bottom-end" shadow="md" withArrow>
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`${label} color picker`}
              onClick={() => setPickerOpen((o) => !o)}
            >
              <ColorSwatch color={preview} size={18} style={{ cursor: 'pointer' }} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <ColorPicker
              format="hex"
              value={value}
              onChange={(hex) => {
                setText(hex)
                onHex(hex)
              }}
              swatches={[swatch, '#0000FF', '#FF0000', '#00FFFF', '#800080', '#008000', '#FFA500']}
              swatchesPerRow={7}
            />
          </Popover.Dropdown>
        </Popover>
      }
      rightSectionWidth={36}
      onChange={(e) => {
        const raw = e.currentTarget.value
        setText(raw)
        const hex = resolveCssColorToHex(raw)
        if (hex) onHex(hex)
      }}
      onBlur={() => {
        if (!commit(text)) setText(value)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (!commit(text)) setText(value)
      }}
    />
  )
}

export function AppearanceAdmin() {
  const { settings: saved, ready, save, reset, setLocal } = useAppearance()
  const [draft, setDraft] = useState<AppearanceSettings>(saved)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const resetLogoPicker = useRef<() => void>(null)

  useEffect(() => {
    setDraft(saved)
    if (!saved.headerLogoUrl.trim()) setLogoFile(null)
  }, [saved])

  function patch(partial: Partial<AppearanceSettings>) {
    const next = { ...draft, ...partial }
    setDraft(next)
    if (isValidColors(next)) setLocal(next)
  }

  async function onSave() {
    if (!isValidColors(draft)) {
      notifications.show({ color: 'red', message: 'Each color must be a valid hex or CSS name (e.g. blue)' })
      return
    }
    if (draft.headerTitle.trim().length > 80) {
      notifications.show({ color: 'red', message: 'Header title must be 80 characters or fewer' })
      return
    }
    setSaving(true)
    try {
      await save(draft)
      notifications.show({ color: 'teal', message: 'Appearance saved' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Save failed',
      })
    } finally {
      setSaving(false)
    }
  }

  async function onReset() {
    setSaving(true)
    try {
      await reset()
      setLogoFile(null)
      notifications.show({ color: 'teal', message: 'Restored default appearance' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Reset failed',
      })
    } finally {
      setSaving(false)
    }
  }

  async function onLogoChange(file: File | null) {
    if (!file) {
      setLogoFile(null)
      resetLogoPicker.current?.()
      const next = { ...draft, headerLogoUrl: '' }
      setDraft(next)
      setLocal(next)
      setUploading(true)
      try {
        await save(next)
        notifications.show({ color: 'teal', message: 'Restored default header logo' })
      } catch (err) {
        notifications.show({
          color: 'red',
          message: err instanceof Error ? err.message : 'Could not clear logo',
        })
      } finally {
        setUploading(false)
      }
      return
    }
    setUploading(true)
    setLogoFile(file)
    try {
      const next = await uploadAppearanceLogo(file)
      setDraft(next)
      setLocal(next)
      notifications.show({ color: 'teal', message: 'Header logo uploaded' })
    } catch (err) {
      setLogoFile(null)
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Upload failed',
      })
    } finally {
      setUploading(false)
    }
  }

  if (!ready) {
    return (
      <Text c="dimmed" size="sm">
        Loading appearance…
      </Text>
    )
  }

  const defaults = defaultAppearanceSettings()
  const previewTitle = resolveHeaderTitle(draft)
  const previewLogo = resolveHeaderLogoUrl(draft)
  const customTitle = isCustomHeaderTitle(draft)
  const hasCustomLogo = Boolean(draft.headerLogoUrl.trim())

  return (
    <Stack gap="lg">
      <div>
        <Title order={4}>Header branding</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Customize the app header logo and title for your plant. {PRODUCT_NAME} stays visible in the navigation
          sidebar{customTitle ? ' and under your title' : ''}.
        </Text>
      </div>

      <Paper withBorder p="md" radius="md">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Stack gap="md">
            <Group align="flex-start" gap="md" wrap="nowrap">
              <Image
                src={previewLogo}
                alt="Header logo preview"
                w={48}
                h={48}
                fit="contain"
                fallbackSrc={DEFAULT_HEADER_LOGO}
                style={{
                  background: 'var(--mantine-color-body)',
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 8,
                  padding: 4,
                  flexShrink: 0,
                }}
              />
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={600}>
                  {previewTitle}
                </Text>
                {customTitle ? (
                  <Text size="xs" c="dimmed">
                    {PRODUCT_NAME}
                  </Text>
                ) : null}
              </Stack>
            </Group>

            <TextInput
              label="Header title"
              description={`Leave blank to show “${PRODUCT_NAME}”.`}
              placeholder={PRODUCT_NAME}
              value={draft.headerTitle}
              maxLength={80}
              onChange={(e) => patch({ headerTitle: e.currentTarget.value })}
            />
          </Stack>

          <div>
            <Text size="sm" fw={500} mb={4}>
              Header logo
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              PNG, JPG, WEBP, GIF, or SVG — max 2 MB
            </Text>
            <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-body)">
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  <Image
                    src={previewLogo}
                    alt=""
                    w={40}
                    h={40}
                    fit="contain"
                    fallbackSrc={DEFAULT_HEADER_LOGO}
                    style={{
                      borderRadius: 6,
                      border: '1px solid var(--mantine-color-default-border)',
                      padding: 2,
                      flexShrink: 0,
                    }}
                  />
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate>
                      {logoFile?.name ?? (hasCustomLogo ? 'Custom logo uploaded' : 'Default ConnectOEE icon')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {hasCustomLogo || logoFile
                        ? 'Shown in the app header'
                        : 'Using the product icon until you choose a file'}
                    </Text>
                  </Stack>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <FileButton
                    resetRef={resetLogoPicker}
                    onChange={(f) => void onLogoChange(f)}
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  >
                    {(props) => (
                      <Button
                        {...props}
                        size="sm"
                        variant="light"
                        leftSection={<IconFolderOpen size={16} />}
                        loading={uploading}
                      >
                        Browse…
                      </Button>
                    )}
                  </FileButton>
                  {hasCustomLogo || logoFile ? (
                    <Button
                      size="sm"
                      variant="default"
                      leftSection={<IconTrash size={16} />}
                      disabled={uploading}
                      onClick={() => void onLogoChange(null)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </Group>
              </Group>
            </Paper>
          </div>
        </SimpleGrid>
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Stack gap="sm">
          <div>
            <Title order={4}>KPI identity colors</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Same metric, same color on every board (OEE / Availability / Performance / Quality). Type a hex code or a
              CSS color name (blue, cyan, purple…). Does not change By value band mode on individual widgets.
            </Text>
          </div>

          <Paper withBorder p="md" radius="md" style={{ flex: 1 }}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <FactorColorField
                label="OEE"
                value={draft.oeeHex}
                swatch={defaults.oeeHex}
                onHex={(hex) => patch({ oeeHex: hex })}
              />
              <FactorColorField
                label="Availability"
                value={draft.availabilityHex}
                swatch={defaults.availabilityHex}
                onHex={(hex) => patch({ availabilityHex: hex })}
              />
              <FactorColorField
                label="Performance"
                value={draft.performanceHex}
                swatch={defaults.performanceHex}
                onHex={(hex) => patch({ performanceHex: hex })}
              />
              <FactorColorField
                label="Quality"
                value={draft.qualityHex}
                swatch={defaults.qualityHex}
                onHex={(hex) => patch({ qualityHex: hex })}
              />
            </SimpleGrid>

            <Group gap="xl" justify="center" mt="lg" wrap="wrap">
              <GaugeRing value={85} label="OEE" size={88} ringColor={draft.oeeHex} showLabelBelow valueOutside={false} decimals={0} />
              <GaugeRing value={92} label="A" size={88} ringColor={draft.availabilityHex} showLabelBelow valueOutside={false} decimals={0} />
              <GaugeRing value={88} label="P" size={88} ringColor={draft.performanceHex} showLabelBelow valueOutside={false} decimals={0} />
              <GaugeRing value={97} label="Q" size={88} ringColor={draft.qualityHex} showLabelBelow valueOutside={false} decimals={0} />
            </Group>
          </Paper>
        </Stack>

        <Stack gap="sm">
          <div>
            <Title order={4}>Status / Andon colors</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Running, warning, fault, and idle used for line lights, Andon stacks, connection state, and KPI band
              alerts.
            </Text>
          </div>

          <Paper withBorder p="md" radius="md" style={{ flex: 1 }}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <FactorColorField
                label="Running"
                value={draft.runningHex}
                swatch={defaults.runningHex}
                onHex={(hex) => patch({ runningHex: hex })}
              />
              <FactorColorField
                label="Warning"
                value={draft.warningHex}
                swatch={defaults.warningHex}
                onHex={(hex) => patch({ warningHex: hex })}
              />
              <FactorColorField
                label="Fault"
                value={draft.faultHex}
                swatch={defaults.faultHex}
                onHex={(hex) => patch({ faultHex: hex })}
              />
              <FactorColorField
                label="Idle"
                value={draft.idleHex}
                swatch={defaults.idleHex}
                onHex={(hex) => patch({ idleHex: hex })}
              />
            </SimpleGrid>

            <Group gap="md" justify="center" mt="lg" wrap="wrap">
              {(
                [
                  ['Running', draft.runningHex],
                  ['Warning', draft.warningHex],
                  ['Fault', draft.faultHex],
                  ['Idle', draft.idleHex],
                ] as const
              ).map(([label, hex]) => (
                <Stack key={label} gap={6} align="center">
                  <ColorSwatch color={hex} size={36} />
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                    {label}
                  </Text>
                </Stack>
              ))}
            </Group>
          </Paper>
        </Stack>
      </SimpleGrid>

      <Group>
        <Button onClick={() => void onSave()} loading={saving} disabled={!isValidColors(draft)}>
          Save
        </Button>
        <Button variant="light" onClick={() => void onReset()} loading={saving}>
          Reset to defaults
        </Button>
      </Group>
    </Stack>
  )
}
