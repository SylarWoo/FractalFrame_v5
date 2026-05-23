import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import {
  readGlobalChartViewportSnapshot,
  readLatestChartViewportSnapshot,
  writeGlobalChartViewportSnapshot,
  type ChartViewportSnapshot,
} from './chartViewportGlobalStore'

export type { ChartViewportSnapshot } from './chartViewportGlobalStore'

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
  return normalizeAxisRange(yAxis?.getRange?.())
}

export function restoreChartYAxisRange(chart: Chart, range: AxisRangeSnapshot | null | undefined) {
  if (!isAxisRangeUsableForVisiblePrices(chart, range)) return false
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
  return { max, min, range: Math.max(max - min, 0.0000001) }
}

function isAxisRangeUsableForVisiblePrices(chart: Chart, range: AxisRangeSnapshot | null | undefined): range is AxisRangeSnapshot {
  if (!range) return false
  const prices = visiblePriceRange(chart)
  if (!prices) return true
  const tolerance = Math.max(prices.range * 20, Math.abs(prices.max) * 0.0001, 0.0000001)
  const overlapsVisiblePrices = range.realTo >= prices.min - tolerance && range.realFrom <= prices.max + tolerance
  const saneScale = range.realRange <= prices.range * 500 && range.realRange >= prices.range / 100000
  return overlapsVisiblePrices && saneScale
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

export function captureChartViewportSnapshot(chart: Chart, forceYAxisRange = false): ChartViewportSnapshot | null {
  const visibleRange = chart.getVisibleRange()
  const visibleTo = Number(visibleRange.to)
  const barSpace = chart.getBarSpace()
  if (!Number.isFinite(visibleTo) || !Number.isFinite(barSpace)) return null
  return {
    barSpace,
    dataLength: chart.getDataList().length,
    offsetRightDistance: chart.getOffsetRightDistance(),
    rightTimestamp: readRightVisibleTimestamp(chart),
    savedAt: new Date().toISOString(),
    visibleTo,
    yAxisRange: (() => {
      const range = readChartYAxisRange(chart)
      if (forceYAxisRange) return range
      return isAxisRangeUsableForVisiblePrices(chart, range) ? range : null
    })(),
  }
}

export function restoreChartViewportSnapshot(chart: Chart, snapshot: ChartViewportSnapshot | null | undefined) {
  if (!snapshot) return false
  chart.setBarSpace(snapshot.barSpace)
  const restoreScroll = () => {
    const dataLength = chart.getDataList().length
    if (dataLength === 0) return
    if (snapshot.offsetRightDistance !== null) {
      chart.setOffsetRightDistance(snapshot.offsetRightDistance)
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
  window.setTimeout(() => {
    restoreScroll()
    if (snapshot.yAxisRange) {
      restoreChartYAxisRange(chart, snapshot.yAxisRange)
    }
  }, 0)
  return true
}

export function restoreChartViewportState(chart: Chart, symbol: string, period: string) {
  const snapshot = readLatestChartViewportSnapshot() ?? readGlobalChartViewportSnapshot(period)
  if (snapshot?.symbol && snapshot.symbol !== symbol) {
    return restoreChartViewportSnapshot(chart, { ...snapshot, yAxisRange: null })
  }
  return restoreChartViewportSnapshot(chart, snapshot)
}

function saveChartViewportState(chart: Chart, symbol: string, period: string, forceYAxisRange = false) {
  if (readyKeys.get(chart) !== viewportReadyKey(symbol, period)) return
  const snapshot = captureChartViewportSnapshot(chart, forceYAxisRange)
  if (!snapshot) return
  snapshot.symbol = symbol
  snapshot.period = period.toUpperCase()
  if (!snapshot.yAxisRange) {
    const previous = readGlobalChartViewportSnapshot(period) ?? readLatestChartViewportSnapshot()
    snapshot.yAxisRange = previous?.yAxisRange ?? null
  }
  writeGlobalChartViewportSnapshot(period, snapshot)
}

export function installChartViewportPersistence(chart: Chart, getContext: () => { period: string; symbol: string }) {
  let timer = 0

  const saveNow = (forceYAxisRange = false) => {
    if (timer !== 0) {
      window.clearTimeout(timer)
      timer = 0
    }
    const context = getContext()
    if (!context.symbol || !context.period) return
    saveChartViewportState(chart, context.symbol, context.period, forceYAxisRange)
  }

  const scheduleSave = (forceYAxisRange = false) => {
    if (timer !== 0) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = 0
      saveNow(forceYAxisRange)
    }, saveDelayMs)
  }
  const saveNormalNow = () => saveNow()
  const scheduleNormalSave = () => scheduleSave()

  const actions = [
    ActionType.OnScroll,
    ActionType.OnVisibleRangeChange,
    ActionType.OnZoom,
  ]
  actions.forEach((action) => chart.subscribeAction(action, scheduleNormalSave))

  const yAxisDom = chart.getDom(candlePaneId, DomPosition.YAxis)
  const scheduleYAxisSave = () => scheduleSave(true)
  const handleYAxisMouseDown = () => {
    window.addEventListener('mouseup', scheduleYAxisSave, { capture: true, once: true })
    window.addEventListener('pointerup', scheduleYAxisSave, { capture: true, once: true })
  }
  const rootDom = chart.getDom(candlePaneId, DomPosition.Root)
  yAxisDom?.addEventListener('mouseup', scheduleYAxisSave, true)
  yAxisDom?.addEventListener('mousedown', handleYAxisMouseDown, true)
  yAxisDom?.addEventListener('wheel', scheduleYAxisSave, true)
  rootDom?.addEventListener('mouseup', scheduleNormalSave, true)
  rootDom?.addEventListener('pointerup', saveNormalNow, true)
  window.addEventListener('mouseup', scheduleNormalSave, true)
  window.addEventListener('pointerup', scheduleNormalSave, true)
  window.addEventListener('wheel', scheduleNormalSave, true)
  window.addEventListener('beforeunload', saveNormalNow)
  window.addEventListener('pagehide', saveNormalNow)

  return () => {
    if (timer !== 0) window.clearTimeout(timer)
    actions.forEach((action) => chart.unsubscribeAction(action, scheduleNormalSave))
  yAxisDom?.removeEventListener('mouseup', scheduleYAxisSave, true)
  yAxisDom?.removeEventListener('mousedown', handleYAxisMouseDown, true)
  yAxisDom?.removeEventListener('wheel', scheduleYAxisSave, true)
    rootDom?.removeEventListener('mouseup', scheduleNormalSave, true)
    rootDom?.removeEventListener('pointerup', saveNormalNow, true)
    window.removeEventListener('mouseup', scheduleNormalSave, true)
    window.removeEventListener('pointerup', scheduleNormalSave, true)
    window.removeEventListener('wheel', scheduleNormalSave, true)
    window.removeEventListener('beforeunload', saveNormalNow)
    window.removeEventListener('pagehide', saveNormalNow)
  }
}
