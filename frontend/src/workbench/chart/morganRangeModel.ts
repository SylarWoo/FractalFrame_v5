import type { KLineData } from 'klinecharts'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'

export const h4MorganSeconds = 4 * 60 * 60
const xauSessionAnchorSeconds = 22 * 60 * 60

export type H4MorganCandle = {
  close: number
  high: number
  low: number
  startIndex: number
  startTimestamp: number
}

export function resolveKLineTimestampMs(data: KLineData) {
  const row = data as KLineData & {
    realTime?: number
    realTimestamp?: number
    sourceTimestamp?: number
  }
  const raw = typeof row.realTime === 'number'
    ? row.realTime
    : typeof row.realTimestamp === 'number'
      ? row.realTimestamp
      : typeof row.sourceTimestamp === 'number'
        ? row.sourceTimestamp
        : data.timestamp
  return raw < 1_000_000_000_000 ? raw * 1000 : raw
}

export function resolveH4MorganBucketKey(timestampMs: number) {
  return Math.floor((Math.floor(timestampMs / 1000) - xauSessionAnchorSeconds) / h4MorganSeconds)
}

export function collectH4MorganCandles(dataList: KLineData[]) {
  const realRows = stripFuturePlaceholders(dataList)
  const candles: H4MorganCandle[] = []
  let activeKey: number | null = null
  let active: H4MorganCandle | null = null

  realRows.forEach((row, index) => {
    const timestamp = resolveKLineTimestampMs(row)
    const high = Number(row.high)
    const low = Number(row.low)
    const close = Number(row.close)
    if (!Number.isFinite(timestamp) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) return

    const key = resolveH4MorganBucketKey(timestamp)
    if (activeKey !== key || !active) {
      active = { close, high, low, startIndex: index, startTimestamp: Number(row.timestamp) }
      candles.push(active)
      activeKey = key
      return
    }
    active.high = Math.max(active.high, high)
    active.low = Math.min(active.low, low)
    active.close = close
  })

  return candles
}

export function calculateH4MorganAtr7(candles: H4MorganCandle[]) {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low
    const previousClose = candles[index - 1].close
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    )
  })

  return trueRanges.map((_, index) => {
    if (index < 6) return undefined
    let sum = 0
    for (let cursor = index - 6; cursor <= index; cursor += 1) {
      sum += trueRanges[cursor]
    }
    return sum / 7
  })
}
