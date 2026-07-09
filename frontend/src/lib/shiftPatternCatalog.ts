import type { ShiftDefinitionDto } from './admin'

export interface ShiftPatternTemplate {
  id: string
  name: string
  description: string
  definitions: Omit<ShiftDefinitionDto, 'id'>[]
}

function def(
  name: string,
  startTime: string,
  endTime: string,
  color: string,
  orderIndex: number,
  crossesMidnight = false,
): Omit<ShiftDefinitionDto, 'id'> {
  return {
    name,
    startTime,
    endTime,
    color,
    orderIndex,
    crossesMidnight: crossesMidnight || endTime <= startTime,
    breaks: [],
  }
}

export const SHIFT_PATTERN_TEMPLATES: ShiftPatternTemplate[] = [
  {
    id: 'threeX8',
    name: '3x8 Fixed',
    description: 'Three fixed 8-hour shifts — common for 24/5 or 24/7 production.',
    definitions: [
      def('Day', '06:00', '14:00', '#2E9E5B', 0),
      def('Swing', '14:00', '22:00', '#E0A800', 1),
      def('Night', '22:00', '06:00', '#4C8DFF', 2, true),
    ],
  },
  {
    id: 'twoX12',
    name: '2x12 Day / Night',
    description: 'Two 12-hour shifts covering the full day.',
    definitions: [
      def('Day', '06:00', '18:00', '#2E9E5B', 0),
      def('Night', '18:00', '06:00', '#4C8DFF', 1, true),
    ],
  },
  {
    id: 'single8',
    name: 'Single 8-hour',
    description: 'One day shift — typical for single-shift plants.',
    definitions: [def('Day', '07:00', '15:00', '#2E9E5B', 0)],
  },
  {
    id: 'twentyFourSeven',
    name: '24/7 Continuous',
    description: 'Single full-day production block for always-on lines.',
    definitions: [def('Production', '00:00', '00:00', '#4C8DFF', 0, true)],
  },
]

export function applyShiftTemplate(templateId: string | null): {
  name: string
  definitions: ShiftDefinitionDto[]
} {
  if (!templateId) {
    return {
      name: '',
      definitions: [{ name: '', startTime: '06:00', endTime: '14:00', color: '#2E9E5B', orderIndex: 0, breaks: [] }],
    }
  }
  const t = SHIFT_PATTERN_TEMPLATES.find((x) => x.id === templateId)
  if (!t) {
    return {
      name: '',
      definitions: [{ name: '', startTime: '06:00', endTime: '14:00', color: '#2E9E5B', orderIndex: 0, breaks: [] }],
    }
  }
  return {
    name: t.name,
    definitions: t.definitions.map((d, i) => ({
      ...d,
      orderIndex: d.orderIndex ?? i,
      breaks: d.breaks ?? [],
      crossesMidnight: d.crossesMidnight ?? d.endTime <= d.startTime,
    })),
  }
}
