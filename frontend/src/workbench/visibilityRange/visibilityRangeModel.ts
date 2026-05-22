import { readJson, writeJson } from '../persistence/jsonStorage'

export type VisibilityRangeUnitKey = 'minutes' | 'hours' | 'days' | 'weeks' | 'months'

export type VisibilityRangeRow = {
  enabled: boolean
  from: number
  key: VisibilityRangeUnitKey
  label: string
  max: number
  min: number
  to: number
}

export type VisibilityRangePeriod = {
  unit: VisibilityRangeUnitKey
  value: number
}

export const visibilityRangeChangedEvent = 'visibilityRangeChanged'

export const defaultVisibilityRangeRows: VisibilityRangeRow[] = [
  { enabled: true, from: 1, key: 'minutes', label: '\u5206\u949f', max: 59, min: 1, to: 59 },
  { enabled: true, from: 1, key: 'hours', label: '\u5c0f\u65f6', max: 24, min: 1, to: 24 },
  { enabled: true, from: 1, key: 'days', label: '\u65e5', max: 366, min: 1, to: 366 },
  { enabled: true, from: 1, key: 'weeks', label: '\u5468', max: 52, min: 1, to: 52 },
  { enabled: true, from: 1, key: 'months', label: '\u4e2a\u6708', max: 12, min: 1, to: 12 },
]

export function clampVisibilityRangeValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function normalizeVisibilityRangeRows(input: unknown): VisibilityRangeRow[] {
  const saved = Array.isArray(input) ? input : []
  return defaultVisibilityRangeRows.map((fallback) => {
    const match = saved.find((item): item is Partial<VisibilityRangeRow> => {
      return item != null && typeof item === 'object' && (item as Partial<VisibilityRangeRow>).key === fallback.key
    })
    const from = clampVisibilityRangeValue(Number(match?.from ?? fallback.from), fallback.min, fallback.max)
    const to = clampVisibilityRangeValue(Number(match?.to ?? fallback.to), fallback.min, fallback.max)
    return {
      ...fallback,
      enabled: typeof match?.enabled === 'boolean' ? match.enabled : fallback.enabled,
      from: Math.min(from, to),
      to: Math.max(from, to),
    }
  })
}

export function visibilityRangeStorageKey(key?: string) {
  return key ? `fractalframe:visibilityRange:${key}:v1` : ''
}

export function readVisibilityRangeRows(key?: string) {
  const resolvedKey = visibilityRangeStorageKey(key)
  return resolvedKey
    ? normalizeVisibilityRangeRows(readJson(resolvedKey, null))
    : normalizeVisibilityRangeRows(null)
}

export function writeVisibilityRangeRows(key: string | undefined, rows: VisibilityRangeRow[]) {
  const resolvedKey = visibilityRangeStorageKey(key)
  if (!resolvedKey) return false
  const normalizedRows = normalizeVisibilityRangeRows(rows)
  const written = writeJson(resolvedKey, normalizedRows)
  if (written) dispatchVisibilityRangeChanged(key, normalizedRows)
  return written
}

export function dispatchVisibilityRangeChanged(key: string | undefined, rows: VisibilityRangeRow[]) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(visibilityRangeChangedEvent, {
    detail: {
      key,
      rows,
    },
  }))
}

export function parseChartPeriodForVisibilityRange(period: string): VisibilityRangePeriod | null {
  const normalized = period.trim().toUpperCase()
  if (!normalized) return null

  if (normalized === '1M' || normalized === 'M1') return { unit: 'minutes', value: 1 }
  if (/^M\d+$/.test(normalized)) return positivePeriod('minutes', Number(normalized.slice(1)))
  if (/^\d+M$/.test(normalized) && normalized !== '1MN') return positivePeriod('minutes', Number(normalized.slice(0, -1)))

  if (/^H\d+$/.test(normalized)) return positivePeriod('hours', Number(normalized.slice(1)))
  if (/^\d+H$/.test(normalized)) return positivePeriod('hours', Number(normalized.slice(0, -1)))

  if (/^D\d+$/.test(normalized)) return positivePeriod('days', Number(normalized.slice(1)))
  if (/^\d+D$/.test(normalized)) return positivePeriod('days', Number(normalized.slice(0, -1)))

  if (/^W\d+$/.test(normalized)) return positivePeriod('weeks', Number(normalized.slice(1)))
  if (/^\d+W$/.test(normalized)) return positivePeriod('weeks', Number(normalized.slice(0, -1)))

  if (/^MN\d+$/.test(normalized)) return positivePeriod('months', Number(normalized.slice(2)))
  if (/^\d+MN$/.test(normalized)) return positivePeriod('months', Number(normalized.slice(0, -2)))

  return null
}

export function isPeriodVisibleByVisibilityRange(rows: VisibilityRangeRow[], period: string) {
  const parsed = parseChartPeriodForVisibilityRange(period)
  if (!parsed) return true
  const row = normalizeVisibilityRangeRows(rows).find((item) => item.key === parsed.unit)
  if (!row) return true
  return row.enabled && parsed.value >= row.from && parsed.value <= row.to
}

export function isStoredVisibilityRangePeriodVisible(key: string | undefined, period: string) {
  return isPeriodVisibleByVisibilityRange(readVisibilityRangeRows(key), period)
}

function positivePeriod(unit: VisibilityRangeUnitKey, value: number): VisibilityRangePeriod | null {
  return Number.isFinite(value) && value > 0 ? { unit, value } : null
}
