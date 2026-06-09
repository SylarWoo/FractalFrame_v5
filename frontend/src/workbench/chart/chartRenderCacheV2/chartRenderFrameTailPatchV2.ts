import type { ChartRenderWindowRowV2, ChartRenderWindowV2 } from '../chartRenderWindowV2'
import type { KLineChartFrameAlignment, KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRenderFrameSegment, KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function createPaneFrames(renderWindow: ChartRenderWindowV2): Record<string, KLineChartPaneFrame> {
  return Object.fromEntries(Object.entries(renderWindow.indicators).map(([name, series]) => [name, {
    key: series.key,
    paneId: series.paneId,
    paneRole: series.paneRole,
    renderRole: series.renderRole,
    rows: series.displayRows ?? series.rows,
    settings: series.settings,
    source: 'history-page-kline-chart-pane-frame-v2' as const,
  }]))
}

export function attachCurrentPaneFramesV2(frame: KLineChartRenderFrameV2, renderWindow: ChartRenderWindowV2): KLineChartRenderFrameV2 {
  return {
    ...frame,
    key: `kline-chart-render-frame-v2:${renderWindow.key}`,
    panes: createPaneFrames(renderWindow),
  }
}

function realtimeTailRowToKLineData(row: StoreV6WindowKLine | null | undefined) {
  if (!row) return null
  const timestamp = finiteNumber(row.timestamp)
  const open = finiteNumber(row.open)
  const high = finiteNumber(row.high)
  const low = finiteNumber(row.low)
  const close = finiteNumber(row.close)
  const volume = finiteNumber(row.volume ?? 0)
  if (timestamp == null || open == null || high == null || low == null || close == null || volume == null) return null
  return {
    close,
    high,
    low,
    open,
    timestamp,
    turnover: finiteNumber(row.turnover) ?? undefined,
    volume,
  }
}

function realtimeTailRowToRenderWindowRow(row: StoreV6WindowKLine | null | undefined): ChartRenderWindowRowV2 | null {
  if (!row || finiteNumber(row.timestamp) == null) return null
  return {
    ...row,
    timestamp: Number(row.timestamp),
    windowSource: 'realtime',
  }
}

function cloneAlignment(alignment: KLineChartFrameAlignment): KLineChartFrameAlignment {
  return {
    barKeyToDataIndex: new Map(alignment.barKeyToDataIndex),
    dataIndexToBarKey: [...alignment.dataIndexToBarKey],
    dataIndexToGlobalIndex: [...alignment.dataIndexToGlobalIndex],
    dataIndexToTimestamp: [...alignment.dataIndexToTimestamp],
    globalIndexToDataIndex: new Map(alignment.globalIndexToDataIndex),
    timestampToDataIndex: new Map(alignment.timestampToDataIndex),
  }
}

function patchAlignmentForTail(
  alignment: KLineChartFrameAlignment,
  row: StoreV6WindowKLine,
  dataIndex: number,
  append: boolean,
) {
  const next = cloneAlignment(alignment)
  const timestamp = Number(row.timestamp)
  if (!append) {
    const previousBarKey = next.dataIndexToBarKey[dataIndex]
    if (previousBarKey) next.barKeyToDataIndex.delete(previousBarKey)
    const previousGlobalIndex = next.dataIndexToGlobalIndex[dataIndex]
    if (previousGlobalIndex != null) next.globalIndexToDataIndex.delete(previousGlobalIndex)
  }
  next.barKeyToDataIndex.set(row.barKey, dataIndex)
  next.dataIndexToBarKey[dataIndex] = row.barKey
  next.dataIndexToGlobalIndex[dataIndex] = row.globalIndex
  next.dataIndexToTimestamp[dataIndex] = timestamp
  next.timestampToDataIndex.set(timestamp, dataIndex)
  if (row.globalIndex != null) next.globalIndexToDataIndex.set(row.globalIndex, dataIndex)
  return next
}

function patchRealtimeSegmentForTail(
  frame: KLineChartRenderFrameV2,
  realtimeWindow: StoreV6RealtimePageWindow,
  dataIndex: number,
  append: boolean,
): KLineChartRenderFrameSegment {
  const existing = frame.segments.realtime
  if (existing) {
    return {
      ...existing,
      key: realtimeWindow.key,
      rows: append ? existing.rows + 1 : existing.rows,
      timeTo: realtimeWindow.tailRow?.timestamp ?? existing.timeTo,
      toIndex: append ? dataIndex : Math.max(existing.toIndex, dataIndex),
    }
  }
  const timestamp = realtimeWindow.tailRow?.timestamp ?? null
  return {
    fromIndex: dataIndex,
    key: realtimeWindow.key,
    rows: 1,
    source: 'realtime',
    timeFrom: timestamp,
    timeTo: timestamp,
    toIndex: dataIndex,
  }
}

function patchTailRowIntoRenderWindow(
  renderWindow: ChartRenderWindowV2,
  realtimeWindow: StoreV6RealtimePageWindow,
  append: boolean,
  dataIndex: number,
): ChartRenderWindowV2 {
  const tailRow = realtimeTailRowToRenderWindowRow(realtimeWindow.tailRow)
  if (!tailRow) return renderWindow
  const rows = append ? [...renderWindow.rows, tailRow] : [...renderWindow.rows]
  rows[dataIndex] = tailRow
  const existing = renderWindow.segments.realtime
  const tailTimeSeconds = Math.floor(Number(tailRow.timestamp) / 1000)
  const realtimeSegment = existing
    ? {
        ...existing,
        key: realtimeWindow.key,
        rows: append ? existing.rows + 1 : existing.rows,
        timeTo: tailTimeSeconds,
        toIndex: append ? dataIndex : Math.max(existing.toIndex, dataIndex),
      }
    : {
        fromIndex: dataIndex,
        key: realtimeWindow.key,
        rows: 1,
        source: 'realtime' as const,
        timeFrom: tailTimeSeconds,
        timeTo: tailTimeSeconds,
        toIndex: dataIndex,
      }
  return {
    ...renderWindow,
    key: `${renderWindow.key}:tail:${tailRow.time}:${tailRow.open}:${tailRow.high}:${tailRow.low}:${tailRow.close}:${tailRow.volume ?? 0}`,
    rows,
    segments: {
      ...renderWindow.segments,
      realtime: realtimeSegment,
    },
  }
}

export function patchTailRowIntoCachedFrameV2(
  frame: KLineChartRenderFrameV2,
  renderWindow: ChartRenderWindowV2,
  realtimeWindow: StoreV6RealtimePageWindow | null,
) {
  const tailRow = realtimeWindow?.tailRow ?? null
  const tail = realtimeTailRowToKLineData(tailRow)
  if (!realtimeWindow || !tailRow || !tail) {
    return {
      frame: attachCurrentPaneFramesV2(frame, renderWindow),
      renderWindow,
      tailPatched: false,
    }
  }
  const timestamp = Number(tail.timestamp)
  const existingIndex = frame.alignment.timestampToDataIndex.get(timestamp)
  const lastTimestamp = finiteNumber(frame.mainRows[frame.mainRows.length - 1]?.timestamp)
  const append = existingIndex == null
  if (append && lastTimestamp != null && timestamp < lastTimestamp) {
    return null
  }
  const dataIndex = append ? frame.mainRows.length : existingIndex
  const mainRows = append ? [...frame.mainRows, tail] : [...frame.mainRows]
  mainRows[dataIndex] = tail
  const alignment = patchAlignmentForTail(frame.alignment, tailRow, dataIndex, append)
  const realtimeSegment = patchRealtimeSegmentForTail(frame, realtimeWindow, dataIndex, append)
  const patchedFrame: KLineChartRenderFrameV2 = {
    ...attachCurrentPaneFramesV2(frame, renderWindow),
    alignment,
    key: `kline-chart-render-frame-v2:${renderWindow.key}:tail:${tailRow.time}:${tailRow.open}:${tailRow.high}:${tailRow.low}:${tailRow.close}:${tailRow.volume ?? 0}`,
    mainRows,
    segments: {
      ...frame.segments,
      realtime: realtimeSegment,
    },
  }
  const patchedRenderWindow = patchTailRowIntoRenderWindow(renderWindow, realtimeWindow, append, dataIndex)
  return {
    frame: patchedFrame,
    renderWindow: patchedRenderWindow,
    tailPatched: true,
  }
}
