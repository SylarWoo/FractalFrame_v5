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
  getChartStore?: () => {
    getIndicatorStore?: () => {
      getInstances?: (paneId: string) => Array<{
        figures?: Array<{ key?: unknown }>
        result?: Array<Record<string, unknown> | null | undefined>
        visible?: boolean
      }>
    }
  }
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

function extendFiniteRange(bounds: { max: number; min: number }, value: unknown) {
  if (!finiteNumber(value)) return
  bounds.min = Math.min(bounds.min, value)
  bounds.max = Math.max(bounds.max, value)
}

function readVisibleMainIndicatorRange(chart: Chart, from: number, to: number) {
  const indicators = (chart as ChartWithAxisAccess).getChartStore?.().getIndicatorStore?.().getInstances?.(candlePaneId) ?? []
  const bounds = { max: Number.NEGATIVE_INFINITY, min: Number.POSITIVE_INFINITY }
  for (const indicator of indicators) {
    if (indicator.visible === false) continue
    const result = indicator.result ?? []
    const figureKeys = (indicator.figures ?? [])
      .map((figure) => figure.key)
      .filter((key): key is string => typeof key === 'string' && key.length > 0)
    if (figureKeys.length === 0) continue
    const end = Math.min(to, result.length - 1)
    for (let index = from; index <= end; index += 1) {
      const row = result[index]
      if (!row) continue
      for (const key of figureKeys) {
        extendFiniteRange(bounds, row[key])
      }
    }
  }
  if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max)) return null
  return bounds
}

function visiblePriceRange(chart: Chart) {
  const dataList = chart.getDataList()
  if (dataList.length === 0) return null
  const range = chart.getVisibleRange()
  const from = Math.max(0, Math.floor(Number(range.realFrom)))
  const to = Math.min(dataList.length - 1, Math.ceil(Number(range.realTo)))
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null

  const bounds = { max: Number.NEGATIVE_INFINITY, min: Number.POSITIVE_INFINITY }
  for (let index = from; index <= to; index += 1) {
    extendFiniteRange(bounds, dataList[index]?.low)
    extendFiniteRange(bounds, dataList[index]?.high)
  }
  const indicatorRange = readVisibleMainIndicatorRange(chart, from, to)
  if (indicatorRange) {
    bounds.min = Math.min(bounds.min, indicatorRange.min)
    bounds.max = Math.max(bounds.max, indicatorRange.max)
  }
  if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max)) return null
  return { max: bounds.max, min: bounds.min, range: Math.max(bounds.max - bounds.min, 0.0000001) }
}

export function isAxisRangeUsableForVisiblePrices(chart: Chart, range: AxisRangeSnapshot | null | undefined): range is AxisRangeSnapshot {
  if (!range) return false
  const prices = visiblePriceRange(chart)
  if (!prices) return true
  const tolerance = Math.max(prices.range * 0.01, Math.abs(prices.max) * 0.0001, 0.0000001)
  const coversVisiblePrices = range.realFrom <= prices.min + tolerance && range.realTo >= prices.max - tolerance
  const saneScale = range.realRange <= prices.range * 100 && range.realRange >= prices.range / 100000
  return coversVisiblePrices && saneScale
}
