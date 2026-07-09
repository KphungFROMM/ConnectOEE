import { useEffect, useState } from 'react'
import { Button, Card, Group, NumberInput, Stack, Switch, TextInput } from '@mantine/core'
import { IconMail } from '@tabler/icons-react'
import { getSmtp, saveSmtp, testSmtp } from '../../lib/reports'
import { notifyReport } from './ReportHistoryTab'

export function ReportSmtpTab() {
  const [host, setHost] = useState('')
  const [port, setPort] = useState(587)
  const [useSsl, setUseSsl] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [fromAddress, setFromAddress] = useState('connectoee@localhost')
  const [fromName, setFromName] = useState('ConnectOEE')
  const [testRecipient, setTestRecipient] = useState('')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    getSmtp()
      .then((s) => {
        setHost(s.host)
        setPort(s.port)
        setUseSsl(s.useSsl)
        setUsername(s.username ?? '')
        setHasPassword(s.hasPassword)
        setFromAddress(s.fromAddress)
        setFromName(s.fromName)
      })
      .catch(() => undefined)
  }, [])

  async function save() {
    setBusy(true)
    try {
      await saveSmtp({ host, port, useSsl, username, password: password || null, fromAddress, fromName })
      setPassword('')
      setHasPassword(true)
      notifyReport('SMTP settings saved')
    } catch {
      notifyReport('Failed to save SMTP settings', 'red')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    if (!testRecipient.trim()) {
      notifyReport('Enter a test recipient', 'red')
      return
    }
    setTesting(true)
    try {
      await testSmtp(testRecipient.trim())
      notifyReport('Test email sent')
    } catch (e) {
      notifyReport(e instanceof Error ? e.message : 'Test failed', 'red')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card withBorder radius="md" padding="lg" maw={560}>
      <Stack>
        <TextInput label="SMTP host" value={host} onChange={(e) => setHost(e.currentTarget.value)} />
        <Group grow>
          <NumberInput label="Port" value={port} onChange={(v) => setPort(Number(v) || 587)} />
          <Switch label="Use SSL/TLS" mt={28} checked={useSsl} onChange={(e) => setUseSsl(e.currentTarget.checked)} />
        </Group>
        <TextInput label="Username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
        <TextInput
          label="Password"
          type="password"
          placeholder={hasPassword ? '•••••••• (leave blank to keep)' : ''}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <Group grow>
          <TextInput label="From address" value={fromAddress} onChange={(e) => setFromAddress(e.currentTarget.value)} />
          <TextInput label="From name" value={fromName} onChange={(e) => setFromName(e.currentTarget.value)} />
        </Group>
        <TextInput
          label="Test recipient"
          placeholder="you@company.com"
          value={testRecipient}
          onChange={(e) => setTestRecipient(e.currentTarget.value)}
        />
        <Group>
          <Button loading={busy} onClick={save}>
            Save SMTP settings
          </Button>
          <Button leftSection={<IconMail size={16} />} variant="light" loading={testing} onClick={sendTest}>
            Send test email
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}
