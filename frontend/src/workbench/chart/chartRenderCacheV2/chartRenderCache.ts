import { buildChartRenderWindowV2 } from '../chartRenderWindowV2'
import type { ChartRenderWindowV2 } from '../chartRenderWindowV2'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { translateChartRenderWindowToKLineChartFrameV2 } from '../klineChartTranslatorV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { CachedChartRenderFrameV2, ChartRenderCacheV2Debug, ChartRenderCacheV2PerfEntry } from './chartRenderCacheTypes'

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

function resolveRealtimeKey(realtimeWindow: StoreV6RealtimePageWindow | null) {
  return realtimeWindow?.key ?? 'no-realtime-window'
}

function resolveRenderWindowKey(historyWindow: StoreV6HistoryPageWindow, realtimeWindow: StoreV6RealtimePageWindow | null) {
  return `${historyWindow.key}|${resolveRealtimeKey(realtimeWindow)}`
}

function stripIndicatorKeySuffix(key: string) {
  return key.split(':indicators:')[0]
}

function resolveMainFrameCacheKey(renderWindow: ChartRenderWindowV2) {
  return [
    renderWindow.symbol,
    renderWindow.period,
    renderWindow.pageIndex,
    stripIndicatorKeySuffix(renderWindow.segments.history.key),
    renderWindow.segments.realtime?.timeFrom ?? 'no-realtime',
    renderWindow.segments.realtime?.timeTo ?? 'open-realtime',
    renderWindow.rows.length,
    renderWindow.rows[0]?.timestamp ?? 'empty',
    renderWindow.rows[renderWindow.rows.length - 1]?.timestamp ?? 'empty',
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
  const cached = readCacheEntry(realtimeWindowCache, realtimeWindow.key, maxWindowEntries)
  if (cached) {
    stats.realtimeWindow.hits += 1
    return { hit: true, value: cached }
  }
  stats.realtimeWindow.misses += 1
  return {
    hit: false,
    value: touchCacheEntry(realtimeWindowCache, realtimeWindow.key, realtimeWindow, maxWindowEntries),
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
  if (!import.meta.env.DEV) return
  window.__ffChartV2Cache = {
    finalFrame: { ...stats.finalFrame, size: finalFrameCache.size },
    historyWindow: { ...stats.historyWindow, size: historyWindowCache.size },
    realtimeWindow: { ...stats.realtimeWindow, size: realtimeWindowCache.size },
    renderWindow: { ...stats.renderWindow, size: renderWindowCache.size },
  }
}

function publishPerf(entry: ChartRenderCacheV2PerfEntry) {
  if (!import.meta.env.DEV) return
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
  const end = performance.now()

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
    key: frame.value.key,
    pageIndex: frame.value.pageIndex,
    realtimeRows: realtime.value?.renderData.klineRows.length ?? 0,
    totalRows: frame.value.mainRows.length,
    translateMs: Number((end - translateStart).toFixed(3)),
  })

  return {
    frame: frame.value,
    historyWindow: history.value,
    realtimeWindow: realtime.value,
    renderWindow: renderWindow.value,
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
