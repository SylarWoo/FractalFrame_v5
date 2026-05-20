import { readSettingsStringValue, readSettingsSymbolState } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'

export function resolvePeriodSeconds(period: string) {
  const normalized = period.trim().toUpperCase()
  if (normalized === '1M' || normalized === 'M1') return 60
  if (normalized.endsWith('M') && normalized !== 'MN1') return Number(normalized.slice(0, -1)) * 60 || 60
  if (normalized.endsWith('H')) return Number(normalized.slice(0, -1)) * 60 * 60 || 60 * 60
  if (normalized === 'D1') return 24 * 60 * 60
  if (normalized === 'W1') return 7 * 24 * 60 * 60
  return 60
}

export function readChartTimezone() {
  const value = readSettingsStringValue(chartSettingKeys.timezone, chartSettingDefaults.timezone)
  return value === 'exchange' ? 'UTC' : value
}

export function formatWeekday(timestamp: number, timezone: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, weekday: 'short' }).format(new Date(timestamp))
  } catch {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', weekday: 'short' }).format(new Date(timestamp))
  }
}

export function formatDateParts(dateTimeFormat: Intl.DateTimeFormat, timestamp: number) {
  const parts: Record<string, string> = {}
  dateTimeFormat.formatToParts(new Date(timestamp)).forEach(({ type, value }) => {
    if (type === 'year') parts.YYYY = value
    if (type === 'month') parts.MM = value
    if (type === 'day') parts.DD = value
    if (type === 'hour') parts.HH = value === '24' ? '00' : value
    if (type === 'minute') parts.mm = value
    if (type === 'second') parts.ss = value
  })
  const timezone = dateTimeFormat.resolvedOptions().timeZone || readChartTimezone()
  return {
    DD: parts.DD ?? '01',
    HH: parts.HH ?? '00',
    MM: parts.MM ?? '01',
    YYYY: parts.YYYY ?? '1970',
    mm: parts.mm ?? '00',
    ss: parts.ss ?? '00',
    weekday: formatWeekday(timestamp, timezone),
  }
}

export function formatChartDate(dateTimeFormat: Intl.DateTimeFormat, timestamp: number, format: string, type?: number) {
  const parts = formatDateParts(dateTimeFormat, timestamp)
  const settings = readSettingsSymbolState()
  const showWeekday = settings['coordinates.time.showWeekday'] !== false
  const dateFormat = typeof settings['coordinates.time.dateFormat'] === 'string'
    ? settings['coordinates.time.dateFormat']
    : 'ymd'
  const hourFormat = typeof settings['coordinates.time.hourFormat'] === 'string'
    ? settings['coordinates.time.hourFormat']
    : '24h'
  const hour24 = Number(parts.HH)
  const hour12 = Number.isFinite(hour24) ? ((hour24 + 11) % 12) + 1 : 12
  const suffix = Number.isFinite(hour24) && hour24 >= 12 ? 'PM' : 'AM'
  const timeText = hourFormat === '12h'
    ? `${String(hour12).padStart(2, '0')}:${parts.mm} ${suffix}`
    : `${parts.HH}:${parts.mm}`
  const dateText = dateFormat === 'dmy'
    ? `${parts.DD}/${parts.MM}/${parts.YYYY}`
    : dateFormat === 'mdy'
      ? `${parts.MM}/${parts.DD}/${parts.YYYY}`
      : `${parts.YYYY}/${parts.MM}/${parts.DD}`
  const dateWithWeekday = showWeekday ? `${parts.weekday} ${dateText}` : dateText
  const compactMonth = `${Number(parts.MM)}月`
  const compactDay = `${Number(parts.MM)}/${Number(parts.DD)}`

  if (type === 2) {
    if (format === 'HH:mm') return timeText
    if (format === 'YYYY') return parts.YYYY
    if (format === 'YYYY-MM') return compactMonth
    if (format === 'MM-DD') return compactDay
    if (format.includes('HH')) return `${compactDay} ${timeText}`
    if (format.includes('YYYY')) return `${parts.YYYY}/${Number(parts.MM)}/${Number(parts.DD)}`
    return compactDay
  }

  if (format === 'HH:mm') return timeText
  if (format === 'YYYY' || format === 'YYYY-MM' || format === 'MM-DD') return dateWithWeekday
  if (format.includes('YYYY') || format.includes('MM') || format.includes('DD')) {
    return format.includes('HH') ? `${dateWithWeekday} ${timeText}` : dateWithWeekday
  }
  return format
    .replace(/YYYY/g, parts.YYYY)
    .replace(/MM/g, parts.MM)
    .replace(/DD/g, parts.DD)
    .replace(/HH/g, parts.HH)
    .replace(/mm/g, parts.mm)
    .replace(/ss/g, parts.ss)
}


