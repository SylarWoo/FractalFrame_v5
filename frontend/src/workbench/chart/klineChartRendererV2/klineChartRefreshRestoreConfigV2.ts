import type { ChartPageNavigation, ChartPageNavigationTarget, ChartPageTarget } from '../chartRuntimeTypes'
import { requestStoreV6HistoryPage } from '../historyPageRequestV2'
import { buildStoreV6HistoryPageWindow, type StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import { buildStoreV6PagePartition } from '../pagePartition/pagePartitionBuilder'
import { resolveM5RealtimeOpenFromHistoryClose } from '../pagePartition/timeAligned/m5TradingAnchors'
import { m5TradingDaySlidingWeekProfile } from '../pagePartition/timeAligned/timeAlignedPageTypes'
import { readWatchlistRealtimeEnabled } from '../../mt5DataCenter/storeV6Persistence'
import {
  formatPageTradingDateTime,
  historicalPageSize,
  isCurrentCache,
  pageCacheKey,
  readPageIndexCache,
  realtimePageSize,
  resolvePartitionCacheKind,
  type RealtimePageRow,
} from '../../mt5DataCenter/pagePartitionManagerHelpers'
import { kLineChartConfigV2 } from './klineChartConfigV2'
import { traceKLineChartPageV2 } from './klineChartPageDebugProbeV2'

const storageKey = 'fractalframe:klinechart-v2:refreshRestoreConfig:v1'

export type KLineChartRefreshRestoreConfigV2 = {
  pageIndex: number
  period: string
  realtimeEnabled: boolean
  savedAt: string
  symbol: string
}

export type KLineChartRefreshRestoreTargetV2 = {
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

export function readKLineChartRefreshRestoreConfigV2(): KLineChartRefreshRestoreConfigV2 | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as Partial<KLineChartRefreshRestoreConfigV2> | null
    if (!parsed || typeof parsed !== 'object') return null
    const symbol = typeof parsed.symbol === 'string' ? parsed.symbol.trim() : ''
    const period = typeof parsed.period === 'string' ? parsed.period.trim().toUpperCase() : ''
    if (!symbol || !period) return null
    const value = {
      pageIndex: normalizePageIndex(parsed.pageIndex),
      period,
      realtimeEnabled: parsed.realtimeEnabled !== false,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      symbol,
    }
    traceKLineChartPageV2('RefreshRestore.readConfig', value)
    return value
  } catch {
    return null
  }
}

export function writeKLineChartRefreshRestoreConfigV2(options: {
  pageIndex?: number | null
  period: string
  realtimeEnabled?: boolean
  symbol: string
}) {
  try {
    const symbol = options.symbol.trim()
    const period = options.period.trim().toUpperCase()
    if (!symbol || !period) return
    const value: KLineChartRefreshRestoreConfigV2 = {
      pageIndex: normalizePageIndex(options.pageIndex),
      period,
      realtimeEnabled: options.realtimeEnabled !== false,
      savedAt: new Date().toISOString(),
      symbol,
    }
    window.localStorage.setItem(storageKey, JSON.stringify(value))
    traceKLineChartPageV2('RefreshRestore.writeConfig', value)
  } catch {
    // Local restore is optional in restricted storage modes.
  }
}

export function resolveKLineChartRefreshRestorePageIndexV2(options: {
  period: string | null | undefined
  symbol: string | null | undefined
}) {
  if (!kLineChartConfigV2.refreshRestore.restoreLastPageOnRefresh) return null
  const config = readKLineChartRefreshRestoreConfigV2()
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

function resolveRealtimeStartFromPages(pages: RealtimePageRow[], symbol: string) {
  const latestHistoryPage = pages[0]
  if (!latestHistoryPage || typeof latestHistoryPage.timeTo !== 'number' || !Number.isFinite(latestHistoryPage.timeTo)) return null
  return resolveM5RealtimeOpenFromHistoryClose({
    historyTo: latestHistoryPage.timeTo,
    profile: m5TradingDaySlidingWeekProfile,
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
  const realtimeStart = resolveRealtimeStartFromPages(pages, historyPageWindow.symbol)
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

export async function restoreKLineChartRefreshTargetV2(): Promise<KLineChartRefreshRestoreTargetV2 | null> {
  const config = readKLineChartRefreshRestoreConfigV2()
  if (!config) return null
  traceKLineChartPageV2('RefreshRestore.restoreTarget.start', {
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
  if (!isCurrentCache(cache, partition) || !cache.pages.length) return null
  const page = cache.pages.find((item) => item.index === config.pageIndex) ?? cache.pages[0]
  traceKLineChartPageV2('RefreshRestore.restoreTarget.pageResolved', {
    configPageIndex: config.pageIndex,
    resolvedPageIndex: page.index,
    cachePages: cache.pages.map((item) => item.index).slice(0, 8),
  })
  const historyPageWindow = await requestStoreV6HistoryPage({
    pageIndex: page.index,
    pages: cache.pages,
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
    pageNavigation: buildPageNavigation(page, cache.pages, historyPageWindow),
    period: config.period,
    realtimeEnabled: kLineChartConfigV2.refreshRestore.restoreRealtimeEnabledOnRefresh &&
      config.realtimeEnabled &&
      readWatchlistRealtimeEnabled(),
    symbol: config.symbol,
    totalRows: cache.totalRows,
  }
}
