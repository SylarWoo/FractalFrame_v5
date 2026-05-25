import type { Chart } from 'klinecharts'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { createStaticMorganRangeOverlay } from './morganRangeOverlay'
import { calculateH4MorganAtr7, collectH4MorganCandles, h4MorganSeconds, type H4MorganCandle } from './morganRangeModel'

const maxMorganRangeBuckets = 36

export function clearMorganRangeOverlays(chart: Chart, overlayIds: Set<string>) {
  overlayIds.forEach((id) => chart.removeOverlay({ id }))
  overlayIds.clear()
}

export function applyMorganRangeOverlays(chart: Chart, period: string, overlayIds: Set<string>) {
  clearMorganRangeOverlays(chart, overlayIds)
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0 || periodSeconds > 2 * 60 * 60) return

  const candles = collectH4MorganCandles(chart.getDataList())
  if (candles.length < 8) return
  const atr = calculateH4MorganAtr7(candles)
  const futureBars = Math.round(h4MorganSeconds / periodSeconds)
  const barSpace = Number(chart.getBarSpace())
  const futureWidthPx = futureBars * barSpace
  const startBoundaryOffsetPx = -barSpace / 2
  if (!Number.isFinite(futureBars) || futureBars <= 0 || !Number.isFinite(futureWidthPx) || futureWidthPx <= 0) return
  const visibleRange = chart.getVisibleRange()
  const visibleFrom = Math.floor(Number(visibleRange.realFrom))
  const visibleTo = Math.ceil(Number(visibleRange.realTo))
  const lastBucketIndex = candles.length - 1
  const visibleBucketIndexes = candles
    .map((candle, index) => ({ candle, index }))
    .filter(({ candle }) => {
      const bucketEndIndex = candle.startIndex + futureBars
      return bucketEndIndex >= visibleFrom - futureBars && candle.startIndex <= visibleTo + futureBars
    })
    .map(({ index }) => index)
  const firstVisibleBucketIndex = visibleBucketIndexes.length > 0 ? Math.min(...visibleBucketIndexes) : lastBucketIndex
  const lastVisibleBucketIndex = visibleBucketIndexes.length > 0 ? Math.max(...visibleBucketIndexes) : lastBucketIndex
  const firstBucket = Math.max(1, firstVisibleBucketIndex - 2, lastVisibleBucketIndex - maxMorganRangeBuckets + 1)
  const lastBucket = Math.min(lastBucketIndex, lastVisibleBucketIndex + 2)

  const createRange = (
    anchor: H4MorganCandle,
    previous: H4MorganCandle,
    atr7: number | undefined,
    widthBars = futureBars,
    startOffsetPx = startBoundaryOffsetPx,
  ) => {
    if (!previous || !anchor || !Number.isFinite(atr7)) return
    const widthPx = widthBars * barSpace
    if (!Number.isFinite(widthPx) || widthPx <= 0) return
    const center = (previous.high + previous.low + previous.close) / 3
    const radius = 3 * Number(atr7)
    if (!Number.isFinite(center) || !Number.isFinite(radius) || radius <= 0) return

    const startPoint = {
      dataIndex: anchor.startIndex,
      timestamp: anchor.startTimestamp,
      value: center,
    }
    const upperId = createStaticMorganRangeOverlay(chart, {
      futureWidthPx: widthPx,
      paneId: 'candle_pane',
      points: [startPoint, { ...startPoint, value: center + radius }],
      startOffsetPx,
    })
    const lowerId = createStaticMorganRangeOverlay(chart, {
      futureWidthPx: widthPx,
      paneId: 'candle_pane',
      points: [startPoint, { ...startPoint, value: center - radius }],
      startOffsetPx,
    })
    if (upperId) overlayIds.add(upperId)
    if (lowerId) overlayIds.add(lowerId)
  }

  for (let index = firstBucket; index <= lastBucket; index += 1) {
    const next = candles[index + 1]
    const widthBars = next
      ? Math.max(1, Math.min(futureBars, next.startIndex - candles[index].startIndex))
      : futureBars
    createRange(candles[index], candles[index - 1], atr[index - 1], widthBars)
  }

  createRange(candles[lastBucketIndex], candles[lastBucketIndex], atr[lastBucketIndex], futureBars, futureWidthPx + startBoundaryOffsetPx)
}
