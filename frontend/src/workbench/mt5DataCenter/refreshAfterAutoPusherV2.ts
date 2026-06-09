import { resolveKLineChartRenderPageIndexV2 } from '../chart/klineChartRendererV2/klineChartRenderPageConfigV2'
import {
  restoreKLineChartRenderPageTargetV2,
  type KLineChartRenderPageTargetV2,
} from '../chart/klineChartRendererV2/klineChartRenderPageConfigV2'
import { traceKLineChartPageV2 } from '../chart/klineChartRendererV2/klineChartPageDebugProbeV2'
import type { RealtimePageRow } from './pagePartitionManagerHelpers'

export type RefreshAfterAutoPushSourceV2 = 'render-page-config' | 'default-cache-page'

export type RefreshAfterAutoPushTargetV2 = {
  page: RealtimePageRow
  restoredPageIndex: number | null
  source: RefreshAfterAutoPushSourceV2
}

export function resolveRefreshAfterAutoPushTargetV2(options: {
  pages: RealtimePageRow[]
  period: string
  symbol: string
}): RefreshAfterAutoPushTargetV2 | null {
  const firstPage = options.pages[0]
  if (!firstPage) return null
  const restoredPageIndex = resolveKLineChartRenderPageIndexV2({
    period: options.period,
    symbol: options.symbol,
  })
  if (restoredPageIndex != null) {
    const restoredPage = options.pages.find((page) => page.index === restoredPageIndex)
    if (restoredPage) {
      return {
        page: restoredPage,
        restoredPageIndex,
        source: 'render-page-config',
      }
    }
  }
  return {
    page: firstPage,
    restoredPageIndex,
    source: 'default-cache-page',
  }
}

export function pushRefreshAfterAutoPageV2(options: {
  pages: RealtimePageRow[]
  period: string
  pushPage: (page: RealtimePageRow, pages: RealtimePageRow[], reason: string) => void
  symbol: string
}) {
  const target = resolveRefreshAfterAutoPushTargetV2({
    pages: options.pages,
    period: options.period,
    symbol: options.symbol,
  })
  if (!target) return null
  traceKLineChartPageV2('RefreshAfterAutoPusher.push', {
    pageIndex: target.page.index,
    restoredPageIndex: target.restoredPageIndex,
    source: target.source,
    symbol: options.symbol,
    period: options.period,
  })
  options.pushPage(target.page, options.pages, `refresh-after-auto-pusher:${target.source}`)
  return target
}

export async function restoreRefreshAfterAutoPushTargetV2(): Promise<KLineChartRenderPageTargetV2 | null> {
  traceKLineChartPageV2('RefreshAfterAutoPusher.restore.start')
  const target = await restoreKLineChartRenderPageTargetV2()
  traceKLineChartPageV2('RefreshAfterAutoPusher.restore.result', {
    pageIndex: target?.page.index ?? null,
    period: target?.period ?? null,
    rows: target?.historyPageWindow.historyRows.length ?? null,
    symbol: target?.symbol ?? null,
  })
  return target
}
