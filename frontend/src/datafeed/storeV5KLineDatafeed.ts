import type { KLineData } from 'klinecharts'
import { queryStoreV5Ohlcv } from '../workbench/rightDrawer/mt5SymbolsApi'
import type { StoreV5QueryPayload } from '../workbench/rightDrawer/mt5SymbolsApi'

function normalizeTimeframe(period: string) {
  const value = period.trim().toUpperCase()
  if (value === '1M' || value === 'M1') return 'M1'
  if (value.endsWith('M') && value !== 'MN1') return `M${value.slice(0, -1)}`
  if (value.endsWith('H')) return `H${value.slice(0, -1)}`
  return value
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

  return payload.rows.map((row) => ({
    timestamp: Number(row.time) * 1000,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume ?? 0),
  }))
}
