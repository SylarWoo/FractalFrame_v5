import type { KLineData } from 'klinecharts'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

type OhlcSubPaneRowV2 = {
  barKey: string
  globalIndex: number | null
  time: number
  timestamp: number
}

type OhlcSubPaneIndicatorDefinitionConfigV2<Row extends object, Settings> = {
  calculateRows: (rows: KLineData[], settings: Settings) => Row[]
  id: string
  normalizeSettings: (settings: Partial<Settings> | undefined) => Settings
  paneId: string
  source: string
  warmupRows: (settings: Settings) => number
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
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

function displayRowsFromCalculationRows<Row extends OhlcSubPaneRowV2>(
  calculationRows: StoreV6WindowKLine[],
  indicatorRows: Row[],
  displayRows: StoreV6WindowKLine[],
) {
  const byBarKey = new Map<string, Row>()
  calculationRows.forEach((row, index) => {
    byBarKey.set(row.barKey, indicatorRows[index] ?? ({
      barKey: row.barKey,
      globalIndex: row.globalIndex,
      time: finiteNumber(row.time),
      timestamp: finiteNumber(row.timestamp),
    } as Row))
  })
  return displayRows.map((row) => byBarKey.get(row.barKey) ?? ({
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  } as Row))
}

export function createOhlcSubPaneIndicatorDefinitionV2<Row extends object, Settings>(
  config: OhlcSubPaneIndicatorDefinitionConfigV2<Row, Settings>,
): StoreV6IndicatorDefinitionV2<Partial<Settings>> {
  const normalizeRequestSettings = (request: StoreV6IndicatorRequestSpecV2) => (
    config.normalizeSettings(request.params as Partial<Settings> | undefined)
  )
  const requiredWarmupRows = (request: StoreV6IndicatorRequestSpecV2) => (
    Math.max(0, Math.min(5000, config.warmupRows(normalizeRequestSettings(request))))
  )
  const rowsFromKLines = (rows: StoreV6WindowKLine[], settings: Settings) => {
    const calculatedRows = config.calculateRows(rows.map(toKLineData), settings)
    return rows.map((row, index) => ({
      ...(calculatedRows[index] ?? {}),
      barKey: row.barKey,
      globalIndex: row.globalIndex,
      time: finiteNumber(row.time),
      timestamp: finiteNumber(row.timestamp),
    })) as Array<Row & OhlcSubPaneRowV2>
  }

  return {
    calculationMode: 'computed',
    calculateHistory: (context) => {
      const settings = normalizeRequestSettings(context.request)
      const rows = rowsFromKLines(context.calculationRows, settings)
      return {
        [config.id]: {
          displayRows: displayRowsFromCalculationRows(context.calculationRows, rows, context.displayRows),
          key: `${config.id}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
          rows,
          settings,
          source: config.source,
        },
      }
    },
    calculateRealtime: (context) => {
      const settings = normalizeRequestSettings(context.request)
      const calculationRows = [...context.historyRows, ...context.activeRows]
      const rows = rowsFromKLines(calculationRows, settings)
      return {
        [config.id]: {
          displayRows: displayRowsFromCalculationRows(calculationRows, rows, context.activeRows),
          key: `${config.id}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
          rows,
          settings,
          source: config.source,
        },
      }
    },
    id: config.id,
    paneId: config.paneId,
    paneRole: 'sub',
    realtimeUpdateMode: 'window',
    renderRole: 'sub-pane',
    warmup: {
      historyRows: requiredWarmupRows,
      mode: 'fixedRows',
      realtimeRows: requiredWarmupRows,
    },
  }
}
