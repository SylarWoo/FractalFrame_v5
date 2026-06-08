export const storeV6LivePageSize = 2_000
export const storeV6HistoryPageSize = 2_500

import { buildM5TradingDaySlidingWeekPartition } from './timeAligned/m5TradingDaySlidingWeekPaginator'
import { buildRowsBasedPagePartition } from './rowsBasedPagePartitionBuilder'

const enableM5TimeAlignedPaginator = true

export type StoreV6PagePartitionMode = 'm5-time' | 'rows'

export function resolveStoreV6PagePartitionMode(period: string | null | undefined): StoreV6PagePartitionMode {
  return enableM5TimeAlignedPaginator && String(period ?? '').trim().toUpperCase() === 'M5' ? 'm5-time' : 'rows'
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
  if (resolveStoreV6PagePartitionMode(options.period) === 'm5-time') {
    return buildM5TradingDaySlidingWeekPartition({
      fallback,
      latestTime: options.latestTime,
    })
  }
  return fallback
}
