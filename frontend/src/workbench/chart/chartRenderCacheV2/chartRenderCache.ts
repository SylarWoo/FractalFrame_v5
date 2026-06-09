import { buildChartRenderWindowV2 } from '../chartRenderWindowV2'
import type { ChartRenderWindowRowV2, ChartRenderWindowV2 } from '../chartRenderWindowV2'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { KLineChartFrameAlignment, KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRenderFrameSegment, KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { translateChartRenderWindowToKLineChartFrameV2 } from '../klineChartTranslatorV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { CachedChartRenderFrameV2, ChartRenderCacheV2Debug, ChartRenderCacheV2PerfEntry } from './chartRenderCacheTypes'
import { traceKLineChartPageV2 } from '../klineChartRendererV2/klineChartPageDebugProbeV2'

declare global {
  interface Window {
    __ffChartV2Cache?: ChartRenderCacheV2Debug
    __ffChartV2Perf?: ChartRenderCacheV2PerfEntry[]
  }
}

const maxWindowEntries = 24
const maxRenderEntries = 48
const maxFrameEntries = 48
const maxPerfEntries = 120

const historyWindowCache = new Map<string, StoreV6HistoryPageWindow>()
const realtimeWindowCache = new Map<string, StoreV6RealtimePageWindow>()
const renderWindowCache = new Map<string, ChartRenderWindowV2>()
const finalFrameCache = new Map<string, KLineChartRenderFrameV2>()

const stats = {
  finalFrame: { hits: 0, misses: 0 },
  historyWindow: { hits: 0, misses: 0 },
  realtimeWindow: { hits: 0, misses: 0 },
  renderWindow: { hits: 0, misses: 0 },
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function touchCacheEntry<K, V>(cache: Map<K, V>, key: K, value: V, maxEntries: number) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value
    if (oldestKey == null) break
    cache.delete(oldestKey)
  }
  return value
}

function readCacheEntry<K, V>(cache: Map<K, V>, key: K, maxEntries: number) {
  const value = cache.get(key)
  if (value == null) return null
  touchCacheEntry(cache, key, value, maxEntries)
  return value
}

function realtimeStableKey(realtimeWindow: StoreV6RealtimePageWindow | null) {
  if (!realtimeWindow) return 'no-realtime-window'
  const rows = realtimeWindow.stableRows
  const stablePart = rows.length
    ? `stable:${rows[0]?.time ?? 'none'}:${rows[rows.length - 1]?.time ?? 'none'}:${rows.length}`
    : 'stable-empty'
  const indicatorPart = realtimeWindow.indicatorRequests.length
    ? realtimeWindow.indicatorRequests
        .map((request) => `${request.id}:${request.enabled === false ? 'off' : 'on'}:${request.paneId ?? ''}:${JSON.stringify(request.params ?? null)}`)
        .join('|')
    : 'no-indicators'
  return [
    realtimeWindow.symbol,
    realtimeWindow.period,
    realtimeWindow.sessionTimeFrom ?? 'none',
    realtimeWindow.sessionTimeTo ?? 'open',
    indicatorPart,
    stablePart,
  ].join(':')
}

function resolveRenderWindowKey(historyWindow: StoreV6HistoryPageWindow, realtimeWindow: StoreV6RealtimePageWindow | null) {
  return `${historyWindow.key}|${realtimeStableKey(realtimeWindow)}`
}

function stripIndicatorKeySuffix(key: string) {
  return key.split(':indicators:')[0]
}

function rowPriceSignature(row: ChartRenderWindowV2['rows'][number] | undefined) {
  if (!row) return 'empty'
  return [
    row.timestamp ?? 'none',
    row.open ?? 'none',
    row.high ?? 'none',
    row.low ?? 'none',
    row.close ?? 'none',
    row.volume ?? 'none',
  ].join(',')
}

