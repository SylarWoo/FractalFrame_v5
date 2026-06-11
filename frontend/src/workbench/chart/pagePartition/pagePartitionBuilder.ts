export const storeV6LivePageSize = 2_000
export const storeV6HistoryPageSize = 2_500

import { buildRowsBasedPagePartition } from './rowsBasedPagePartitionBuilder'
import { resolveStoreV6PeriodPageSystemAdapterV2 } from './periodPageSystemRegistryV2'

export type StoreV6PagePartitionMode = 'm5-time' | 'm30-time' | 'h2-time' | 'rows'

export function resolveStoreV6PagePartitionMode(period: string | null | undefined): StoreV6PagePartitionMode {
  return resolveStoreV6PeriodPageSystemAdapterV2(period)?.mode ?? 'rows'
}

export type StoreV6PagePartitionStatus = 'empty' | 'insufficient_rows' | 'missing_selection' | 'ready'

export type StoreV6PagePartitionItem = {
  fromGlobalIndex: number | null
  identity?: string | null
  index: number
  limit: number
  pageType: 'live' | 'history'
  realtime: boolean
  rows: number | null
  timeFrom?: number | null
  timeTo?: number | null
  toGlobalIndex: number | null
}

export type StoreV6PagePartition = {
  historyPageSize: number
  livePageSize: number
  partitionMode: StoreV6PagePartitionMode
  pages: StoreV6PagePartitionItem[]
  period: string
  profileVersion: number
  status: StoreV6PagePartitionStatus
  statusText: string
  symbol: string
  totalRows: number | null
}

export function buildStoreV6PagePartition(options: {
  historyPageSize?: number
  latestTime?: number | null
  livePageSize?: number
  period?: string
  symbol?: string
  totalRows?: number | null
}): StoreV6PagePartition {
  const fallback = buildRowsBasedPagePartition(options)
  const adapter = resolveStoreV6PeriodPageSystemAdapterV2(options.period)
  if (adapter) {
    return adapter.build({
      fallback,
      latestTime: options.latestTime,
    })
  }
  return fallback
}
