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

export function isKLineChartYAxisRangeUsableV2(range: KLineChartYAxisRangeV2 | null | undefined): range is KLineChartYAxisRangeV2 {
  return normalizeAxisRange(range) != null
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
  if (snapshot?.mode === 'manual' && isKLineChartYAxisRangeUsableV2(snapshot.range)) {
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
  let timer = 0

  const clearPendingSave = () => {
    if (timer !== 0) {
      window.clearTimeout(timer)
      timer = 0
    }
  }

  const saveNow = () => {
    clearPendingSave()
    const context = getContext()
    if (!context.symbol || !context.period) return
    const snapshot = captureKLineChartYAxisStateV2(chart)
    if (!snapshot) return
    writeKLineChartYAxisSnapshotV2(context.symbol, context.period, snapshot)
  }

  const scheduleSave = () => {
    clearPendingSave()
    timer = window.setTimeout(saveNow, 0)
  }

  const root = chart.getDom()
  root?.addEventListener('mouseup', scheduleSave, true)
  root?.addEventListener('pointerup', scheduleSave, true)
  window.addEventListener('mouseup', scheduleSave, true)
  window.addEventListener('pointerup', scheduleSave, true)
  window.addEventListener('beforeunload', saveNow)
  window.addEventListener('pagehide', saveNow)

  return {
    destroy() {
      clearPendingSave()
      root?.removeEventListener('mouseup', scheduleSave, true)
      root?.removeEventListener('pointerup', scheduleSave, true)
      window.removeEventListener('mouseup', scheduleSave, true)
      window.removeEventListener('pointerup', scheduleSave, true)
      window.removeEventListener('beforeunload', saveNow)
      window.removeEventListener('pagehide', saveNow)
    },
    saveNow,
  }
}
