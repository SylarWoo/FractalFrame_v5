import type { Chart } from 'klinecharts'

const candlePaneId = 'candle_pane'
const storagePrefix = 'fractalframe:klinechart-v2:yAxisRestore'

export type KLineChartYAxisRestoreModeV2 = 'auto' | 'manual'

export type KLineChartYAxisRangeV2 = {
  from: number
  range: number
  realFrom: number
  realRange: number
  realTo: number
  to: number
}

export type KLineChartYAxisSnapshotV2 = {
  mode: KLineChartYAxisRestoreModeV2
  range: KLineChartYAxisRangeV2 | null
  savedAt: string
}

type ChartWithYAxisAccess = Chart & {
  adjustPaneViewport?: (
    shouldMeasureHeight?: boolean,
    shouldMeasureWidth?: boolean,
    shouldUpdate?: boolean,
    shouldAdjustYAxis?: boolean,
    shouldForceAdjustYAxis?: boolean,
  ) => void
  getChartStore?: () => {
    getIndicatorStore?: () => {
      getInstances?: (paneId: string) => Array<{
        figures?: Array<{ key?: unknown }>
        result?: Array<Record<string, unknown> | null | undefined>
        visible?: boolean
      }>
    }
  }
  getDrawPaneById?: (paneId: string) => {
    getAxisComponent?: () => {
      getAutoCalcTickFlag?: () => boolean
      getRange?: () => Partial<KLineChartYAxisRangeV2> | null
      setAutoCalcTickFlag?: (flag: boolean) => void
      setRange?: (range: KLineChartYAxisRangeV2) => void
    }
  } | null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function storageKey(symbol: string, period: string) {
  return `${storagePrefix}:${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}`
}

function normalizeAxisRange(value: unknown): KLineChartYAxisRangeV2 | null {
  if (!value || typeof value !== 'object') return null
  const range = value as Partial<KLineChartYAxisRangeV2>
  if (
    !finiteNumber(range.from) ||
    !finiteNumber(range.to) ||
    !finiteNumber(range.range) ||
    !finiteNumber(range.realFrom) ||
    !finiteNumber(range.realTo) ||
    !finiteNumber(range.realRange) ||
    range.range <= 0 ||
    range.realRange <= 0
  ) {
    return null
  }
  return {
    from: range.from,
    range: range.range,
    realFrom: range.realFrom,
    realRange: range.realRange,
    realTo: range.realTo,
    to: range.to,
  }
}

function readYAxis(chart: Chart) {
  return (chart as ChartWithYAxisAccess).getDrawPaneById?.(candlePaneId)?.getAxisComponent?.() ?? null
}

function extendFiniteRange(bounds: { max: number; min: number }, value: unknown) {
  if (!finiteNumber(value)) return
  bounds.min = Math.min(bounds.min, value)
  bounds.max = Math.max(bounds.max, value)
}

function readVisibleMainIndicatorRange(chart: Chart, from: number, to: number) {
  const indicators = (chart as ChartWithYAxisAccess).getChartStore?.().getIndicatorStore?.().getInstances?.(candlePaneId) ?? []
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
      for (const key of figureKeys) extendFiniteRange(bounds, row[key])
    }
  }
  if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max)) return null
  return bounds
}

function readVisiblePriceRange(chart: Chart) {
  const dataList = chart.getDataList?.() ?? []
  if (dataList.length === 0) return null
  const range = chart.getVisibleRange?.()
  const from = Math.max(0, Math.floor(Number(range?.realFrom)))
  const to = Math.min(dataList.length - 1, Math.ceil(Number(range?.realTo)))
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

export function isKLineChartYAxisRangeUsableV2(chart: Chart, range: KLineChartYAxisRangeV2 | null | undefined): range is KLineChartYAxisRangeV2 {
  if (!range) return false
  const prices = readVisiblePriceRange(chart)
  if (!prices) return true
  const tolerance = Math.max(prices.range * 0.01, Math.abs(prices.max) * 0.0001, 0.0000001)
  const coversVisiblePrices = range.realFrom <= prices.min + tolerance && range.realTo >= prices.max - tolerance
  const saneScale = range.realRange <= prices.range * 100 && range.realRange >= prices.range / 100000
  return coversVisiblePrices && saneScale
}

export function readKLineChartYAxisSnapshotV2(symbol: string, period: string): KLineChartYAxisSnapshotV2 | null {
  try {
    const raw = window.localStorage.getItem(storageKey(symbol, period))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<KLineChartYAxisSnapshotV2>
    const mode = parsed.mode === 'manual' ? 'manual' : 'auto'
    return {
      mode,
      range: mode === 'manual' ? normalizeAxisRange(parsed.range) : null,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    }
  } catch {
    return null
  }
}

export function writeKLineChartYAxisSnapshotV2(symbol: string, period: string, snapshot: KLineChartYAxisSnapshotV2) {
  try {
    window.localStorage.setItem(storageKey(symbol, period), JSON.stringify(snapshot))
  } catch {
    // Render state persistence is optional.
  }
}

export function captureKLineChartYAxisStateV2(chart: Chart): KLineChartYAxisSnapshotV2 | null {
  const yAxis = readYAxis(chart)
  if (!yAxis) return null
  const auto = yAxis.getAutoCalcTickFlag?.() !== false
  return {
    mode: auto ? 'auto' : 'manual',
    range: auto ? null : normalizeAxisRange(yAxis.getRange?.()),
    savedAt: new Date().toISOString(),
  }
}

export function resetKLineChartYAxisToAutoV2(chart: Chart) {
  readYAxis(chart)?.setAutoCalcTickFlag?.(true)
  ;(chart as ChartWithYAxisAccess).adjustPaneViewport?.(false, true, true, true, true)
}

export function restoreKLineChartYAxisAfterDataReadyV2(chart: Chart, symbol: string, period: string) {
  const snapshot = readKLineChartYAxisSnapshotV2(symbol, period)
  if (snapshot?.mode === 'manual' && isKLineChartYAxisRangeUsableV2(chart, snapshot.range)) {
    const yAxis = readYAxis(chart)
    if (yAxis?.setRange && snapshot.range) {
      yAxis.setAutoCalcTickFlag?.(false)
      yAxis.setRange(snapshot.range)
      ;(chart as ChartWithYAxisAccess).adjustPaneViewport?.(false, true, true, true)
      return true
    }
  }
  resetKLineChartYAxisToAutoV2(chart)
  return false
}

export function installKLineChartYAxisRestorePersistenceV2(
  chart: Chart,
  getContext: () => { period: string; symbol: string },
) {
  const saveNow = () => {
    const context = getContext()
    if (!context.symbol || !context.period) return
    const snapshot = captureKLineChartYAxisStateV2(chart)
    if (!snapshot) return
    writeKLineChartYAxisSnapshotV2(context.symbol, context.period, snapshot)
  }

  return {
    destroy() {},
    saveNow,
  }
}
