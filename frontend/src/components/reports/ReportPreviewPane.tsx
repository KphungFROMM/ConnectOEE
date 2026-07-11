import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconDownload, IconExternalLink, IconZoomIn, IconZoomOut } from '@tabler/icons-react'

export function ReportPreviewPane({
  blob,
  format,
  loading,
  error,
  builtAt,
  onDownload,
}: {
  blob: Blob | null
  format: 'Pdf' | 'Csv'
  loading: boolean
  error: string | null
  builtAt?: Date | null
  onDownload?: () => void
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    if (blob) {
      urlRef.current = URL.createObjectURL(blob)
      setPreviewUrl(urlRef.current)
      setZoom(100)
    } else {
      setPreviewUrl(null)
    }
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [blob])

  const height = 'min(72vh, calc(100vh - 220px))'

  return (
    <Paper withBorder radius="md" style={{ display: 'flex', flexDirection: 'column', minHeight: height, height }}>
      <Group
        justify="space-between"
        px="sm"
        py={8}
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}
      >
        <Group gap="xs">
          <Text size="sm" fw={650}>
            Preview
          </Text>
          <Badge size="sm" variant="light">
            {format === 'Pdf' ? 'PDF' : 'CSV'}
          </Badge>
          {builtAt ? (
            <Text size="xs" c="dimmed">
              Built {builtAt.toLocaleTimeString()}
            </Text>
          ) : null}
        </Group>
        <Group gap={4}>
          {format === 'Pdf' ? (
            <>
              <Tooltip label="Zoom out">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  disabled={!blob || zoom <= 75}
                  onClick={() => setZoom((z) => Math.max(75, z - 25))}
                >
                  <IconZoomOut size={16} />
                </ActionIcon>
              </Tooltip>
              <Text size="xs" c="dimmed" w={36} ta="center">
                {zoom}%
              </Text>
              <Tooltip label="Zoom in">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  disabled={!blob || zoom >= 150}
                  onClick={() => setZoom((z) => Math.min(150, z + 25))}
                >
                  <IconZoomIn size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          ) : null}
          {previewUrl ? (
            <Tooltip label="Open in new tab">
              <ActionIcon
                variant="subtle"
                size="sm"
                component="a"
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
              >
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {onDownload ? (
            <Tooltip label="Download">
              <ActionIcon variant="subtle" size="sm" disabled={!blob && !onDownload} onClick={onDownload}>
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </Group>

      <Box style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading ? (
          <Stack align="center" justify="center" h="100%" gap="xs">
            <Loader />
            <Text size="sm" c="dimmed">
              Building preview…
            </Text>
          </Stack>
        ) : error ? (
          <Box p="md">
            <Alert color="red" title="Preview failed">
              {error}
            </Alert>
          </Box>
        ) : !blob ? (
          <Stack align="center" justify="center" h="100%" gap="xs" px="xl">
            <Text fw={650}>Ready when you are</Text>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              Pick a template and scope. Preview builds automatically — or use Preview to refresh now.
            </Text>
          </Stack>
        ) : format === 'Csv' ? (
          <CsvTablePreview blob={blob} />
        ) : (
          <ScrollArea h="100%" type="auto">
            <Box
              component="iframe"
              src={previewUrl ?? undefined}
              title="Report preview"
              style={{
                width: `${zoom}%`,
                height: `calc(${height} - 8px)`,
                border: 'none',
                display: 'block',
                margin: '0 auto',
              }}
            />
          </ScrollArea>
        )}
      </Box>
    </Paper>
  )
}

function CsvTablePreview({ blob }: { blob: Blob }) {
  const [rows, setRows] = useState<string[][] | null>(null)
  useEffect(() => {
    void blob.text().then((t) => {
      const lines = t.split(/\r?\n/).filter((l) => l.length > 0).slice(0, 200)
      setRows(lines.map(parseCsvLine))
    })
  }, [blob])

  if (!rows) {
    return (
      <Text size="sm" c="dimmed" p="md">
        Loading CSV…
      </Text>
    )
  }
  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed" p="md">
        Empty CSV
      </Text>
    )
  }

  const header = rows[0] ?? []
  const body = rows.slice(1)

  return (
    <ScrollArea h="100%" type="auto">
      <Table striped highlightOnHover stickyHeader>
        <Table.Thead>
          <Table.Tr>
            {header.map((h, i) => (
              <Table.Th key={i}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {body.map((r, ri) => (
            <Table.Tr key={ri}>
              {header.map((_, ci) => (
                <Table.Td key={ci}>{r[ci] ?? ''}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}
