import type { Chart } from 'klinecharts'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

export type KLineChartPageJumpMovementV2 = 'history-head' | 'history-tail' | 'realtime-latest'

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readVisibleCount(chart: Chart, fallbackRows: number) {
  const visibleRange = chart.getVisibleRange?.()
  const visibleFrom = finiteNumber(visibleRange?.from) ?? finiteNumber(visibleRange?.realFrom)
  const visibleTo = finiteNumber(visibleRange?.to) ?? finiteNumber(visibleRange?.realTo)
  if (visibleFrom != null && visibleTo != null && visibleTo > visibleFrom) {
    return Math.max(1, Math.floor(visibleTo - visibleFrom))
  }
  return Math.max(1, Math.min(160, fallbackRows))
}

export function resolveKLineChartPageJumpMovementV2(
  previous: KLineChartRenderFrameV2 | null,
  current: KLineChartRenderFrameV2,
): KLineChartPageJumpMovementV2 | null {
  if (!previous) return null
  if (previous.symbol !== current.symbol || previous.period !== current.period) {
    return current.segments.realtime ? 'realtime-latest' : null
  }
  const delta = current.pageIndex - previous.pageIndex
  if (delta === 0) return null
  if (delta === 1) return 'history-tail'
  if (delta === -1) return 'history-head'
  if (current.segments.realtime) return 'realtime-latest'
  return null
}

export function applyKLineChartPageJumpMovementV2(
  chart: Chart,
  frame: KLineChartRenderFrameV2,
  movement: KLineChartPageJumpMovementV2 | null,
) {
  if (!movement || frame.mainRows.length === 0) return false
  const history = frame.segments.history
  if (movement === 'realtime-latest') {
    chart.scrollToDataIndex?.(frame.mainRows.length - 1, 0)
    return true
  }
  if (history.rows <= 0) return false
  if (movement === 'history-tail') {
    chart.scrollToDataIndex?.(Math.max(0, history.toIndex), 0)
    return true
  }
  const visibleCount = readVisibleCount(chart, frame.mainRows.length)
  const rightEdgeIndex = Math.min(frame.mainRows.length - 1, Math.max(0, history.fromIndex + visibleCount))
  chart.scrollToDataIndex?.(rightEdgeIndex, 0)
  return true
}
