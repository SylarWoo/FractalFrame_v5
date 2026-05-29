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

export type MorganRangeLevel = {
  price: number
  ratio: number
}

export type MorganRangeSegment = {
  atr7: number
  center: number
  endIndex: number
  index: number
  levels: MorganRangeLevel[]
  lower: number
  range: number
  startIndex: number
  startTimestamp: number
  trueRange: number
  upper: number
}

export const morganRangeLevelRatios = [
  -1,
  -0.786,
  -0.618,
  -0.5,
  -0.382,
  -0.236,
  -0.177,
  -0.118,
  -0.059,
  0,
  0.059,
  0.118,
  0.177,
  0.236,
  0.382,
  0.5,
  0.618,
  0.786,
  1,
] as const

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

export function calculateMorganRangeLevels(center: number, range: number): MorganRangeLevel[] {
  if (!Number.isFinite(center) || !Number.isFinite(range)) return []
  return morganRangeLevelRatios.map((ratio) => ({
    price: center + range * ratio,
    ratio,
  }))
}

export function calculateMorganRangeSegments(dataList: KLineData[], futureBars = 0): MorganRangeSegment[] {
  const candles = collectH4MorganCandles(dataList)
  if (candles.length < 8) return []
  const atr = calculateH4MorganAtr7(candles)
  const safeFutureBars = Number.isFinite(futureBars) ? Math.max(0, Math.round(futureBars)) : 0
  const segments: MorganRangeSegment[] = []

  for (let index = 1; index < candles.length; index += 1) {
    const anchor = candles[index]
    const previous = candles[index - 1]
    const atr7 = Number(atr[index - 1])
    if (!anchor || !previous || !Number.isFinite(atr7)) continue
    const center = (previous.high + previous.low + previous.close) / 3
    const range = 3 * atr7
    if (!Number.isFinite(center) || !Number.isFinite(range) || range <= 0) continue
    const next = candles[index + 1]
    const endIndex = next
      ? Math.max(anchor.startIndex, next.startIndex - 1)
      : anchor.startIndex + safeFutureBars
    segments.push({
      atr7,
      center,
      endIndex,
      index,
      levels: calculateMorganRangeLevels(center, range),
      lower: center - range,
      range,
      startIndex: anchor.startIndex,
      startTimestamp: anchor.startTimestamp,
      trueRange: range * (0.236 - (-0.236)),
      upper: center + range,
    })
  }

  return segments
}

export function findMorganRangeSegmentByDataIndex(segments: MorganRangeSegment[], dataIndex: number) {
  if (!Number.isFinite(dataIndex)) return null
  const index = Math.round(dataIndex)
  return segments.find((segment) => index >= segment.startIndex && index <= segment.endIndex) ?? null
}

export function getMorganRangeLevel(segment: MorganRangeSegment | null | undefined, ratio: number) {
  if (!segment || !Number.isFinite(ratio)) return null
  const normalizedRatio = Number(ratio.toFixed(3))
  return segment.levels.find((level) => Number(level.ratio.toFixed(3)) === normalizedRatio) ?? {
    price: segment.center + segment.range * ratio,
    ratio,
  }
}
