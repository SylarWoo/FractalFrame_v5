import type { KLineData } from 'klinecharts'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'

export const h4MorganSeconds = 4 * 60 * 60
export const d1MorganSeconds = 24 * 60 * 60
const xauSessionAnchorSeconds = 22 * 60 * 60

export type MorganRangeMode = 'H4_M5' | 'D1_M30'

export type MorganRangeCandle = {
  close: number
  high: number
  low: number
  startIndex: number
  startTimestamp: number
}

export type H4MorganCandle = MorganRangeCandle

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

const morganRangeSegmentsCache = new Map<string, MorganRangeSegment[]>()

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

export function resolveD1MorganBucketKey(timestampMs: number) {
  return Math.floor((Math.floor(timestampMs / 1000) - xauSessionAnchorSeconds) / d1MorganSeconds)
}

export function resolveMorganRangeBucketSeconds(mode: MorganRangeMode) {
  return mode === 'D1_M30' ? d1MorganSeconds : h4MorganSeconds
}

export function resolveMorganRangeBucketKey(timestampMs: number, mode: MorganRangeMode) {
  return mode === 'D1_M30' ? resolveD1MorganBucketKey(timestampMs) : resolveH4MorganBucketKey(timestampMs)
}

export function collectMorganRangeCandles(dataList: KLineData[], mode: MorganRangeMode = 'H4_M5') {
  const realRows = stripFuturePlaceholders(dataList)
  const candles: MorganRangeCandle[] = []
  let activeKey: number | null = null
  let active: MorganRangeCandle | null = null

  realRows.forEach((row, index) => {
    const timestamp = resolveKLineTimestampMs(row)
    const high = Number(row.high)
    const low = Number(row.low)
    const close = Number(row.close)
    if (!Number.isFinite(timestamp) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) return

    const key = resolveMorganRangeBucketKey(timestamp, mode)
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

export function collectH4MorganCandles(dataList: KLineData[]) {
  return collectMorganRangeCandles(dataList, 'H4_M5')
}

export function collectD1MorganCandles(dataList: KLineData[]) {
  return collectMorganRangeCandles(dataList, 'D1_M30')
}

export function calculateMorganAtr7(candles: MorganRangeCandle[]) {
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

export function calculateH4MorganAtr7(candles: H4MorganCandle[]) {
  return calculateMorganAtr7(candles)
}

export function calculateMorganRangeLevels(center: number, range: number): MorganRangeLevel[] {
  if (!Number.isFinite(center) || !Number.isFinite(range)) return []
  return morganRangeLevelRatios.map((ratio) => ({
    price: center + range * ratio,
    ratio,
  }))
}

export function calculateMorganRangeSegmentsForMode(dataList: KLineData[], mode: MorganRangeMode = 'H4_M5', futureBars = 0): MorganRangeSegment[] {
  const candles = collectMorganRangeCandles(dataList, mode)
  if (candles.length < 8) return []
  const atr = calculateMorganAtr7(candles)
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

function createMorganRangeSegmentsCacheKey(dataList: KLineData[], mode: MorganRangeMode, futureBars: number) {
  const realRows = stripFuturePlaceholders(dataList)
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return [
    mode,
    Number.isFinite(futureBars) ? Math.max(0, Math.round(futureBars)) : 0,
    realRows.length,
    first?.timestamp,
    first?.open,
    first?.high,
    first?.low,
    first?.close,
    last?.timestamp,
    last?.open,
    last?.high,
    last?.low,
    last?.close,
  ].join('|')
}

export function calculateMorganRangeSegmentsForModeCached(dataList: KLineData[], mode: MorganRangeMode = 'H4_M5', futureBars = 0): MorganRangeSegment[] {
  const key = createMorganRangeSegmentsCacheKey(dataList, mode, futureBars)
  const cached = morganRangeSegmentsCache.get(key)
  if (cached) {
    morganRangeSegmentsCache.delete(key)
    morganRangeSegmentsCache.set(key, cached)
    return cached
  }
  const segments = calculateMorganRangeSegmentsForMode(dataList, mode, futureBars)
  morganRangeSegmentsCache.set(key, segments)
  while (morganRangeSegmentsCache.size > 48) {
    const oldest = morganRangeSegmentsCache.keys().next().value
    if (oldest == null) break
    morganRangeSegmentsCache.delete(oldest)
  }
  return segments
}

export function alignMorganRangeSegmentsToDisplayRows({
  calculationRows,
  displayRows,
  segments,
}: {
  calculationRows: KLineData[]
  displayRows: KLineData[]
  segments: MorganRangeSegment[]
}) {
  const realCalculationRows = stripFuturePlaceholders(calculationRows)
  const realDisplayRows = stripFuturePlaceholders(displayRows)
  if (!realCalculationRows.length || !realDisplayRows.length || !segments.length) return []

  const displayIndexByTimestamp = new Map<number, number>()
  realDisplayRows.forEach((row, index) => {
    const timestamp = Number(row.timestamp)
    if (Number.isFinite(timestamp)) displayIndexByTimestamp.set(timestamp, index)
  })

  const lastDisplayIndex = realDisplayRows.length - 1
  const aligned: MorganRangeSegment[] = []
  segments.forEach((segment) => {
    const startTimestamp = Number(realCalculationRows[segment.startIndex]?.timestamp ?? segment.startTimestamp)
    const endTimestamp = Number(realCalculationRows[Math.min(segment.endIndex, realCalculationRows.length - 1)]?.timestamp)
    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) return

    let startIndex: number | null = null
    let endIndex: number | null = null
    for (let index = 0; index < realDisplayRows.length; index += 1) {
      const timestamp = Number(realDisplayRows[index]?.timestamp)
      if (!Number.isFinite(timestamp)) continue
      if (timestamp >= startTimestamp && timestamp <= endTimestamp) {
        if (startIndex == null) startIndex = index
        endIndex = index
      }
    }

    if (startIndex == null || endIndex == null) {
      const exactStart = displayIndexByTimestamp.get(startTimestamp)
      const exactEnd = displayIndexByTimestamp.get(endTimestamp)
      if (exactStart == null && exactEnd == null) return
      startIndex = exactStart ?? 0
      endIndex = exactEnd ?? lastDisplayIndex
    }

    const displayStartRow = realDisplayRows[startIndex]
    if (!displayStartRow) return
    aligned.push({
      ...segment,
      endIndex: Math.max(startIndex, Math.min(endIndex, lastDisplayIndex)),
      startIndex,
      startTimestamp: Number(displayStartRow.timestamp),
    })
  })
  return aligned
}

export function calculateMorganRangeSegments(dataList: KLineData[], futureBars = 0): MorganRangeSegment[] {
  return calculateMorganRangeSegmentsForMode(dataList, 'H4_M5', futureBars)
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
