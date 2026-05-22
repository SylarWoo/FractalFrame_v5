import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import {
  readGlobalChartViewportSnapshot,
  writeGlobalChartViewportSnapshot,
  type ChartViewportSnapshot,
} from './chartViewportGlobalStore'

const candlePaneId = 'candle_pane'
const saveDelayMs = 180

export type AxisRangeSnapshot = {
  from: number
  range: number
  realFrom: number
  realRange: number
  realTo: number
  to: number
}

type ChartWithAxisAccess = Chart & {
  adjustPaneViewport?: (shouldMeasureHeight?: boolean, shouldMeasureWidth?: boolean, shouldUpdate?: boolean, shouldAdjustYAxis?: boolean, shouldForceAdjustYAxis?: boolean) => void
  getDrawPaneById?: (paneId: string) => {
    getAxisComponent?: () => {
      getRange?: () => Partial<AxisRangeSnapshot> | null
      setRange?: (range: AxisRangeSnapshot) => void
    }
  } | null
}

const readyKeys = new WeakMap<Chart, string>()

function viewportReadyKey(symbol: string, period: string) {
  return `${symbol}:${period.toUpperCase()}`
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeAxisRange(range: Partial<AxisRangeSnapshot> | null | undefined): AxisRangeSnapshot | null {
  if (!range) return null
  if (!finiteNumber(range.from) || !finiteNumber(range.to) || !finiteNumber(range.range)) return null
  if (!finiteNumber(range.realFrom) || !finiteNumber(range.realTo) || !finiteNumber(range.realRange)) return null
  const from = range.from
  const to = range.to
  const axisRange = range.range
  const realFrom = range.realFrom
  const realTo = range.realTo
  const realRange = range.realRange
  if (axisRange <= 0 || realRange <= 0) return null
  return {
    from,
    range: axisRange,
    realFrom,
    realRange,
    realTo,
    to,
  }
}

export function readChartYAxisRange(chart: Chart) {
  const yAxis = (chart as ChartWithAxisAccess).getDrawPaneById?.(candlePaneId)?.getAxisComponent?.()
  const range = normalizeAxisRange(yAxis?.getRange?.())
  return axisRangeMatchesChartData(chart, range) ? range : null
}

export function restoreChartYAxisRange(chart: Chart, range: AxisRangeSnapshot | null | undefined) {
  if (!range || !axisRangeMatchesChartData(chart, range)) return false
  const yAxis = (chart as ChartWithAxisAccess).getDrawPaneById?.(candlePaneId)?.getAxisComponent?.()
  if (!yAxis?.setRange) return false
  yAxis.setRange(range)
  ;(chart as ChartWithAxisAccess).adjustPaneViewport?.(false, true, true, true)
  return true
}

function visiblePriceRange(chart: Chart) {
  const dataList = chart.getDataList()
  if (dataList.length === 0) return null
  const range = chart.getVisibleRange()
  const from = Math.max(0, Math.floor(Number(range.realFrom)))
  const to = Math.min(dataList.length - 1, Math.ceil(Number(range.realTo)))
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let index = from; index <= to; index += 1) {
    const low = Number(dataList[index]?.low)
    const high = Number(dataList[index]?.high)
    if (Number.isFinite(low)) min = Math.min(min, low)
    if (Number.isFinite(high)) max = Math.max(max, high)
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { max, min, range: Math.max(max - min, 1) }
}

function axisRangeMatchesChartData(chart: Chart, range: AxisRangeSnapshot | null | undefined) {
  if (!range) return false
  const prices = visiblePriceRange(chart)
  if (!prices) return true
  const tolerance = prices.range * 6
  return range.realTo >= prices.min - tolerance && range.realFrom <= prices.max + tolerance
}

function resolveRightVisibleDataIndex(chart: Chart) {
  const dataList = chart.getDataList()
  if (dataList.length === 0) return -1
  const range = chart.getVisibleRange()
  const candidates = [Number(range.realTo), Number(range.to)]
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) continue
    return Math.max(0, Math.min(dataList.length - 1, Math.floor(candidate)))
  }
  return dataList.length - 1
}

