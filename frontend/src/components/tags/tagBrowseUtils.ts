import type { BrowseTag, TagValueSample } from '../../lib/tags'

export const TAG_ROW_H = 34
export const TAG_VIEWPORT_H = 460
export const TAG_POLL_MS = 2000
export const TAG_MAX_PREVIEW = 80

export function tagTypeColor(t: string): string {
  switch (t) {
    case 'Bool':
      return 'grape'
    case 'Int':
    case 'Dint':
      return 'blue'
    case 'Real':
      return 'teal'
    case 'String':
      return 'orange'
    case 'Udt':
      return 'violet'
    case 'Array':
      return 'cyan'
    default:
      return 'gray'
  }
}

/** Human label for a browse node type — UDT containers show their type name. */
export function tagTypeLabel(tag: BrowseTag): string {
  if (tag.dataType === 'Udt' && tag.udtTypeName) return tag.udtTypeName
  if (tag.dataType === 'Array' && tag.udtTypeName) return `${tag.udtTypeName}[${tag.arrayLength}]`
  return tag.dataType + (tag.arrayLength > 0 ? `[${tag.arrayLength}]` : '')
}

export function formatTagValue(sample: TagValueSample | undefined): { text: string; color?: string } {
  if (!sample) return { text: '…', color: 'dimmed' }
  if (sample.quality === 'Bad') return { text: '—', color: 'red' }
  if (sample.display != null && sample.display !== '') return { text: sample.display }
  return { text: '…', color: 'dimmed' }
}

export const AUX_RUN_STATE_ROLES = new Set(['RunStateRunning', 'RunStateIdle', 'RunStateFaulted'])
