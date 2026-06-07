import type { ChartPageTarget } from '../ChartCoreHost'
import { resolveInitialLimit } from '../chartCoreDataUtils'
import { storeV6HistoryPageSize, storeV6LivePageSize } from '../pagePartition/pagePartitionBuilder'

export type PageLoadMode = 'realtime' | 'history' | 'jump'

export type PageLoadPlan = {
  chartBehavior: {
    acceptRealtimeTicks: boolean
    followLatest: boolean
    showCountdown: boolean
  }
  mode: PageLoadMode
  page: ChartPageTarget | null
  query: {
    fromGlobalIndex?: number | null
    limit: number
    timeFrom?: number | null
    timeTo?: number | null
    toGlobalIndex?: number | null
    type: 'latest' | 'page' | 'jump'
  }
  requestedRows: number
}

function hasExplicitTimeWindow(page: ChartPageTarget | null | undefined) {
  return typeof page?.timeFrom === 'number' && typeof page.timeTo === 'number'
}

function resolvePageLimit(page: ChartPageTarget | null | undefined, fallback: number) {
  if (!hasExplicitTimeWindow(page)) return fallback
  return typeof page?.limit === 'number' && Number.isFinite(page.limit)
    ? Math.max(1, Math.round(page.limit))
    : fallback
}

export function resolvePageLoadPlan(options: {
  jump?: { id: number; timestamp?: number } | null
  limit?: number
  page?: ChartPageTarget | null
}): PageLoadPlan {
  if (options.jump?.timestamp != null) {
    return {
      chartBehavior: {
        acceptRealtimeTicks: false,
        followLatest: false,
        showCountdown: false,
      },
      mode: 'jump',
      page: null,
      query: {
        limit: resolveInitialLimit(options.limit),
        timeTo: Math.floor(options.jump.timestamp / 1000),
        type: 'jump',
      },
      requestedRows: resolveInitialLimit(options.limit),
    }
  }

  if (options.page?.realtime === false) {
    const limit = resolvePageLimit(options.page, storeV6HistoryPageSize)
    return {
      chartBehavior: {
        acceptRealtimeTicks: false,
        followLatest: false,
        showCountdown: false,
      },
      mode: 'history',
      page: {
        ...options.page,
        limit,
        rows: Math.min(Math.max(1, Math.round(options.page.rows || limit)), limit),
      },
      query: {
        fromGlobalIndex: options.page.fromGlobalIndex,
        limit,
        timeFrom: options.page.timeFrom,
        timeTo: options.page.timeTo,
        toGlobalIndex: options.page.toGlobalIndex,
        type: 'page',
      },
      requestedRows: limit,
    }
  }

  const limit = resolvePageLimit(options.page, storeV6LivePageSize)
  return {
    chartBehavior: {
      acceptRealtimeTicks: true,
      followLatest: true,
      showCountdown: true,
    },
    mode: 'realtime',
    page: options.page ? {
      ...options.page,
      limit,
      rows: Math.max(1, Math.round(options.page.rows || limit)),
    } : {
      fromGlobalIndex: null,
      index: 1,
      limit,
      realtime: true,
      rows: limit,
      toGlobalIndex: null,
    },
    query: {
      limit,
      type: 'latest',
    },
    requestedRows: limit,
  }
}
