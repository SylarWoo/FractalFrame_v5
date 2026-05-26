import type { Chart } from 'klinecharts'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { createStaticMorganRangeOverlay } from './morganRangeOverlay'
import { calculateMorganRangeSegments, h4MorganSeconds, type MorganRangeSegment } from './morganRangeModel'

const maxMorganRangeBuckets = 36

export function clearMorganRangeOverlays(chart: Chart, overlayIds: Set<string>) {
  overlayIds.forEach((id) => chart.removeOverlay({ id }))
  overlayIds.clear()
}

export function applyMorganRangeOverlays(chart: Chart, period: string, overlayIds: Set<string>) {
  clearMorganRangeOverlays(chart, overlayIds)
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0 || periodSeconds > 2 * 60 * 60) return

  const futureBars = Math.round(h4MorganSeconds / periodSeconds)
  const segments = calculateMorganRangeSegments(chart.getDataList(), futureBars)
  if (segments.length === 0) return
  const barSpace = Number(chart.getBarSpace())
  const futureWidthPx = futureBars * barSpace
  const startBoundaryOffsetPx = -barSpace / 2
  if (!Number.isFinite(futureBars) || futureBars <= 0 || !Number.isFinite(futureWidthPx) || futureWidthPx <= 0) return
  const visibleRange = chart.getVisibleRange()
  const visibleFrom = Math.floor(Number(visibleRange.realFrom))
  const visibleTo = Math.ceil(Number(visibleRange.realTo))
  const lastSegmentIndex = segments.length - 1
  const visibleSegmentIndexes = segments
    .map((segment, index) => ({ index, segment }))
    .filter(({ segment }) => {
      return segment.endIndex >= visibleFrom - futureBars && segment.startIndex <= visibleTo + futureBars
    })
    .map(({ index }) => index)
  const firstVisibleSegmentIndex = visibleSegmentIndexes.length > 0 ? Math.min(...visibleSegmentIndexes) : lastSegmentIndex
  const lastVisibleSegmentIndex = visibleSegmentIndexes.length > 0 ? Math.max(...visibleSegmentIndexes) : lastSegmentIndex
  const firstSegment = Math.max(0, firstVisibleSegmentIndex - 2, lastVisibleSegmentIndex - maxMorganRangeBuckets + 1)
  const lastSegment = Math.min(lastSegmentIndex, lastVisibleSegmentIndex + 2)

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

  for (let index = firstSegment; index <= lastSegment; index += 1) {
    const segment = segments[index]
    if (!segment) continue
    const widthBars = Math.max(1, Math.min(futureBars, segment.endIndex - segment.startIndex + 1))
    createRange(segment, widthBars)
  }
}
