import type { KLineData } from 'klinecharts'
import type { KLineChartFrameAlignment, KLineChartHistoryFrame, KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRealtimeFrame } from '../klineChartRealtimeFrameV2'
import type { MorganRangeSegment } from '../morganRangeModel'
import type { KLineChartRenderFrameSegment, KLineChartRenderFrameV2 } from './klineChartRenderFrameTypes'

type SourceRow = {
  barKey: string
  globalIndex: number | null
  row: KLineData
  source: 'history' | 'realtime'
}

function timeFromRows(rows: KLineData[]) {
  return rows.length ? Number(rows[0].timestamp) : null
}

function timeToRows(rows: KLineData[]) {
  return rows.length ? Number(rows[rows.length - 1].timestamp) : null
}

function createHistoryRows(frame: KLineChartHistoryFrame): SourceRow[] {
  return frame.mainRows.map((row, index) => ({
    barKey: frame.alignment.dataIndexToBarKey[index] ?? `${frame.symbol}|${frame.period}|history|${row.timestamp}`,
    globalIndex: frame.alignment.dataIndexToGlobalIndex[index] ?? null,
    row,
    source: 'history',
  }))
}

function createRealtimeRows(frame: KLineChartRealtimeFrame): SourceRow[] {
  return frame.mainRows.map((row, index) => ({
    barKey: frame.alignment.dataIndexToBarKey[index] ?? `${frame.symbol}|${frame.period}|realtime|${row.timestamp}`,
    globalIndex: frame.alignment.dataIndexToGlobalIndex[index] ?? null,
    row,
    source: 'realtime',
  }))
}

