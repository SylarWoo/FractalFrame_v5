import type { Chart } from 'klinecharts'

const candlePaneId = 'candle_pane'

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

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function normalizeAxisRange(range: Partial<AxisRangeSnapshot> | null | undefined): AxisRangeSnapshot | null {
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

export function isAxisRangeUsableForVisiblePrices(chart: Chart, range: AxisRangeSnapshot | null | undefined): range is AxisRangeSnapshot {
  if (!range) return false
  const prices = visiblePriceRange(chart)
  if (!prices) return true
  const tolerance = Math.max(prices.range * 20, Math.abs(prices.max) * 0.0001, 0.0000001)
  const overlapsVisiblePrices = range.realTo >= prices.min - tolerance && range.realFrom <= prices.max + tolerance
  const saneScale = range.realRange <= prices.range * 500 && range.realRange >= prices.range / 100000
  return overlapsVisiblePrices && saneScale
}
