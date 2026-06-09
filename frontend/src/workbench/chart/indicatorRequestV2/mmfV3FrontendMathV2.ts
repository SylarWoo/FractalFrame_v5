import type { KLineData } from 'klinecharts'
import type { StoreV6WindowKLine } from '../pageSliceV2'

export function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function numeric(value: unknown, fallback = Number.NaN) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

export function clampInteger(value: unknown, fallback: number, minimum = 1, maximum = 500) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(minimum, Math.min(maximum, next)) : fallback
}

export function toMmfV3KLineDataV2(row: StoreV6WindowKLine): KLineData {
  return {
    barKey: row.barKey,
    close: numeric(row.close, 0),
    high: numeric(row.high, 0),
    low: numeric(row.low, 0),
    open: numeric(row.open, 0),
    period: row.period,
    sessionId: row.sessionId,
    symbol: row.symbol,
    time: numeric(row.time, 0),
    timestamp: numeric(row.timestamp, 0),
    tradingDay: row.tradingDay,
    turnover: finiteNumber(row.turnover) ? row.turnover : undefined,
    volume: numeric(row.volume ?? 0, 0),
  } as KLineData
}
