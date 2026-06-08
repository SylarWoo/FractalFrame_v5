import type { Chart } from 'klinecharts'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

export type KLineChartRenderResult = {
  key: string
  pageIndex: number
  period: string
  rows: number
  source: 'kline-chart-renderer-v2'
  symbol: string
}

type ApplyKLineChartFrameOptions = {
  anchorRealtimeBoundary?: boolean
  preserveVisibleRange?: boolean
  restoreViewport?: () => boolean
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function anchorViewportAtRealtimeBoundary(chart: Chart, frame: KLineChartRenderFrameV2) {
  const realtime = frame.segments.realtime
  if (!realtime || realtime.fromIndex <= 0 || frame.mainRows.length === 0) return
  const visibleRange = chart.getVisibleRange?.()
  const visibleFrom = finiteNumber(visibleRange?.from) ?? finiteNumber(visibleRange?.realFrom)
  const visibleTo = finiteNumber(visibleRange?.to) ?? finiteNumber(visibleRange?.realTo)
  const visibleCount = visibleFrom != null && visibleTo != null && visibleTo > visibleFrom
    ? Math.max(1, Math.floor(visibleTo - visibleFrom))
    : Math.min(160, frame.mainRows.length)
  const boundaryIndex = Math.max(0, realtime.fromIndex - 1)
  const rightEdgeIndex = Math.min(frame.mainRows.length - 1, boundaryIndex + Math.floor(visibleCount / 2))
  chart.scrollToDataIndex?.(rightEdgeIndex, 0)
}

function readVisibleRangeTo(chart: Chart) {
  const visibleRange = chart.getVisibleRange?.()
  return finiteNumber(visibleRange?.to) ?? finiteNumber(visibleRange?.realTo)
}

function readOffsetRightDistance(chart: Chart) {
  return finiteNumber(chart.getOffsetRightDistance?.())
}

function preserveVisibleRange(chart: Chart, visibleTo: number | null, offsetRightDistance: number | null) {
  if (offsetRightDistance != null && offsetRightDistance >= 0) {
    chart.setOffsetRightDistance?.(offsetRightDistance)
    return
  }
  if (visibleTo == null) return
  chart.scrollToDataIndex?.(Math.max(0, Math.round(visibleTo)), 0)
}

function applyNewDataWithReadyCallback(chart: Chart, frame: KLineChartRenderFrameV2, afterDataReady?: () => void) {
  if (afterDataReady) {
    chart.applyNewData(frame.mainRows, false, afterDataReady)
    return
  }
  chart.applyNewData(frame.mainRows, false)
}

export function applyKLineChartFrameToChart(
  chart: Chart,
  frame: KLineChartRenderFrameV2,
  onDataReady?: () => void,
  options: ApplyKLineChartFrameOptions = {},
): KLineChartRenderResult {
  const preservedVisibleTo = options.preserveVisibleRange ? readVisibleRangeTo(chart) : null
  const preservedOffsetRightDistance = options.preserveVisibleRange ? readOffsetRightDistance(chart) : null
  const afterDataReady = () => {
    onDataReady?.()
    const restoredViewport = options.restoreViewport?.() === true
    if (options.preserveVisibleRange) preserveVisibleRange(chart, preservedVisibleTo, preservedOffsetRightDistance)
    if (!restoredViewport && options.anchorRealtimeBoundary) anchorViewportAtRealtimeBoundary(chart, frame)
  }
  const shouldRunAfterDataReady = Boolean(
    onDataReady || options.restoreViewport || options.preserveVisibleRange || options.anchorRealtimeBoundary,
  )
  applyNewDataWithReadyCallback(chart, frame, shouldRunAfterDataReady ? afterDataReady : undefined)
  return {
    key: frame.key,
    pageIndex: frame.pageIndex,
    period: frame.period,
    rows: frame.mainRows.length,
    source: 'kline-chart-renderer-v2',
    symbol: frame.symbol,
  }
}

export function applyKLineChartFrameTailUpdate(
  chart: Chart,
  frame: KLineChartRenderFrameV2,
): KLineChartRenderResult {
  const latest = frame.mainRows[frame.mainRows.length - 1]
  if (latest) {
    chart.updateData?.(latest)
  }
  return {
    key: frame.key,
    pageIndex: frame.pageIndex,
    period: frame.period,
    rows: frame.mainRows.length,
    source: 'kline-chart-renderer-v2',
    symbol: frame.symbol,
  }
}
