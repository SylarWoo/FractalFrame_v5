export const storeV6LivePageSize = 2_000
export const storeV6HistoryPageSize = 2_500

import { buildM5TradingDaySlidingWeekPartition } from './timeAligned/m5TradingDaySlidingWeekPaginator'
import { buildRowsBasedPagePartition } from './rowsBasedPagePartitionBuilder'

const enableM5TimeAlignedPaginator = true

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
  pages: StoreV6PagePartitionItem[]
  period: string
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
  if (enableM5TimeAlignedPaginator && String(options.period ?? '').trim().toUpperCase() === 'M5') {
    return buildM5TradingDaySlidingWeekPartition({
      fallback,
      latestTime: options.latestTime,
    })
  }
  return fallback
}
