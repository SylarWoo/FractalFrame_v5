import {
  clearChartRenderHistoryCacheV2,
  clearChartRenderRealtimeCacheV2,
} from './chartRenderCacheV2'
import { traceKLineChartPageV2 } from './klineChartRendererV2/klineChartPageDebugProbeV2'
import { clearRealtimePageBuffer } from './realtimePageBuffer'
import { clearRealtimeStableWindowCacheV2 } from './realtimePageWindowV2'
import { removeStorageItem } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { dispatchWorkbenchEvent, workbenchEvents } from '../persistence/workbenchEvents'

export type HistoryPageCacheCleanupReason =
  | 'history-page-switch'
  | 'page-index-rebuild'
  | 'stale-page-index-cache'

export type RealtimePageCacheCleanupReason =
  | 'daily-close'
  | 'manual'

export function clearHistoryPageCachesV2(options: {
  pageIndex?: number | null
  period: string
  reason: HistoryPageCacheCleanupReason
  symbol: string
}) {
  clearChartRenderHistoryCacheV2()
  traceKLineChartPageV2('HistoryPageCacheCleanup.clearHistory', {
    pageIndex: options.pageIndex ?? null,
    period: options.period,
    reason: options.reason,
    symbol: options.symbol,
  })
}

export function clearRealtimePageCachesV2(options: {
  period?: string | null
  reason: RealtimePageCacheCleanupReason
  symbol?: string | null
}) {
  clearChartRenderRealtimeCacheV2()
  clearRealtimeStableWindowCacheV2({
    period: options.period ?? null,
    symbol: options.symbol ?? null,
  })
  clearRealtimePageBuffer()
  removeStorageItem(storageKeys.realtimePageSnapshot)
  removeStorageItem(storageKeys.importCenterWatchlistRealtimeSnapshot)
  dispatchWorkbenchEvent(workbenchEvents.realtimePageSnapshotChanged)
  traceKLineChartPageV2('HistoryPageCacheCleanup.clearRealtime', {
    period: options.period ?? null,
    reason: options.reason,
    symbol: options.symbol ?? null,
  })
}
