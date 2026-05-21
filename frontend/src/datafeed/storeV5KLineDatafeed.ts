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

export async function loadStoreV5KLineData(options: {
  symbol: string
  period: string
  limit?: number
  timeFrom?: number
  timeTo?: number
}): Promise<KLineData[]> {
  const timeframe = normalizeTimeframe(options.period)
  const mode = timeframe === 'M1' ? 'direct' : 'aggregated'
  let payload: StoreV5QueryPayload
  try {
    payload = await queryStoreV5Ohlcv({
      symbol: options.symbol,
      timeframe,
      mode,
      baseTimeframe: mode === 'aggregated' ? 'M1' : undefined,
      anchor: mode === 'aggregated' ? 'UTC2200' : undefined,
      timeFrom: options.timeFrom,
      timeTo: options.timeTo,
      limit: options.limit ?? 1000,
    })
  } catch (error) {
    if (timeframe !== 'M1' || !String(error instanceof Error ? error.message : error).includes('dataset_not_found')) {
      throw error
    }
    payload = await queryStoreV5Ohlcv({
      symbol: options.symbol,
      timeframe,
      mode: 'raw_direct',
      timeFrom: options.timeFrom,
      timeTo: options.timeTo,
      limit: options.limit ?? 1000,
    })
  }

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
