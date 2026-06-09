import type { KLineData } from 'klinecharts'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { KLineChartFrameAlignment, KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRealtimeFrame } from './klineChartRealtimeFrameTypes'

type NormalizedRealtimeRow = {
  barKey: string
  globalIndex: number | null
  row: KLineData
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toKLineChartTimestamp(value: number | null) {
  if (value == null) return null
  return value < 1_000_000_000_000 ? value * 1000 : value
}

function normalizeRealtimeRows(rows: StoreV6WindowKLine[]): NormalizedRealtimeRow[] {
  const byTimestamp = new Map<number, NormalizedRealtimeRow>()
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
      row: { close, high, low, open, timestamp, volume },
    })
  })
  return [...byTimestamp.values()].sort((left, right) => Number(left.row.timestamp) - Number(right.row.timestamp))
}

function createAlignment(rows: NormalizedRealtimeRow[]): KLineChartFrameAlignment {
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
  return { barKeyToDataIndex, dataIndexToBarKey, dataIndexToGlobalIndex, dataIndexToTimestamp, globalIndexToDataIndex, timestampToDataIndex }
}

function createPaneFrames(window: StoreV6RealtimePageWindow): Record<string, KLineChartPaneFrame> {
  return Object.fromEntries(Object.entries(window.renderData.indicators).map(([name, series]) => [name, {
    key: series.key,
    paneId: series.paneId,
    paneRole: series.paneRole,
    renderRole: series.renderRole,
    rows: series.displayRows ?? series.rows,
    settings: series.settings,
    source: 'realtime-page-kline-chart-pane-frame-v2' as const,
  }]))
}

export function buildKLineChartRealtimeFrame(window: StoreV6RealtimePageWindow): KLineChartRealtimeFrame {
  const rows = normalizeRealtimeRows(window.renderData.klineRows)
  return {
    alignment: createAlignment(rows),
    key: `kline-chart-realtime-frame-v2:${window.key}`,
    mainRows: rows.map((item) => item.row),
    panes: createPaneFrames(window),
    period: window.period,
    sessionTimeFrom: toKLineChartTimestamp(window.sessionTimeFrom),
    sessionTimeTo: toKLineChartTimestamp(window.sessionTimeTo),
    source: 'realtime-page-kline-chart-frame-v2',
    symbol: window.symbol,
  }
}
