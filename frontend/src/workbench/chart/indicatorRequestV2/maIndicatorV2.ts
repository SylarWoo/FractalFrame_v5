import type { KLineData } from 'klinecharts'
import { defaultMaIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { MaIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { MaShiftRow } from '../tradingViewMaShiftIndicator'
import { calculateTradingViewMaShiftRows } from '../tradingViewMaShiftIndicator'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export const storeV6MaIndicatorIdV2 = 'MA'
export const storeV6MaPaneIdV2 = 'main-ma-overlay'

export type StoreV6MaIndicatorRowV2 = MaShiftRow & {
  barKey: string
  globalIndex: number | null
  time: number
  timestamp: number
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(next, 5000)) : fallback
}

function normalizeRequestSettings(request: StoreV6IndicatorRequestSpecV2): MaIndicatorSettings {
  const input = request.params as Partial<MaIndicatorSettings> | undefined
  const merged = { ...defaultMaIndicatorSettings, ...(input ?? {}) }
  return {
    ...merged,
    length: clampPeriod(merged.length, defaultMaIndicatorSettings.length),
    shiftLength: clampPeriod(merged.shiftLength, defaultMaIndicatorSettings.shiftLength),
  }
}

function toKLineData(row: StoreV6WindowKLine): KLineData {
  return {
    close: finiteNumber(row.close),
    high: finiteNumber(row.high),
    low: finiteNumber(row.low),
    open: finiteNumber(row.open),
    timestamp: finiteNumber(row.timestamp),
    turnover: typeof row.turnover === 'number' && Number.isFinite(row.turnover) ? row.turnover : undefined,
    volume: finiteNumber(row.volume ?? 0),
  }
}

function rowsFromKLines(rows: StoreV6WindowKLine[], settings: MaIndicatorSettings): StoreV6MaIndicatorRowV2[] {
  const maRows = calculateTradingViewMaShiftRows(rows.map(toKLineData), settings)
  return rows.map((row, index) => ({
    ...(maRows[index] ?? {}),
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  }))
}

function displayRowsFromCalculationRows(
  calculationRows: StoreV6WindowKLine[],
  indicatorRows: StoreV6MaIndicatorRowV2[],
  displayRows: StoreV6WindowKLine[],
) {
  const byBarKey = new Map<string, StoreV6MaIndicatorRowV2>()
  calculationRows.forEach((row, index) => {
    byBarKey.set(row.barKey, indicatorRows[index] ?? {
      barKey: row.barKey,
      globalIndex: row.globalIndex,
      time: finiteNumber(row.time),
      timestamp: finiteNumber(row.timestamp),
    })
  })
  return displayRows.map((row) => byBarKey.get(row.barKey) ?? {
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  })
}

function requiredWarmupRows(request: StoreV6IndicatorRequestSpecV2) {
  const settings = normalizeRequestSettings(request)
  return Math.max(0, Math.min(5000, settings.length + settings.shiftLength))
}

export const storeV6MaIndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<Partial<MaIndicatorSettings>> = {
  calculationMode: 'computed',
  calculateHistory: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const rows = rowsFromKLines(context.calculationRows, settings)
    return {
      [storeV6MaIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(context.calculationRows, rows, context.displayRows),
        key: `${storeV6MaIndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
        rows,
        settings,
        source: 'store-v6-ma-indicator-v2',
      },
    }
  },
  calculateRealtime: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const calculationRows = [...context.historyRows, ...context.activeRows]
    const rows = rowsFromKLines(calculationRows, settings)
    return {
      [storeV6MaIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(calculationRows, rows, context.activeRows),
        key: `${storeV6MaIndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
        rows,
        settings,
        source: 'store-v6-ma-indicator-v2',
      },
    }
  },
  id: storeV6MaIndicatorIdV2,
  paneId: storeV6MaPaneIdV2,
  paneRole: 'main',
  realtimeUpdateMode: 'window',
  renderRole: 'main-overlay',
  warmup: {
    historyRows: requiredWarmupRows,
    mode: 'fixedRows',
    realtimeRows: requiredWarmupRows,
  },
}
