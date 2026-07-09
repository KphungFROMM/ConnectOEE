import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Brand blue ramp (approx around #2563EB / #4C8DFF accents).
const brandBlue: MantineColorsTuple = [
  '#eaf2fe',
  '#d3e0fb',
  '#a6c0f6',
  '#769ef1',
  '#5081ec',
  '#386fea',
  '#2563eb',
  '#1d4fd7',
  '#1645c0',
  '#0a3aa9',
]

export const theme = createTheme({
  primaryColor: 'brand',
  colors: { brand: brandBlue },
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  defaultRadius: 'md',
  headings: { fontWeight: '600' },
})
