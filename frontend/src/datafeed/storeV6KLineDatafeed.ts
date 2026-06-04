import type { KLineData } from 'klinecharts'
import { queryStoreV6Ohlcv } from '../services/mt5/mt5SymbolsApi'
import type { StoreV6QueryPayload } from '../services/mt5/mt5SymbolsApi'
import { enrichRealtimeBarIdentity, normalizeRealtimePeriod } from '../workbench/chart/realtimeBarIdentity'

function normalizeTimeframe(period: string) {
  return normalizeRealtimePeriod(period)
}

function estimateTurnover(high: number, low: number, close: number, volume: number) {
  const typicalPrice = Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
    ? (high + low + close) / 3
    : close
  return Number.isFinite(typicalPrice) && Number.isFinite(volume) ? typicalPrice * volume : 0
}

const inFlightLoads = new Map<string, Promise<KLineData[]>>()

function createLoadKey(options: {
  indexFrom?: number
  indexTo?: number
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
    options.indexFrom ?? '',
    options.indexTo ?? '',
    options.timeFrom ?? '',
    options.timeTo ?? '',
  ].join('|')
}

export async function loadStoreV6KLineData(options: {
  indexFrom?: number
  indexTo?: number
  symbol: string
  period: string
  limit?: number
  timeFrom?: number
  timeTo?: number
}): Promise<KLineData[]> {
  const loadKey = createLoadKey(options)
  const existingLoad = inFlightLoads.get(loadKey)
  if (existingLoad) return existingLoad

  const load = queryStoreV6KLineData(options)
  inFlightLoads.set(loadKey, load)
  load.finally(() => {
    if (inFlightLoads.get(loadKey) === load) inFlightLoads.delete(loadKey)
  })
  return load
}

async function queryStoreV6KLineData(options: {
  indexFrom?: number
  indexTo?: number
  symbol: string
  period: string
  limit?: number
  timeFrom?: number
  timeTo?: number
}): Promise<KLineData[]> {
  const timeframe = normalizeTimeframe(options.period)
  const isDirectM1 = timeframe === 'M1'
  const payload: StoreV6QueryPayload = await queryStoreV6Ohlcv({
    anchor: isDirectM1 ? undefined : 'UTC2200',
    baseTimeframe: isDirectM1 ? undefined : 'M1',
    mode: isDirectM1 ? 'direct' : 'aggregated',
    symbol: options.symbol,
    timeframe,
    indexFrom: options.indexFrom,
    indexTo: options.indexTo,
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
    const enriched = enrichRealtimeBarIdentity({
      barKey: typeof row.barKey === 'string' ? row.barKey : undefined,
      globalIndex: typeof row.globalIndex === 'number' ? row.globalIndex : undefined,
      timestamp,
      open: Number(row.open),
      high,
      low,
      close,
      volume,
      sessionId: typeof row.sessionId === 'string' ? row.sessionId : undefined,
      tradingDay: typeof row.tradingDay === 'string' ? row.tradingDay : undefined,
      turnover: estimateTurnover(high, low, close, volume),
    } as KLineData, {
      isRealtime: false,
      period: timeframe,
      source: 'storeV6',
      symbol: options.symbol,
    })
    if (enriched) rowsByTimestamp.set(timestamp, enriched)
  })

  return [...rowsByTimestamp.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}
