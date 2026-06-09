import type { KLineData } from 'klinecharts'
import { normalizeStochSettings, type StochIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewStochRows, type StochIndicatorRow } from '../tradingViewStochIndicator'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export const storeV6StochIndicatorIdV2 = 'Stoch'
export const storeV6StochPaneIdV2 = 'stoch_pane'

export type StoreV6StochIndicatorRowV2 = StochIndicatorRow & {
  barKey: string
  globalIndex: number | null
  time: number
  timestamp: number
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRequestSettings(request: StoreV6IndicatorRequestSpecV2) {
  return normalizeStochSettings(request.params as Partial<StochIndicatorSettings> | undefined)
}

function requiredWarmupRows(request: StoreV6IndicatorRequestSpecV2) {
  const settings = normalizeRequestSettings(request)
  return Math.max(0, Math.min(5000, settings.length + settings.kSmoothing + settings.dSmoothing))
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

function rowsFromKLines(rows: StoreV6WindowKLine[], settings: StochIndicatorSettings): StoreV6StochIndicatorRowV2[] {
  const stochRows = calculateTradingViewStochRows(rows.map(toKLineData), settings)
  return rows.map((row, index) => ({
    ...(stochRows[index] ?? {}),
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  }))
}

function displayRowsFromCalculationRows(
  calculationRows: StoreV6WindowKLine[],
  indicatorRows: StoreV6StochIndicatorRowV2[],
  displayRows: StoreV6WindowKLine[],
) {
  const byBarKey = new Map<string, StoreV6StochIndicatorRowV2>()
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

export const storeV6StochIndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<Partial<StochIndicatorSettings>> = {
  calculationMode: 'computed',
  calculateHistory: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const rows = rowsFromKLines(context.calculationRows, settings)
    return {
      [storeV6StochIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(context.calculationRows, rows, context.displayRows),
        key: `${storeV6StochIndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
        rows,
        settings,
        source: 'store-v6-stoch-indicator-v2',
      },
    }
  },
  calculateRealtime: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const calculationRows = [...context.historyRows, ...context.activeRows]
    const rows = rowsFromKLines(calculationRows, settings)
    return {
      [storeV6StochIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(calculationRows, rows, context.activeRows),
        key: `${storeV6StochIndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
        rows,
        settings,
        source: 'store-v6-stoch-indicator-v2',
      },
    }
  },
  id: storeV6StochIndicatorIdV2,
  paneId: storeV6StochPaneIdV2,
  paneRole: 'sub',
  renderRole: 'sub-pane',
  warmup: {
    historyRows: requiredWarmupRows,
    mode: 'fixedRows',
    realtimeRows: requiredWarmupRows,
  },
}
