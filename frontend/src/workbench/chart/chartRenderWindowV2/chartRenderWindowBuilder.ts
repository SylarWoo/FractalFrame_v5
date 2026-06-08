import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { StoreV6HistoryPageWindowIndicatorSeries, StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { ChartRenderWindowRowV2, ChartRenderWindowSegmentV2, ChartRenderWindowV2 } from './chartRenderWindowTypes'

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeRows(rows: StoreV6WindowKLine[], source: 'history' | 'realtime') {
  return rows
    .map((row): ChartRenderWindowRowV2 | null => {
      const timestamp = finiteNumber(row.timestamp)
      if (timestamp == null) return null
      return {
        ...row,
        timestamp,
        windowSource: source,
      }
    })
    .filter((row): row is ChartRenderWindowRowV2 => row != null)
}

function mergeRows(historyRows: StoreV6WindowKLine[], realtimeRows: StoreV6WindowKLine[]) {
  const history = normalizeRows(historyRows, 'history')
  const realtime = normalizeRows(realtimeRows, 'realtime')
  const rows: ChartRenderWindowRowV2[] = []
  let historyIndex = 0
  let realtimeIndex = 0
  while (historyIndex < history.length || realtimeIndex < realtime.length) {
    const historyRow = history[historyIndex]
    const realtimeRow = realtime[realtimeIndex]
    if (!historyRow) {
      rows.push(realtimeRow)
      realtimeIndex += 1
      continue
    }
    if (!realtimeRow) {
      rows.push(historyRow)
      historyIndex += 1
      continue
    }
    const historyTime = Number(historyRow.timestamp)
    const realtimeTime = Number(realtimeRow.timestamp)
    if (historyTime < realtimeTime) {
      rows.push(historyRow)
      historyIndex += 1
      continue
    }
    if (historyTime > realtimeTime) {
      rows.push(realtimeRow)
      realtimeIndex += 1
      continue
    }
    rows.push(realtimeRow)
    historyIndex += 1
    realtimeIndex += 1
  }
  return rows
}

function timeFromRows(rows: ChartRenderWindowRowV2[]) {
  return rows.length ? Math.floor(Number(rows[0].timestamp) / 1000) : null
}

function timeToRows(rows: ChartRenderWindowRowV2[]) {
  return rows.length ? Math.floor(Number(rows[rows.length - 1].timestamp) / 1000) : null
}

function createSegment(
  source: 'history' | 'realtime',
  key: string,
  rows: ChartRenderWindowRowV2[],
  fallbackTimeFrom: number | null,
  fallbackTimeTo: number | null,
): ChartRenderWindowSegmentV2 {
  const indices = rows
    .map((row, index) => row.windowSource === source ? index : -1)
    .filter((index) => index >= 0)
  const segmentRows = indices.map((index) => rows[index])
  const fromIndex = indices.length ? indices[0] : rows.length
  return {
    fromIndex,
    key,
    rows: segmentRows.length,
    source,
    timeFrom: timeFromRows(segmentRows) ?? fallbackTimeFrom,
    timeTo: timeToRows(segmentRows) ?? fallbackTimeTo,
    toIndex: indices.length ? indices[indices.length - 1] : fromIndex - 1,
  }
}

function rowIdentity(row: unknown, fallbackIndex: number) {
  if (row && typeof row === 'object') {
    const record = row as Record<string, unknown>
    const barKey = record.barKey
    if (typeof barKey === 'string' && barKey) return `barKey:${barKey}`
    for (const key of ['time', 'timestamp', 'globalIndex']) {
      const value = record[key]
      if (typeof value === 'number' && Number.isFinite(value)) return `${key}:${value}`
      if (typeof value === 'string' && value) return `${key}:${value}`
    }
  }
  return `index:${fallbackIndex}`
}

function mergeIndicatorSeries(
  left: StoreV6HistoryPageWindowIndicatorSeries,
  right: StoreV6HistoryPageWindowIndicatorSeries,
): StoreV6HistoryPageWindowIndicatorSeries {
  const rows = new Map<string, unknown>()
  left.rows.forEach((row, index) => rows.set(rowIdentity(row, index), row))
  right.rows.forEach((row, index) => rows.set(rowIdentity(row, left.rows.length + index), row))

  const displayRows = new Map<string, unknown>()
  ;(left.displayRows ?? []).forEach((row, index) => displayRows.set(rowIdentity(row, index), row))
  ;(right.displayRows ?? []).forEach((row, index) => displayRows.set(rowIdentity(row, (left.displayRows?.length ?? 0) + index), row))

  return {
    ...left,
    ...right,
    displayRows: displayRows.size ? [...displayRows.values()] : undefined,
    key: left.key === right.key ? left.key : `${left.key}+${right.key}`,
    rows: [...rows.values()],
    settings: left.settings ?? right.settings,
    source: left.source === right.source ? left.source : `${left.source}+${right.source}`,
  }
}

function mergeIndicators(
  historyIndicators: StoreV6HistoryPageWindowIndicators,
  realtimeIndicators: StoreV6HistoryPageWindowIndicators | null | undefined,
) {
  if (!realtimeIndicators || Object.keys(realtimeIndicators).length === 0) return historyIndicators
  const indicators: StoreV6HistoryPageWindowIndicators = { ...historyIndicators }
  Object.entries(realtimeIndicators).forEach(([name, series]) => {
    indicators[name] = indicators[name] ? mergeIndicatorSeries(indicators[name], series) : series
  })
  return indicators
}

export function buildChartRenderWindowV2(options: {
  historyWindow: StoreV6HistoryPageWindow
  realtimeWindow?: StoreV6RealtimePageWindow | null
}): ChartRenderWindowV2 {
  const { historyWindow, realtimeWindow } = options
  const realtimeRows = realtimeWindow?.renderData.klineRows ?? []
  const rows = mergeRows(historyWindow.renderData.klineRows, realtimeRows)
  const historySegment = createSegment('history', historyWindow.key, rows, historyWindow.boundary.actualTimeFrom, historyWindow.boundary.actualTimeTo)
  const realtimeSegment = realtimeWindow && realtimeRows.length > 0
    ? createSegment('realtime', realtimeWindow.key, rows, realtimeWindow.sessionTimeFrom, realtimeWindow.sessionTimeTo)
    : undefined

  return {
    indicators: mergeIndicators(historyWindow.renderData.indicators, realtimeWindow?.renderData.indicators),
    key: `chart-render-window-v2:${historyWindow.key}:${realtimeSegment?.key ?? 'no-realtime'}`,
    pageIndex: historyWindow.pageIndex,
    period: historyWindow.period,
    rows,
    segments: {
      history: historySegment,
      ...(realtimeSegment ? { realtime: realtimeSegment } : {}),
    },
    source: 'chart-render-window-v2',
    symbol: historyWindow.symbol,
  }
}
