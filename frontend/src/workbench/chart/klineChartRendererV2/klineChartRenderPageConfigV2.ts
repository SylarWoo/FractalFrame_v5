import type { ChartPageNavigation, ChartPageNavigationTarget, ChartPageTarget } from '../chartRuntimeTypes'
import { requestStoreV6HistoryPage } from '../historyPageRequestV2'
import { buildStoreV6HistoryPageWindow, type StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import { buildStoreV6PagePartition } from '../pagePartition/pagePartitionBuilder'
import { resolveTimeAlignedRealtimeOpenFromHistoryClose } from '../pagePartition/timeAligned/timeAlignedRealtimeAnchors'
import { fetchStoreV6Check } from '../../../services/mt5/mt5SymbolsApi'
import { readWatchlistRealtimeEnabled } from '../../mt5DataCenter/storeV6Persistence'
import {
  formatPageTradingDateTime,
  historicalPageSize,
  isCurrentCache,
  pageCacheKey,
  readPageIndexCache,
  realtimePageSize,
  resolveLastTimeFromStoreStatus,
  resolvePartitionCacheKind,
  resolveRowsFromStoreStatus,
  type RealtimePageRow,
} from '../../mt5DataCenter/pagePartitionManagerHelpers'
import { readJson, writeJson } from '../../persistence/jsonStorage'
import { storageKeys } from '../../persistence/storageKeys'
import { kLineChartConfigV2 } from './klineChartConfigV2'
import { traceKLineChartPageV2 } from './klineChartPageDebugProbeV2'

const legacyRefreshStorageKey = 'fractalframe:klinechart-v2:refreshRestoreConfig:v1'

export type KLineChartRenderPageConfigV2 = {
  page: ChartPageTarget | null
  pageIndex: number
  period: string
  realtimeEnabled: boolean
  savedAt: string
  symbol: string
  totalRows: number | null
}

export type KLineChartRenderPageTargetV2 = {
  historyPageWindow: StoreV6HistoryPageWindow
  page: ChartPageTarget
  pageNavigation: ChartPageNavigation
  period: string
  realtimeEnabled: boolean
  symbol: string
  totalRows: number | null
}

function normalizePageIndex(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1
}

function normalizeIntegerOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

function normalizePositiveIntegerOrNull(value: unknown) {
  const normalized = normalizeIntegerOrNull(value)
  return normalized != null && normalized > 0 ? normalized : null
}

function normalizeRenderPage(value: unknown, fallbackIndex: number): ChartPageTarget | null {
  if (!value || typeof value !== 'object') return null
  const page = value as Partial<ChartPageTarget>
  const index = normalizePageIndex(page.index ?? fallbackIndex)
  const limit = normalizePositiveIntegerOrNull(page.limit)
  const rows = normalizeIntegerOrNull(page.rows)
  const timeFrom = normalizeIntegerOrNull(page.timeFrom)
  const timeTo = normalizeIntegerOrNull(page.timeTo)
  const fromGlobalIndex = normalizeIntegerOrNull(page.fromGlobalIndex)
  const toGlobalIndex = normalizeIntegerOrNull(page.toGlobalIndex)
  if (timeFrom == null && timeTo == null && fromGlobalIndex == null && toGlobalIndex == null) return null
  return {
    fromGlobalIndex,
    identity: typeof page.identity === 'string' && page.identity ? page.identity : null,
    index,
    limit: limit ?? rows ?? historicalPageSize,
    realtime: false,
    rows,
    timeFrom,
    timeTo,
    toGlobalIndex,
  }
}

function toPartitionPage(page: ChartPageTarget): RealtimePageRow {
  return {
    fromGlobalIndex: page.fromGlobalIndex ?? null,
    identity: page.identity ?? null,
    index: normalizePageIndex(page.index),
    limit: normalizePositiveIntegerOrNull(page.limit) ?? normalizePositiveIntegerOrNull(page.rows) ?? historicalPageSize,
    pageType: 'history',
    realtime: false,
    rows: normalizeIntegerOrNull(page.rows),
    timeFrom: normalizeIntegerOrNull(page.timeFrom),
    timeTo: normalizeIntegerOrNull(page.timeTo),
    toGlobalIndex: page.toGlobalIndex ?? null,
  }
}

function readRawConfig(value: unknown): KLineChartRenderPageConfigV2 | null {
  const parsed = value as Partial<KLineChartRenderPageConfigV2> | null
  if (!parsed || typeof parsed !== 'object') return null
  const symbol = typeof parsed.symbol === 'string' ? parsed.symbol.trim() : ''
  const period = typeof parsed.period === 'string' ? parsed.period.trim().toUpperCase() : ''
  if (!symbol || !period) return null
  const pageIndex = normalizePageIndex(parsed.pageIndex)
  return {
    page: normalizeRenderPage(parsed.page, pageIndex),
    pageIndex,
    period,
    realtimeEnabled: parsed.realtimeEnabled !== false,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    symbol,
    totalRows: normalizeIntegerOrNull(parsed.totalRows),
  }
}

function readLegacyRefreshConfig() {
  try {
    return JSON.parse(window.localStorage.getItem(legacyRefreshStorageKey) || 'null') as unknown
  } catch {
    return null
  }
}

export function readKLineChartRenderPageConfigV2(): KLineChartRenderPageConfigV2 | null {
  const persistentValue = readJson<unknown>(storageKeys.renderPageConfig, null)
  const value = readRawConfig(persistentValue) ?? readRawConfig(readLegacyRefreshConfig())
  if (value) traceKLineChartPageV2('RenderPageConfig.read', value)
  return value
}

export function writeKLineChartRenderPageConfigV2(options: {
  page?: ChartPageTarget | null
  pageIndex?: number | null
  period: string
  realtimeEnabled?: boolean
  symbol: string
  totalRows?: number | null
}) {
  try {
    const symbol = options.symbol.trim()
    const period = options.period.trim().toUpperCase()
    if (!symbol || !period) return
    const pageIndex = normalizePageIndex(options.page?.index ?? options.pageIndex)
    const value: KLineChartRenderPageConfigV2 = {
      page: normalizeRenderPage(options.page, pageIndex),
      pageIndex,
      period,
      realtimeEnabled: options.realtimeEnabled !== false,
      savedAt: new Date().toISOString(),
      symbol,
      totalRows: normalizeIntegerOrNull(options.totalRows),
    }
    writeJson(storageKeys.renderPageConfig, value)
    traceKLineChartPageV2('RenderPageConfig.write', value)
  } catch {
    // Local render-page restore is optional in restricted storage modes.
  }
}

export function resolveKLineChartRenderPageIndexV2(options: {
  period: string | null | undefined
  symbol: string | null | undefined
}) {
  if (!kLineChartConfigV2.refreshRestore.restoreLastPageOnRefresh) return null
  const config = readKLineChartRenderPageConfigV2()
  const symbol = typeof options.symbol === 'string' ? options.symbol.trim() : ''
  const period = typeof options.period === 'string' ? options.period.trim().toUpperCase() : ''
  if (!config || !symbol || !period) return null
  if (config.symbol !== symbol || config.period !== period) return null
  return config.pageIndex
}

function toNavigationTarget(page: RealtimePageRow | null | undefined): ChartPageNavigationTarget | null {
  if (!page) return null
  return {
    index: page.index,
    labelFrom: typeof page.timeFrom === 'number' ? formatPageTradingDateTime(page.timeFrom, '开盘') : null,
    labelTo: typeof page.timeTo === 'number' ? formatPageTradingDateTime(page.timeTo, '停盘') : null,
    timeFrom: page.timeFrom ?? null,
    timeTo: page.timeTo ?? null,
  }
}

function resolveRealtimeStartFromPages(pages: RealtimePageRow[], symbol: string, period: string) {
  const latestHistoryPage = pages[0]
  if (!latestHistoryPage || typeof latestHistoryPage.timeTo !== 'number' || !Number.isFinite(latestHistoryPage.timeTo)) return null
  return resolveTimeAlignedRealtimeOpenFromHistoryClose({
    historyTo: latestHistoryPage.timeTo,
    period,
    symbol,
  })
}

function buildPageNavigation(
  page: RealtimePageRow,
  pages: RealtimePageRow[],
  historyPageWindow: StoreV6HistoryPageWindow,
): ChartPageNavigation {
  const actualTimeFrom = historyPageWindow.boundary.actualTimeFrom ?? page.timeFrom ?? null
  const actualTimeTo = historyPageWindow.boundary.actualTimeTo ?? page.timeTo ?? null
  const realtimeStart = resolveRealtimeStartFromPages(pages, historyPageWindow.symbol, historyPageWindow.period)
  return {
    current: {
      index: page.index,
      labelFrom: typeof page.timeFrom === 'number' ? formatPageTradingDateTime(page.timeFrom, '开盘') : null,
      labelTo: typeof page.timeTo === 'number' ? formatPageTradingDateTime(page.timeTo, '停盘') : null,
      timeFrom: actualTimeFrom,
      timeTo: actualTimeTo,
    },
    newer: page.index > 1 ? toNavigationTarget(pages.find((item) => item.index === page.index - 1)) : null,
    older: toNavigationTarget(pages.find((item) => item.index === page.index + 1)),
    realtimeStart,
    realtimeStartLabel: typeof realtimeStart === 'number' ? formatPageTradingDateTime(realtimeStart, '开盘') : null,
  }
}

async function rebuildPagesFromStoreStatus(config: KLineChartRenderPageConfigV2) {
  try {
    const status = await fetchStoreV6Check(config.symbol)
    const totalRows = resolveRowsFromStoreStatus(status, config.period)
    const latestTime = resolveLastTimeFromStoreStatus(status, config.period)
    const partition = buildStoreV6PagePartition({
      historyPageSize: historicalPageSize,
      latestTime,
      livePageSize: realtimePageSize,
      period: config.period,
      symbol: config.symbol,
      totalRows,
    })
    if (resolvePartitionCacheKind(partition) !== 'time' || !partition.pages.length) return null
    return {
      pages: partition.pages,
      totalRows: partition.totalRows,
    }
  } catch {
    return null
  }
}

export async function restoreKLineChartRenderPageTargetV2(): Promise<KLineChartRenderPageTargetV2 | null> {
  const config = readKLineChartRenderPageConfigV2()
  if (!config) return null
  traceKLineChartPageV2('RenderPageConfig.restore.start', {
    configPageIndex: config.pageIndex,
    period: config.period,
    symbol: config.symbol,
  })
  const partition = buildStoreV6PagePartition({
    historyPageSize: historicalPageSize,
    livePageSize: realtimePageSize,
    period: config.period,
    symbol: config.symbol,
  })
  if (resolvePartitionCacheKind(partition) !== 'time') return null
  const cache = readPageIndexCache()[pageCacheKey(config.symbol, config.period, 'time')]
  const cachePages = isCurrentCache(cache, partition) && cache.pages.length ? cache.pages : []
  const renderPage = config.page ? toPartitionPage(config.page) : null
  const rebuilt = !cachePages.length ? await rebuildPagesFromStoreStatus(config) : null
  const cachedPage = cachePages.find((item) => item.index === config.pageIndex) ?? null
  const rebuiltPages = rebuilt?.pages ?? []
  const pages = cachePages.length
    ? renderPage
      ? cachePages.some((item) => item.index === renderPage.index)
        ? cachePages.map((item) => item.index === renderPage.index ? renderPage : item)
        : [...cachePages, renderPage]
      : cachePages
    : rebuiltPages.length
    ? rebuiltPages
    : renderPage
    ? [renderPage]
    : []
  if (!pages.length) return null
  const page = cachedPage ?? pages.find((item) => item.index === config.pageIndex) ?? renderPage ?? pages[0]
  traceKLineChartPageV2('RenderPageConfig.restore.pageResolved', {
    configPageIndex: config.pageIndex,
    resolvedPageIndex: page.index,
    source: cachePages.length ? 'cache' : rebuiltPages.length ? 'rebuilt-store-status' : 'render-page',
  })
  const historyPageWindow = await requestStoreV6HistoryPage({
    pageIndex: page.index,
    pages,
    period: config.period,
    symbol: config.symbol,
  }).then((historyPage) => buildStoreV6HistoryPageWindow({ historyPage }))
  return {
    historyPageWindow,
    page: {
      fromGlobalIndex: historyPageWindow.boundary.actualFromGlobalIndex,
      index: page.index,
      limit: historyPageWindow.historyRows.length,
      realtime: false,
      rows: historyPageWindow.historyRows.length,
      timeFrom: historyPageWindow.boundary.actualTimeFrom ?? page.timeFrom,
      timeTo: historyPageWindow.boundary.actualTimeTo ?? page.timeTo,
      toGlobalIndex: historyPageWindow.boundary.actualToGlobalIndex,
    },
    pageNavigation: buildPageNavigation(page, pages, historyPageWindow),
    period: config.period,
    realtimeEnabled: kLineChartConfigV2.refreshRestore.restoreRealtimeEnabledOnRefresh &&
      config.realtimeEnabled &&
      readWatchlistRealtimeEnabled(),
    symbol: config.symbol,
    totalRows: cachePages.length ? cache?.totalRows ?? null : rebuilt?.totalRows ?? config.totalRows ?? null,
  }
}
