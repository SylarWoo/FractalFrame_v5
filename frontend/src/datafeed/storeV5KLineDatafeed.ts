import type { KLineData } from 'klinecharts'
import { queryStoreV5Ohlcv } from '../services/mt5/mt5SymbolsApi'
import type { StoreV5QueryPayload } from '../services/mt5/mt5SymbolsApi'

function normalizeTimeframe(period: string) {
  const value = period.trim().toUpperCase()
  if (value === '1M' || value === 'M1') return 'M1'
  if (value.endsWith('M') && value !== 'MN1') return `M${value.slice(0, -1)}`
  if (value.endsWith('H')) return `H${value.slice(0, -1)}`
  return value
}

function estimateTurnover(high: number, low: number, close: number, volume: number) {
  const typicalPrice = Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
    ? (high + low + close) / 3
    : close
  return Number.isFinite(typicalPrice) && Number.isFinite(volume) ? typicalPrice * volume : 0
}

const inFlightLoads = new Map<string, Promise<KLineData[]>>()

function createLoadKey(options: {
  symbol: string
  period: string
  limit?: number
  timeFrom?: number
  timeTo?: number
}) {
  return [
    options.symbol.trim().toUpperCase(),
    normalizeTimeframe(options.period),
    options.limit ?? 1000,
    options.timeFrom ?? '',
    options.timeTo ?? '',
  ].join('|')
}

export async function loadStoreV5KLineData(options: {
  symbol: string
  period: string
  limit?: number
  timeFrom?: number
  timeTo?: number
}): Promise<KLineData[]> {
  const loadKey = createLoadKey(options)
  const existingLoad = inFlightLoads.get(loadKey)
  if (existingLoad) return existingLoad

  const load = queryStoreV5KLineData(options)
  inFlightLoads.set(loadKey, load)
  load.finally(() => {
    if (inFlightLoads.get(loadKey) === load) inFlightLoads.delete(loadKey)
  })
  return load
}

async function queryStoreV5KLineData(options: {
  symbol: string
  period: string
  limit?: number
  timeFrom?: number
  timeTo?: number
}): Promise<KLineData[]> {
  const timeframe = normalizeTimeframe(options.period)
  const isDirectM1 = timeframe === 'M1'
  const payload: StoreV5QueryPayload = await queryStoreV5Ohlcv({
    anchor: isDirectM1 ? undefined : 'UTC2200',
    baseTimeframe: isDirectM1 ? undefined : 'M1',
    mode: isDirectM1 ? 'direct' : 'aggregated',
    symbol: options.symbol,
    timeframe,
    timeFrom: options.timeFrom,
    timeTo: options.timeTo,
    limit: options.limit ?? 1000,
  })

  const rowsByTimestamp = new Map<number, KLineData>()
  payload.rows.forEach((row) => {
    const timestamp = Number(row.time) * 1000
    if (!Number.isFinite(timestamp)) return
    const high = Number(row.high)
    const low = Number(row.low)
    const close = Number(row.close)
    const volume = Number(row.volume ?? 0)
    rowsByTimestamp.set(timestamp, {
      timestamp,
      open: Number(row.open),
      high,
      low,
      close,
      volume,
      turnover: estimateTurnover(high, low, close, volume),
    })
  })

  return [...rowsByTimestamp.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}
