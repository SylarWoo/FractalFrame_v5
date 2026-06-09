import type { Chart } from 'klinecharts'
import type { ChartPageNavigation } from '../chartRuntimeTypes'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

type VisibleRangeLike = {
  realFrom?: number
  realTo?: number
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function readKLineChartVisibleRangeV2(chart: Chart): { realFrom: number; realTo: number } | null {
  const range = chart.getVisibleRange() as VisibleRangeLike
  const realFrom = finiteNumber(range.realFrom)
  const realTo = finiteNumber(range.realTo)
  if (realFrom == null || realTo == null || realTo <= realFrom) return null
  return { realFrom, realTo }
}

export function kLineChartIndexToXV2(index: number, realFrom: number, realTo: number, width: number) {
  return ((index - realFrom) / Math.max(1, realTo - realFrom)) * width
}

export function resolveRealtimeBoundaryIndex(frame: KLineChartRenderFrameV2, navigation?: ChartPageNavigation | null) {
  const realtime = frame.segments.realtime
  if (realtime && realtime.rows > 0) return Math.max(0, realtime.fromIndex)
  if (!navigation) return null
  const history = frame.segments.history
  if (!history || history.rows <= 0) return null
  return Math.max(0, history.toIndex)
}

export function resolveRealtimeBoundaryX(options: {
  frame: KLineChartRenderFrameV2
  mainRect: { width: number }
  navigation?: ChartPageNavigation | null
  visibleRange: { realFrom: number; realTo: number }
}) {
  const boundaryIndex = resolveRealtimeBoundaryIndex(options.frame, options.navigation)
  if (boundaryIndex == null) return null
  if (options.visibleRange.realTo < boundaryIndex || options.visibleRange.realFrom > boundaryIndex) return null
  return Math.max(0, Math.min(options.mainRect.width, kLineChartIndexToXV2(
    boundaryIndex,
    options.visibleRange.realFrom,
    options.visibleRange.realTo,
    options.mainRect.width,
  )))
}
