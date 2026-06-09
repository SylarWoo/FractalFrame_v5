import { buildChartRenderWindowV2 } from '../chartRenderWindowV2'
import type { ChartRenderWindowV2 } from '../chartRenderWindowV2'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { translateChartRenderWindowToKLineChartFrameV2 } from '../klineChartTranslatorV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { CachedChartRenderFrameV2, ChartRenderCacheV2Debug, ChartRenderCacheV2PerfEntry } from './chartRenderCacheTypes'
import { traceKLineChartPageV2 } from '../klineChartRendererV2/klineChartPageDebugProbeV2'
import { createStoreV6IndicatorRequestSignatureV2 } from '../indicatorRequestV2/indicatorRequestSignatureV2'
import { attachCurrentPaneFramesV2, patchTailRowIntoCachedFrameV2 } from './chartRenderFrameTailPatchV2'

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

function realtimeStableKey(realtimeWindow: StoreV6RealtimePageWindow | null) {
  if (!realtimeWindow) return 'no-realtime-window'
  const rows = realtimeWindow.stableRows
  const stablePart = rows.length
    ? `stable:${rows[0]?.time ?? 'none'}:${rows[rows.length - 1]?.time ?? 'none'}:${rows.length}`
    : 'stable-empty'
  const indicatorPart = createStoreV6IndicatorRequestSignatureV2(realtimeWindow.indicatorRequests)
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
    return { hit: true, value: attachCurrentPaneFramesV2(cached, renderWindow) }
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
  const patched = patchTailRowIntoCachedFrameV2(frame.value, renderWindow.value, options.realtimeWindow ?? null)
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
