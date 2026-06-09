import type { KLineData } from 'klinecharts'
import { normalizeVwapSettings, type VwapIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewVwapRows, type VwapIndicatorRow } from '../tradingViewVwapIndicator'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export const storeV6VwapIndicatorIdV2 = 'VWAP'
export const storeV6VwapPaneIdV2 = 'main-vwap-overlay'

export type StoreV6VwapIndicatorRowV2 = VwapIndicatorRow & {
  barKey: string
  globalIndex: number | null
  time: number
  timestamp: number
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRequestSettings(request: StoreV6IndicatorRequestSpecV2) {
  return normalizeVwapSettings(request.params as Partial<VwapIndicatorSettings> | undefined)
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

function rowsFromKLines(rows: StoreV6WindowKLine[], settings: VwapIndicatorSettings, options: {
  period: string
  symbol: string
}): StoreV6VwapIndicatorRowV2[] {
  const vwapRows = calculateTradingViewVwapRows(rows.map(toKLineData), {
    ...settings,
    period: options.period,
    symbol: options.symbol,
  })
  return rows.map((row, index) => ({
    ...(vwapRows[index] ?? {}),
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  }))
}

function displayRowsFromCalculationRows(
  calculationRows: StoreV6WindowKLine[],
  indicatorRows: StoreV6VwapIndicatorRowV2[],
  displayRows: StoreV6WindowKLine[],
) {
  const byBarKey = new Map<string, StoreV6VwapIndicatorRowV2>()
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

export const storeV6VwapIndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<Partial<VwapIndicatorSettings>> = {
  calculationMode: 'computed',
  calculateHistory: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const rows = rowsFromKLines(context.displayRows, settings, {
      period: context.period,
      symbol: context.symbol,
    })
    return {
      [storeV6VwapIndicatorIdV2]: {
        displayRows: rows,
        key: `${storeV6VwapIndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
        rows,
        settings,
        source: 'store-v6-vwap-indicator-v2',
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
      [storeV6VwapIndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(calculationRows, rows, context.activeRows),
        key: `${storeV6VwapIndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
        rows,
        settings,
        source: 'store-v6-vwap-indicator-v2',
      },
    }
  },
  id: storeV6VwapIndicatorIdV2,
  paneId: storeV6VwapPaneIdV2,
  paneRole: 'main',
  renderRole: 'main-overlay',
  warmup: {
    historyRows: 0,
    mode: 'none',
    realtimeRows: 0,
  },
}
