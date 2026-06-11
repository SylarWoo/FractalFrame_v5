import type { Chart } from 'klinecharts'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { createStaticMorganRangeOverlay } from './morganRangeOverlay'
import {
  calculateMorganRangeSegmentsForModeCached,
  resolveMorganRangeBucketSeconds,
  type MorganRangeMode,
  type MorganRangeSegment,
} from './morganRangeModel'

const maxMorganRangeBuckets = 160
const morganRangeOverlaySignatures = new WeakMap<Set<string>, string>()

export function clearMorganRangeOverlays(chart: Chart, overlayIds: Set<string>) {
  overlayIds.forEach((id) => chart.removeOverlay({ id }))
  overlayIds.clear()
  morganRangeOverlaySignatures.delete(overlayIds)
}

function isMorganRangeModeVisible(mode: MorganRangeMode, period: string) {
  if (mode === 'D5_H2') return period === 'H2'
  return mode === 'D1_M30' ? period === 'M30' : period === 'M5'
}

export function applyMorganRangeOverlays(chart: Chart, period: string, overlayIds: Set<string>, mode: MorganRangeMode = 'H4_M5') {
  if (!isMorganRangeModeVisible(mode, period)) {
    clearMorganRangeOverlays(chart, overlayIds)
    return
  }
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0 || periodSeconds > 2 * 60 * 60) {
    clearMorganRangeOverlays(chart, overlayIds)
    return
  }

  const futureBars = Math.round(resolveMorganRangeBucketSeconds(mode) / periodSeconds)
  const segments = calculateMorganRangeSegmentsForModeCached(chart.getDataList(), mode, futureBars)
  applyMorganRangeOverlaySegments(chart, period, overlayIds, mode, segments)
}

export function applyMorganRangeOverlaySegments(
  chart: Chart,
  period: string,
  overlayIds: Set<string>,
  mode: MorganRangeMode,
  segments: MorganRangeSegment[],
  forceRebuild = false,
) {
  if (!isMorganRangeModeVisible(mode, period)) {
    clearMorganRangeOverlays(chart, overlayIds)
    return
  }
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0 || periodSeconds > 2 * 60 * 60) {
    clearMorganRangeOverlays(chart, overlayIds)
    return
  }

  const futureBars = Math.round(resolveMorganRangeBucketSeconds(mode) / periodSeconds)
  if (segments.length === 0) {
    clearMorganRangeOverlays(chart, overlayIds)
    return
  }
  const barSpace = Number(chart.getBarSpace())
  const futureWidthPx = futureBars * barSpace
  const startBoundaryOffsetPx = -barSpace / 2
  if (!Number.isFinite(futureBars) || futureBars <= 0 || !Number.isFinite(futureWidthPx) || futureWidthPx <= 0) {
    clearMorganRangeOverlays(chart, overlayIds)
    return
  }
  const firstSegment = Math.max(0, segments.length - maxMorganRangeBuckets)
  const lastSegment = segments.length - 1
  const visibleSegments = segments.slice(firstSegment)
  const signature = [
    mode,
    period,
    barSpace.toFixed(4),
    futureBars,
    firstSegment,
    lastSegment,
    visibleSegments.map((segment) => [
      segment.startIndex,
      segment.endIndex,
      segment.startTimestamp,
      segment.center.toFixed(6),
      segment.upper.toFixed(6),
      segment.lower.toFixed(6),
    ].join(':')).join(';'),
  ].join('|')

  if (!forceRebuild && morganRangeOverlaySignatures.get(overlayIds) === signature) return

  clearMorganRangeOverlays(chart, overlayIds)
  morganRangeOverlaySignatures.set(overlayIds, signature)

  const createRange = (
    segment: MorganRangeSegment,
    widthBars = futureBars,
    startOffsetPx = startBoundaryOffsetPx,
  ) => {
    const widthPx = widthBars * barSpace
    if (!Number.isFinite(widthPx) || widthPx <= 0) return

    const startPoint = {
      dataIndex: segment.startIndex,
      timestamp: segment.startTimestamp,
      value: segment.center,
    }
    const upperPoint = { ...startPoint, value: segment.upper }
    const lowerPoint = { ...startPoint, value: segment.lower }
    const upperRangeId = createStaticMorganRangeOverlay(chart, {
      futureWidthPx: widthPx,
      paneId: 'candle_pane',
      points: [startPoint, upperPoint],
      startOffsetPx,
    })
    const lowerRangeId = createStaticMorganRangeOverlay(chart, {
      futureWidthPx: widthPx,
      paneId: 'candle_pane',
      points: [startPoint, lowerPoint],
      startOffsetPx,
    })
    if (upperRangeId) overlayIds.add(upperRangeId)
    if (lowerRangeId) overlayIds.add(lowerRangeId)
  }

  visibleSegments.forEach((segment) => {
    if (!segment) return
    const widthBars = Math.max(1, Math.min(futureBars, segment.endIndex - segment.startIndex + 1))
    createRange(segment, widthBars)
  })
}