function createAlignment(rows: SourceRow[]): KLineChartFrameAlignment {
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

function mergeSourceRows(historyRows: SourceRow[], realtimeRows: SourceRow[]) {
  const byTimestamp = new Map<number, SourceRow>()
  historyRows.forEach((item) => {
    const timestamp = Number(item.row.timestamp)
    if (Number.isFinite(timestamp)) byTimestamp.set(timestamp, item)
  })
  realtimeRows.forEach((item) => {
    const timestamp = Number(item.row.timestamp)
    if (Number.isFinite(timestamp)) byTimestamp.set(timestamp, item)
  })
  return [...byTimestamp.values()].sort((left, right) => Number(left.row.timestamp) - Number(right.row.timestamp))
}

function createPaneRowsByTimestamp(frame: KLineChartHistoryFrame | KLineChartRealtimeFrame, pane: KLineChartPaneFrame | undefined) {
  const byTimestamp = new Map<number, unknown>()
  if (!pane) return byTimestamp
  pane.rows.forEach((row, index) => {
    const timestamp = frame.alignment.dataIndexToTimestamp[index]
    if (Number.isFinite(timestamp)) byTimestamp.set(Number(timestamp), row)
  })
  return byTimestamp
}

function isMorganRangePane(name: string) {
  return name === 'MR_M5' || name === 'MR_M30'
}

function translateMorganRangeSegments(
  frame: KLineChartHistoryFrame | KLineChartRealtimeFrame,
  pane: KLineChartPaneFrame | undefined,
  finalTimestampToDataIndex: Map<number, number>,
) {
  if (!pane) return []
  return (pane.rows as MorganRangeSegment[]).map((segment) => {
    const sourceStartIndex = Math.max(0, Math.round(Number(segment.startIndex)))
    const sourceStartTimestamp = Number(frame.alignment.dataIndexToTimestamp[sourceStartIndex] ?? segment.startTimestamp)
    const finalStartIndex = finalTimestampToDataIndex.get(sourceStartTimestamp)
    if (finalStartIndex == null) return null
    const sourceEndTimestamp = typeof segment.endTimestamp === 'number' && Number.isFinite(segment.endTimestamp)
      ? segment.endTimestamp
      : null
    const finalEndIndex = sourceEndTimestamp == null
      ? null
      : finalTimestampToDataIndex.get(sourceEndTimestamp)
    const width = Math.max(0, Math.round(Number(segment.endIndex)) - sourceStartIndex)
    return {
      ...segment,
      endIndex: finalEndIndex ?? finalStartIndex + width,
      startIndex: finalStartIndex,
      startTimestamp: sourceStartTimestamp,
    }
  }).filter((segment): segment is MorganRangeSegment => segment != null)
}

function mergePanes(
  historyFrame: KLineChartHistoryFrame,
  realtimeFrame: KLineChartRealtimeFrame | null | undefined,
  sourceRows: SourceRow[],
) {
  const names = new Set([
    ...Object.keys(historyFrame.panes),
    ...Object.keys(realtimeFrame?.panes ?? {}),
  ])
  const panes: Record<string, KLineChartPaneFrame> = {}
  const finalTimestampToDataIndex = new Map<number, number>()
  sourceRows.forEach((item, index) => {
    const timestamp = Number(item.row.timestamp)
    if (Number.isFinite(timestamp)) finalTimestampToDataIndex.set(timestamp, index)
  })
  names.forEach((name) => {
    const historyPane = historyFrame.panes[name]
    const realtimePane = realtimeFrame?.panes[name]
    if (isMorganRangePane(name)) {
      panes[name] = {
        key: `${historyPane?.key ?? 'no-history'}:${realtimePane?.key ?? 'no-realtime'}`,
        paneId: realtimePane?.paneId ?? historyPane?.paneId,
        paneRole: realtimePane?.paneRole ?? historyPane?.paneRole,
        renderRole: realtimePane?.renderRole ?? historyPane?.renderRole,
        rows: [
          ...translateMorganRangeSegments(historyFrame, historyPane, finalTimestampToDataIndex),
          ...(realtimeFrame ? translateMorganRangeSegments(realtimeFrame, realtimePane, finalTimestampToDataIndex) : []),
        ],
        settings: realtimePane?.settings ?? historyPane?.settings,
        source: 'kline-chart-render-pane-frame-v2',
      }
      return
    }
    const historyRowsByTimestamp = createPaneRowsByTimestamp(historyFrame, historyPane)
    const realtimeRowsByTimestamp = realtimeFrame ? createPaneRowsByTimestamp(realtimeFrame, realtimePane) : new Map<number, unknown>()
    const rows = sourceRows.map((item) => {
      const timestamp = Number(item.row.timestamp)
      return item.source === 'realtime'
        ? realtimeRowsByTimestamp.get(timestamp) ?? {}
        : historyRowsByTimestamp.get(timestamp) ?? {}
    })
    panes[name] = {
      key: `${historyPane?.key ?? 'no-history'}:${realtimePane?.key ?? 'no-realtime'}`,
      paneId: realtimePane?.paneId ?? historyPane?.paneId,
      paneRole: realtimePane?.paneRole ?? historyPane?.paneRole,
      renderRole: realtimePane?.renderRole ?? historyPane?.renderRole,
      rows,
      settings: realtimePane?.settings ?? historyPane?.settings,
      source: 'kline-chart-render-pane-frame-v2',
    }
  })
  return panes
}

function createSegmentFromUnifiedRows(
  source: 'history' | 'realtime',
  key: string,
  rows: SourceRow[],
  fallbackTimeFrom: number | null,
  fallbackTimeTo: number | null,
): KLineChartRenderFrameSegment {
  const indices = rows
    .map((item, index) => item.source === source ? index : -1)
    .filter((index) => index >= 0)
  const fromIndex = indices.length ? indices[0] : rows.length
  const toIndex = indices.length ? indices[indices.length - 1] : fromIndex - 1
  const segmentRows = indices.map((index) => rows[index].row)
  return {
    fromIndex,
    key,
    rows: segmentRows.length,
    source,
    timeFrom: timeFromRows(segmentRows) ?? fallbackTimeFrom,
    timeTo: timeToRows(segmentRows) ?? fallbackTimeTo,
    toIndex,
  }
}

export function buildKLineChartRenderFrameV2(
  historyFrame: KLineChartHistoryFrame,
  realtimeFrame?: KLineChartRealtimeFrame | null,
): KLineChartRenderFrameV2 {
  const sourceRows = mergeSourceRows(
    createHistoryRows(historyFrame),
    realtimeFrame ? createRealtimeRows(realtimeFrame) : [],
  )
  const mainRows = sourceRows.map((item) => item.row)
  const historySegment = createSegmentFromUnifiedRows('history', historyFrame.key, sourceRows, null, null)
  const realtimeSegment = realtimeFrame
    ? createSegmentFromUnifiedRows('realtime', realtimeFrame.key, sourceRows, realtimeFrame.sessionTimeFrom, realtimeFrame.sessionTimeTo)
    : undefined

  return {
    alignment: createAlignment(sourceRows),
    key: `kline-chart-render-frame-v2:${historyFrame.key}:${realtimeFrame?.key ?? 'no-realtime'}`,
    mainRows,
    pageIndex: historyFrame.pageIndex,
    panes: mergePanes(historyFrame, realtimeFrame, sourceRows),
    period: historyFrame.period,
    segments: {
      history: historySegment,
      ...(realtimeSegment ? { realtime: realtimeSegment } : {}),
    },
    source: 'kline-chart-render-frame-v2',
    symbol: historyFrame.symbol,
  }
}
