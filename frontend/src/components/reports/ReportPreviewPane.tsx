import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Loader, Stack, Text } from '@mantine/core'

export function ReportPreviewPane({
  blob,
  format,
  loading,
  error,
}: {
  blob: Blob | null
  format: 'Pdf' | 'Csv'
  loading: boolean
  error: string | null
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    if (blob) {
      urlRef.current = URL.createObjectURL(blob)
      setPreviewUrl(urlRef.current)
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

  if (loading) {
    return (
      <Stack align="center" justify="center" h={480}>
        <Loader />
        <Text size="sm" c="dimmed">
          Building preview…
        </Text>
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert color="red" title="Preview failed">
        {error}
      </Alert>
    )
  }

  if (!blob) {
    return (
      <Stack align="center" justify="center" h={480} gap="xs">
        <Text fw={600}>Report preview</Text>
        <Text size="sm" c="dimmed" ta="center">
          Choose a template, scope, and range, then click Preview to see the report here before downloading.
        </Text>
      </Stack>
    )
  }

  if (format === 'Csv') {
    return <CsvTextPreview blob={blob} />
  }

  return (
    <Box
      component="iframe"
      src={previewUrl ?? undefined}
      title="Report preview"
      style={{ width: '100%', height: 520, border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
    />
  )
}

function CsvTextPreview({ blob }: { blob: Blob }) {
  const [text, setText] = useState('Loading…')
  useEffect(() => {
    void blob.text().then((t) => setText(t.split('\n').slice(0, 40).join('\n')))
  }, [blob])
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        CSV preview (first lines)
      </Text>
      <Box
        component="pre"
        style={{
          fontSize: 11,
          maxHeight: 480,
          overflow: 'auto',
          padding: 12,
          background: 'var(--mantine-color-gray-0)',
          borderRadius: 8,
        }}
      >
        {text}
      </Box>
    </Stack>
  )
}