function resolveMainFrameCacheKey(renderWindow: ChartRenderWindowV2) {
  const firstRow = renderWindow.rows[0]
  const lastRow = renderWindow.rows[renderWindow.rows.length - 1]
  return [
    renderWindow.symbol,
    renderWindow.period,
    renderWindow.pageIndex,
    stripIndicatorKeySuffix(renderWindow.segments.history.key),
    renderWindow.segments.realtime?.timeFrom ?? 'no-realtime',
    renderWindow.segments.realtime?.timeTo ?? 'open-realtime',
    renderWindow.rows.length,
    rowPriceSignature(firstRow),
    rowPriceSignature(lastRow),
  ].join(':')
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

function attachCurrentPaneFrames(frame: KLineChartRenderFrameV2, renderWindow: ChartRenderWindowV2): KLineChartRenderFrameV2 {
  return {
    ...frame,
    key: `kline-chart-render-frame-v2:${renderWindow.key}`,
    panes: createPaneFrames(renderWindow),
  }
}

function buildStableRealtimeWindow(realtimeWindow: StoreV6RealtimePageWindow | null): StoreV6RealtimePageWindow | null {
  if (!realtimeWindow) return null
  const stableKey = realtimeStableKey(realtimeWindow)
  return {
    ...realtimeWindow,
    activeRows: realtimeWindow.stableRows,
    key: `realtime-window-v2-stable:${stableKey}`,
    renderData: {
      ...realtimeWindow.renderData,
      klineRows: realtimeWindow.stableRows,
    },
    tailRow: null,
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

function patchTailRowIntoFrame(
  frame: KLineChartRenderFrameV2,
  renderWindow: ChartRenderWindowV2,
  realtimeWindow: StoreV6RealtimePageWindow | null,
) {
  const tailRow = realtimeWindow?.tailRow ?? null
  const tail = realtimeTailRowToKLineData(tailRow)
  if (!realtimeWindow || !tailRow || !tail) {
    return {
      frame: attachCurrentPaneFrames(frame, renderWindow),
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
    ...attachCurrentPaneFrames(frame, renderWindow),
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

function cacheHistoryWindow(historyWindow: StoreV6HistoryPageWindow) {
  const cached = readCacheEntry(historyWindowCache, historyWindow.key, maxWindowEntries)
  if (cached) {
    stats.historyWindow.hits += 1
    return { hit: true, value: cached }
  }
  stats.historyWindow.misses += 1
  return {
    hit: false,
    value: touchCacheEntry(historyWindowCache, historyWindow.key, historyWindow, maxWindowEntries),
  }
}

function cacheRealtimeWindow(realtimeWindow: StoreV6RealtimePageWindow | null) {
  if (!realtimeWindow) return { hit: true, value: null }
  const key = realtimeStableKey(realtimeWindow)
  const stableWindow = buildStableRealtimeWindow(realtimeWindow)
  if (!stableWindow) return { hit: true, value: null }
  const cached = readCacheEntry(realtimeWindowCache, key, maxWindowEntries)
  if (cached) {
    stats.realtimeWindow.hits += 1
    return { hit: true, value: cached }
  }
  stats.realtimeWindow.misses += 1
  return {
    hit: false,
    value: touchCacheEntry(realtimeWindowCache, key, stableWindow, maxWindowEntries),
  }
}

function readOrBuildRenderWindow(historyWindow: StoreV6HistoryPageWindow, realtimeWindow: StoreV6RealtimePageWindow | null) {
  const key = resolveRenderWindowKey(historyWindow, realtimeWindow)
  const cached = readCacheEntry(renderWindowCache, key, maxRenderEntries)
  if (cached) {
    stats.renderWindow.hits += 1
    return { hit: true, value: cached }
  }
  stats.renderWindow.misses += 1
  return {
    hit: false,
    value: touchCacheEntry(renderWindowCache, key, buildChartRenderWindowV2({ historyWindow, realtimeWindow }), maxRenderEntries),
  }
}

function readOrTranslateFrame(renderWindow: ChartRenderWindowV2) {
  const key = resolveMainFrameCacheKey(renderWindow)
  const cached = readCacheEntry(finalFrameCache, key, maxFrameEntries)
  if (cached) {
    stats.finalFrame.hits += 1
    return { hit: true, value: attachCurrentPaneFrames(cached, renderWindow) }
  }
  stats.finalFrame.misses += 1
  const frame = translateChartRenderWindowToKLineChartFrameV2(renderWindow)
  return {
    hit: false,
    value: touchCacheEntry(finalFrameCache, key, frame, maxFrameEntries),
  }
}

function publishDebug() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  window.__ffChartV2Cache = {
    finalFrame: { ...stats.finalFrame, size: finalFrameCache.size },
    historyWindow: { ...stats.historyWindow, size: historyWindowCache.size },
    realtimeWindow: { ...stats.realtimeWindow, size: realtimeWindowCache.size },
    renderWindow: { ...stats.renderWindow, size: renderWindowCache.size },
  }
}

function publishPerf(entry: ChartRenderCacheV2PerfEntry) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const entries = window.__ffChartV2Perf ?? []
  entries.push(entry)
  window.__ffChartV2Perf = entries.slice(-maxPerfEntries)
}

export function buildCachedKLineChartRenderFrameV2(options: {
  historyWindow: StoreV6HistoryPageWindow
  realtimeWindow?: StoreV6RealtimePageWindow | null
}): CachedChartRenderFrameV2 {
  const start = performance.now()
  const history = cacheHistoryWindow(options.historyWindow)
  const realtime = cacheRealtimeWindow(options.realtimeWindow ?? null)
  const renderStart = performance.now()
  const renderWindow = readOrBuildRenderWindow(history.value, realtime.value)
  const translateStart = performance.now()
  const frame = readOrTranslateFrame(renderWindow.value)
  const patched = patchTailRowIntoFrame(frame.value, renderWindow.value, options.realtimeWindow ?? null)
  if (!patched) {
    const fallbackWindow = buildChartRenderWindowV2({ historyWindow: history.value, realtimeWindow: options.realtimeWindow ?? null })
    const fallbackFrame = translateChartRenderWindowToKLineChartFrameV2(fallbackWindow)
    const end = performance.now()
    publishDebug()
    publishPerf({
      at: Date.now(),
      buildMs: Number((translateStart - renderStart).toFixed(3)),
      cache: {
        finalFrameHit: false,
        historyWindowHit: history.hit,
        realtimeWindowHit: realtime.hit,
        renderWindowHit: false,
      },
      frameMs: Number((end - start).toFixed(3)),
      historyRows: history.value.renderData.klineRows.length,
      key: fallbackFrame.key,
      pageIndex: fallbackFrame.pageIndex,
      realtimeRows: options.realtimeWindow?.renderData.klineRows.length ?? 0,
      totalRows: fallbackFrame.mainRows.length,
      translateMs: Number((end - translateStart).toFixed(3)),
    })
    return {
      frame: fallbackFrame,
      historyWindow: history.value,
      realtimeWindow: options.realtimeWindow ?? null,
      renderWindow: fallbackWindow,
    }
  }
  const end = performance.now()

  traceKLineChartPageV2('ChartRenderCache.buildFrame.ready', {
    finalFrameHit: frame.hit,
    frameKey: patched.frame.key,
    historyKey: history.value.key,
    historyWindowHit: history.hit,
    pageIndex: patched.frame.pageIndex,
    realtimeRows: patched.frame.segments.realtime?.rows ?? 0,
    renderWindowHit: renderWindow.hit,
    renderWindowKey: renderWindow.value.key,
    rows: patched.frame.mainRows.length,
  })

  publishDebug()
  publishPerf({
    at: Date.now(),
    buildMs: Number((translateStart - renderStart).toFixed(3)),
    cache: {
      finalFrameHit: frame.hit,
      historyWindowHit: history.hit,
      realtimeWindowHit: realtime.hit,
      renderWindowHit: renderWindow.hit,
    },
    frameMs: Number((end - start).toFixed(3)),
    historyRows: history.value.renderData.klineRows.length,
    key: patched.frame.key,
    pageIndex: patched.frame.pageIndex,
    realtimeRows: realtime.value?.renderData.klineRows.length ?? 0,
    totalRows: patched.frame.mainRows.length,
    translateMs: Number((end - translateStart).toFixed(3)),
  })

  return {
    frame: patched.frame,
    historyWindow: history.value,
    realtimeWindow: options.realtimeWindow ?? null,
    renderWindow: patched.renderWindow,
  }
}

export function clearChartRenderCacheV2() {
  historyWindowCache.clear()
  realtimeWindowCache.clear()
  renderWindowCache.clear()
  finalFrameCache.clear()
  stats.finalFrame.hits = 0
  stats.finalFrame.misses = 0
  stats.historyWindow.hits = 0
  stats.historyWindow.misses = 0
  stats.realtimeWindow.hits = 0
  stats.realtimeWindow.misses = 0
  stats.renderWindow.hits = 0
  stats.renderWindow.misses = 0
  publishDebug()
}

export function clearChartRenderHistoryCacheV2() {
  historyWindowCache.clear()
  renderWindowCache.clear()
  finalFrameCache.clear()
  stats.finalFrame.hits = 0
  stats.finalFrame.misses = 0
  stats.historyWindow.hits = 0
  stats.historyWindow.misses = 0
  stats.renderWindow.hits = 0
  stats.renderWindow.misses = 0
  publishDebug()
}

export function clearChartRenderRealtimeCacheV2() {
  realtimeWindowCache.clear()
  renderWindowCache.clear()
  finalFrameCache.clear()
  stats.finalFrame.hits = 0
  stats.finalFrame.misses = 0
  stats.realtimeWindow.hits = 0
  stats.realtimeWindow.misses = 0
  stats.renderWindow.hits = 0
  stats.renderWindow.misses = 0
  publishDebug()
}
