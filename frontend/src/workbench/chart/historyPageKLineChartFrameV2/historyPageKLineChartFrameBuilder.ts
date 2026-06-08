import type { KLineData } from 'klinecharts'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { KLineChartFrameAlignment, KLineChartHistoryFrame, KLineChartPaneFrame } from './historyPageKLineChartFrameTypes'

type NormalizedMainRow = {
  barKey: string
  globalIndex: number | null
  row: KLineData
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeMainRows(rows: StoreV6WindowKLine[]): NormalizedMainRow[] {
  const byTimestamp = new Map<number, NormalizedMainRow>()
  rows.forEach((sourceRow) => {
    const timestamp = finiteNumber(sourceRow.timestamp)
    const open = finiteNumber(sourceRow.open)
    const high = finiteNumber(sourceRow.high)
    const low = finiteNumber(sourceRow.low)
    const close = finiteNumber(sourceRow.close)
    const volume = finiteNumber(sourceRow.volume ?? 0)
    if (timestamp == null || open == null || high == null || low == null || close == null || volume == null) return
    byTimestamp.set(timestamp, {
      barKey: sourceRow.barKey,
      globalIndex: sourceRow.globalIndex,
      row: {
        close,
        high,
        low,
        open,
        timestamp,
        turnover: finiteNumber(sourceRow.turnover) ?? undefined,
        volume,
      },
    })
  })
  return [...byTimestamp.values()].sort((left, right) => Number(left.row.timestamp) - Number(right.row.timestamp))
}

function createAlignment(rows: NormalizedMainRow[]): KLineChartFrameAlignment {
  const barKeyToDataIndex = new Map<string, number>()
  const dataIndexToBarKey: string[] = []
  const dataIndexToGlobalIndex: Array<number | null> = []
  const dataIndexToTimestamp: number[] = []
  const globalIndexToDataIndex = new Map<number, number>()
  const timestampToDataIndex = new Map<number, number>()

  rows.forEach((item, dataIndex) => {
    const timestamp = Number(item.row.timestamp)
    barKeyToDataIndex.set(item.barKey, dataIndex)
    dataIndexToBarKey.push(item.barKey)
    dataIndexToGlobalIndex.push(item.globalIndex)
    dataIndexToTimestamp.push(timestamp)
    timestampToDataIndex.set(timestamp, dataIndex)
    if (item.globalIndex != null) globalIndexToDataIndex.set(item.globalIndex, dataIndex)
  })

  return {
    barKeyToDataIndex,
    dataIndexToBarKey,
    dataIndexToGlobalIndex,
    dataIndexToTimestamp,
    globalIndexToDataIndex,
    timestampToDataIndex,
  }
}

function createPaneFrames(window: StoreV6HistoryPageWindow): Record<string, KLineChartPaneFrame> {
  return Object.fromEntries(Object.entries(window.renderData.indicators).map(([name, series]) => [name, {
    key: series.key,
    rows: series.displayRows ?? series.rows,
    source: 'history-page-kline-chart-pane-frame-v2' as const,
  }]))
}

export function buildKLineChartHistoryFrame(window: StoreV6HistoryPageWindow): KLineChartHistoryFrame {
  const normalizedRows = normalizeMainRows(window.renderData.klineRows)
  return {
    alignment: createAlignment(normalizedRows),
    key: `kline-chart-frame-v2:${window.key}`,
    mainRows: normalizedRows.map((item) => item.row),
    pageIndex: window.pageIndex,
    panes: createPaneFrames(window),
    period: window.period,
    source: 'history-page-kline-chart-frame-v2',
    symbol: window.symbol,
  }
}

