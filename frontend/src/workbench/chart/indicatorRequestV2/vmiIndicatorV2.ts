import type { KLineData } from 'klinecharts'
import {
  defaultVdoIndicatorSettings,
  normalizeVmiSettings,
  type VmiIndicatorSettings,
} from '../../rightDrawer/indicatorSettingsSchema'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewVmiRows, type VmiIndicatorRow } from '../tradingViewVmiIndicator'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export const storeV6VmiIndicatorIdV2 = 'VMI'
export const storeV6VmiPaneIdV2 = 'vmi_pane'

export type StoreV6VmiIndicatorRowV2 = VmiIndicatorRow & {
  barKey: string
  globalIndex: number | null
  time: number
  timestamp: number
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRequestSettings(request: StoreV6IndicatorRequestSpecV2) {
  return normalizeVmiSettings(request.params as Partial<VmiIndicatorSettings> | undefined)
}

function requiredWarmupRows(request: StoreV6IndicatorRequestSpecV2) {
  const settings = normalizeRequestSettings(request)
  const vdoSourceRows = defaultVdoIndicatorSettings.length + defaultVdoIndicatorSettings.emaSmoothing
  return Math.max(0, Math.min(5000, vdoSourceRows + Math.max(settings.fastLength, settings.slowLength)))
}

function toKLineData(row: StoreV6WindowKLine): KLineData {
  return {
    barKey: row.barKey,
    close: finiteNumber(row.close),
    high: finiteNumber(row.high),
    low: finiteNumber(row.low),
    open: finiteNumber(row.open),
    period: row.period,
    sessionId: row.sessionId,
    symbol: row.symbol,
    time: row.time,
    timestamp: finiteNumber(row.timestamp),
    tradingDay: row.tradingDay,
    turnover: typeof row.turnover === 'number' && Number.isFinite(row.turnover) ? row.turnover : undefined,
    volume: finiteNumber(row.volume ?? 0),
  } as KLineData
}

function rowsFromKLines(rows: StoreV6WindowKLine[], settings: VmiIndicatorSettings): StoreV6VmiIndicatorRowV2[] {
  const vmiRows = calculateTradingViewVmiRows(rows.map(toKLineData), settings)
  return rows.map((row, index) => ({
    ...(vmiRows[index] ?? {}),
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  }))
}

function displayRowsFromCalculationRows(
  calculationRows: StoreV6WindowKLine[],
  indicatorRows: StoreV6VmiIndicatorRowV2[],
  displayRows: StoreV6WindowKLine[],
) {
  const byBarKey = new Map<string, StoreV6VmiIndicatorRowV2>()
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

export const storeV6VmiIndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<Partial<VmiIndicatorSettings>> = {
  calculationMode: 'computed',
  calculateHistory: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const rows = rowsFromKLines(context.calculationRows, settings)
    return {
      [storeV6VmiIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(context.calculationRows, rows, context.displayRows),
        key: `${storeV6VmiIndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
        rows,
        settings,
        source: 'store-v6-vmi-indicator-v2',
      },
    }
  },
  calculateRealtime: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const calculationRows = [...context.historyRows, ...context.activeRows]
    const rows = rowsFromKLines(calculationRows, settings)
    return {
      [storeV6VmiIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(calculationRows, rows, context.activeRows),
        key: `${storeV6VmiIndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
        rows,
        settings,
        source: 'store-v6-vmi-indicator-v2',
      },
    }
  },
  id: storeV6VmiIndicatorIdV2,
  paneId: storeV6VmiPaneIdV2,
  paneRole: 'sub',
  realtimeUpdateMode: 'window',
  renderRole: 'sub-pane',
  warmup: {
    historyRows: requiredWarmupRows,
    mode: 'fixedRows',
    realtimeRows: requiredWarmupRows,
  },
}