function readRightVisibleTimestamp(chart: Chart) {
  const index = resolveRightVisibleDataIndex(chart)
  if (index < 0) return null
  const timestamp = Number(chart.getDataList()[index]?.timestamp)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function markChartViewportPersistenceReady(chart: Chart, symbol: string, period: string) {
  readyKeys.set(chart, viewportReadyKey(symbol, period))
}

export function restoreChartViewportState(chart: Chart, symbol: string, period: string) {
  void symbol
  const snapshot = readGlobalChartViewportSnapshot(period)
  if (!snapshot) return false

  chart.setBarSpace(snapshot.barSpace)
  const restoreScroll = () => {
    const dataLength = chart.getDataList().length
    if (dataLength === 0) return
    if (snapshot.offsetRightDistance !== null) {
      chart.setOffsetRightDistance(Math.max(0, snapshot.offsetRightDistance))
      return
    }
    if (snapshot.rightTimestamp !== null) {
      chart.scrollToTimestamp(snapshot.rightTimestamp, 0)
      return
    }
    chart.scrollToDataIndex(Math.max(0, Math.min(dataLength - 1, Math.round(snapshot.visibleTo))), 0)
  }

  restoreScroll()
  if (snapshot.yAxisRange) {
    restoreChartYAxisRange(chart, snapshot.yAxisRange)
  }
  window.requestAnimationFrame(() => {
    restoreScroll()
    if (snapshot.yAxisRange) {
      restoreChartYAxisRange(chart, snapshot.yAxisRange)
    }
  })
  return true
}

function saveChartViewportState(chart: Chart, symbol: string, period: string) {
  if (readyKeys.get(chart) !== viewportReadyKey(symbol, period)) return
  const visibleRange = chart.getVisibleRange()
  const visibleTo = Number(visibleRange.to)
  const barSpace = chart.getBarSpace()
  if (!Number.isFinite(visibleTo) || !Number.isFinite(barSpace)) return

  writeGlobalChartViewportSnapshot(period, {
    barSpace,
    dataLength: chart.getDataList().length,
    offsetRightDistance: chart.getOffsetRightDistance(),
    rightTimestamp: readRightVisibleTimestamp(chart),
    savedAt: new Date().toISOString(),
    visibleTo,
    yAxisRange: readChartYAxisRange(chart),
  } satisfies ChartViewportSnapshot)
}

export function installChartViewportPersistence(chart: Chart, getContext: () => { period: string; symbol: string }) {
  let timer = 0

  const saveNow = () => {
    if (timer !== 0) {
      window.clearTimeout(timer)
      timer = 0
    }
    const context = getContext()
    if (!context.symbol || !context.period) return
    saveChartViewportState(chart, context.symbol, context.period)
  }

  const scheduleSave = () => {
    if (timer !== 0) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = 0
      saveNow()
    }, saveDelayMs)
  }

  const actions = [
    ActionType.OnScroll,
    ActionType.OnVisibleRangeChange,
    ActionType.OnZoom,
  ]
  actions.forEach((action) => chart.subscribeAction(action, scheduleSave))

  const yAxisDom = chart.getDom(candlePaneId, DomPosition.YAxis)
  const handleYAxisMouseDown = () => {
    window.addEventListener('mouseup', scheduleSave, { capture: true, once: true })
  }
  const rootDom = chart.getDom(candlePaneId, DomPosition.Root)
  yAxisDom?.addEventListener('mouseup', scheduleSave, true)
  yAxisDom?.addEventListener('mousedown', handleYAxisMouseDown, true)
  yAxisDom?.addEventListener('wheel', scheduleSave, true)
  rootDom?.addEventListener('mouseup', scheduleSave, true)
  rootDom?.addEventListener('pointerup', saveNow, true)
  window.addEventListener('beforeunload', saveNow)
  window.addEventListener('pagehide', saveNow)

  return () => {
    if (timer !== 0) window.clearTimeout(timer)
    actions.forEach((action) => chart.unsubscribeAction(action, scheduleSave))
    yAxisDom?.removeEventListener('mouseup', scheduleSave, true)
    yAxisDom?.removeEventListener('mousedown', handleYAxisMouseDown, true)
    yAxisDom?.removeEventListener('wheel', scheduleSave, true)
    rootDom?.removeEventListener('mouseup', scheduleSave, true)
    rootDom?.removeEventListener('pointerup', saveNow, true)
    window.removeEventListener('beforeunload', saveNow)
    window.removeEventListener('pagehide', saveNow)
    window.removeEventListener('mouseup', scheduleSave, true)
  }
}
