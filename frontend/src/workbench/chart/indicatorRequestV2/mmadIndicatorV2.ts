import type { KLineData } from 'klinecharts'
import { normalizeMmadSettings, type MmadIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewMmadRows, type MmadIndicatorRow } from '../tradingViewMmadIndicator'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export const storeV6MmadIndicatorIdV2 = 'MMAD'
export const storeV6MmadPaneIdV2 = 'main-mmad-overlay'

export type StoreV6MmadIndicatorRowV2 = MmadIndicatorRow & {
  barKey: string
  globalIndex: number | null
  time: number
  timestamp: number
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRequestSettings(request: StoreV6IndicatorRequestSpecV2) {
  return normalizeMmadSettings(request.params as Partial<MmadIndicatorSettings> | undefined)
}

function resolveWarmupRows(request: StoreV6IndicatorRequestSpecV2) {
  const settings = normalizeRequestSettings(request)
  if (settings.timeframe === '2h') return 9200
  if (settings.timeframe === '30m') return 2200
  return 320
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

function rowsFromKLines(rows: StoreV6WindowKLine[], settings: MmadIndicatorSettings, options: {
  period: string
  symbol: string
}): StoreV6MmadIndicatorRowV2[] {
  const mmadRows = calculateTradingViewMmadRows(rows.map(toKLineData), {
    ...settings,
    period: options.period,
    symbol: options.symbol,
  })
  return rows.map((row, index) => ({
    ...(mmadRows[index] ?? {}),
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  }))
}

function displayRowsFromCalculationRows(
  calculationRows: StoreV6WindowKLine[],
  indicatorRows: StoreV6MmadIndicatorRowV2[],
  displayRows: StoreV6WindowKLine[],
) {
  const byBarKey = new Map<string, StoreV6MmadIndicatorRowV2>()
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

export const storeV6MmadIndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<Partial<MmadIndicatorSettings>> = {
  calculationMode: 'computed',
  calculateHistory: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const calculationRows = context.calculationRows
    const rows = rowsFromKLines(calculationRows, settings, {
      period: context.period,
      symbol: context.symbol,
    })
    return {
      [storeV6MmadIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(calculationRows, rows, context.displayRows),
        key: `${storeV6MmadIndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
        rows,
        settings,
        source: 'store-v6-mmad-indicator-v2',
      },
    }
  },
  calculateRealtime: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const calculationRows = [...context.historyRows, ...context.activeRows]
    const rows = rowsFromKLines(calculationRows, settings, {
      period: context.period,
      symbol: context.symbol,
    })
    return {
      [storeV6MmadIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(calculationRows, rows, context.activeRows),
        key: `${storeV6MmadIndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
        rows,
        settings,
        source: 'store-v6-mmad-indicator-v2',
      },
    }
  },
  id: storeV6MmadIndicatorIdV2,
  paneId: storeV6MmadPaneIdV2,
  paneRole: 'main',
  realtimeUpdateMode: 'window',
  renderRole: 'main-overlay',
  warmup: {
    historyRows: resolveWarmupRows,
    mode: 'fixedRows',
    realtimeRows: resolveWarmupRows,
  },
}
