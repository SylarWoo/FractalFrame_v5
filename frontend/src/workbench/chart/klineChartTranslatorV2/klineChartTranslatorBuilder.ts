import type { KLineData } from 'klinecharts'
import type { KLineChartFrameAlignment, KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRenderFrameSegment, KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import type { ChartRenderWindowRowV2, ChartRenderWindowSegmentV2, ChartRenderWindowV2 } from '../chartRenderWindowV2'

type NormalizedRow = {
  barKey: string
  globalIndex: number | null
  row: KLineData
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeRows(rows: ChartRenderWindowRowV2[]): NormalizedRow[] {
  return rows
    .map((sourceRow): NormalizedRow | null => {
      const timestamp = finiteNumber(sourceRow.timestamp)
      const open = finiteNumber(sourceRow.open)
      const high = finiteNumber(sourceRow.high)
      const low = finiteNumber(sourceRow.low)
      const close = finiteNumber(sourceRow.close)
      const volume = finiteNumber(sourceRow.volume ?? 0)
      if (timestamp == null || open == null || high == null || low == null || close == null || volume == null) return null
      return {
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
      }
    })
    .filter((row): row is NormalizedRow => row != null)
}

function createAlignment(rows: NormalizedRow[]): KLineChartFrameAlignment {
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

function translateSegment(segment: ChartRenderWindowSegmentV2): KLineChartRenderFrameSegment {
  return {
    fromIndex: segment.fromIndex,
    key: segment.key,
    rows: segment.rows,
    source: segment.source,
    timeFrom: segment.timeFrom == null ? null : segment.timeFrom * 1000,
    timeTo: segment.timeTo == null ? null : segment.timeTo * 1000,
    toIndex: segment.toIndex,
  }
}

function createPaneFrames(window: ChartRenderWindowV2): Record<string, KLineChartPaneFrame> {
  return Object.fromEntries(Object.entries(window.indicators).map(([name, series]) => [name, {
    key: series.key,
    paneId: series.paneId,
    paneRole: series.paneRole,
    renderRole: series.renderRole,
    rows: series.displayRows ?? series.rows,
    settings: series.settings,
    source: 'history-page-kline-chart-pane-frame-v2' as const,
  }]))
}

export function translateChartRenderWindowToKLineChartFrameV2(window: ChartRenderWindowV2): KLineChartRenderFrameV2 {
  const normalizedRows = normalizeRows(window.rows)
  return {
    alignment: createAlignment(normalizedRows),
    key: `kline-chart-render-frame-v2:${window.key}`,
    mainRows: normalizedRows.map((item) => item.row),
    pageIndex: window.pageIndex,
    panes: createPaneFrames(window),
    period: window.period,
    segments: {
      history: translateSegment(window.segments.history),
      ...(window.segments.realtime ? { realtime: translateSegment(window.segments.realtime) } : {}),
    },
    source: 'kline-chart-render-frame-v2',
    symbol: window.symbol,
  }
}
