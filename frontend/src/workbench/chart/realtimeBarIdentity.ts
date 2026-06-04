import type { KLineData } from 'klinecharts'

export type RealtimeBarIdentityStatus = 'confirmed' | 'provisional'
export type RealtimeBarSource = 'mt5Tick' | 'realtimeCache' | 'storeV6'

export type RealtimeKLineData = KLineData & {
  barKey: string
  globalIndex?: number | null
  identityStatus: RealtimeBarIdentityStatus
  isClosed?: boolean
  isRealtime?: boolean
  period: string
  sessionId?: string
  source: RealtimeBarSource
  symbol: string
  time: number
  tradingDay?: string
}

export function normalizeRealtimePeriod(period: string) {
  const value = period.trim().toUpperCase()
  if (value === '1M' || value === 'M1') return 'M1'
  if (value === 'MN' || value === 'MN1') return 'MN1'
  if (/^\d+M$/.test(value)) return `M${value.slice(0, -1)}`
  if (/^\d+H$/.test(value)) return `H${value.slice(0, -1)}`
  return value
}

export function normalizeRealtimeSymbol(symbol: string) {
  return symbol.trim()
}

export function getRealtimeBarTime(row: KLineData) {
  return Math.floor(Number(row.timestamp) / 1000)
}

export function createRealtimeBarKey(symbol: string, period: string, time: number) {
  return `${normalizeRealtimeSymbol(symbol)}|${normalizeRealtimePeriod(period)}|${Math.floor(time)}`
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function optionalNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function enrichRealtimeBarIdentity(
  row: KLineData,
  options: {
    isClosed?: boolean
    isRealtime?: boolean
    period: string
    source: RealtimeBarSource
    symbol: string
  },
): RealtimeKLineData | null {
  const timestamp = Number(row.timestamp)
  if (!Number.isFinite(timestamp)) return null
  const time = getRealtimeBarTime({ ...row, timestamp })
  if (!Number.isFinite(time)) return null
  const source = row as Partial<RealtimeKLineData>
  const symbol = normalizeRealtimeSymbol(optionalString(source.symbol) ?? options.symbol)
  const period = normalizeRealtimePeriod(optionalString(source.period) ?? options.period)
  const barKey = optionalString(source.barKey) ?? createRealtimeBarKey(symbol, period, time)
  const globalIndex = optionalNumber(source.globalIndex)
  const sessionId = optionalString(source.sessionId)
  const tradingDay = optionalString(source.tradingDay)
  const confirmed = globalIndex != null || sessionId != null || tradingDay != null || optionalString(source.barKey) != null

  return {
    ...row,
    barKey,
    globalIndex: globalIndex ?? null,
    identityStatus: confirmed ? 'confirmed' : 'provisional',
    isClosed: options.isClosed ?? source.isClosed ?? options.source === 'storeV6',
    isRealtime: options.isRealtime ?? source.isRealtime ?? options.source !== 'storeV6',
    period,
    ...(sessionId ? { sessionId } : {}),
    source: options.source,
    symbol,
    time,
    ...(tradingDay ? { tradingDay } : {}),
    timestamp,
  }
}

export function normalizeRealtimeBars(
  rows: KLineData[],
  options: {
    isRealtime?: boolean
    period: string
    source: RealtimeBarSource
    symbol: string
  },
) {
  const byBarKey = new Map<string, RealtimeKLineData>()
  rows.forEach((row, index) => {
    const enriched = enrichRealtimeBarIdentity(row, {
      ...options,
      isClosed: index < rows.length - 1 || options.source === 'storeV6',
    })
    if (!enriched) return
    byBarKey.set(enriched.barKey, enriched)
  })
  return [...byBarKey.values()]
    .sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}
