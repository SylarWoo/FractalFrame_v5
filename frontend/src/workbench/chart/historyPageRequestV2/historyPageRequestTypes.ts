import type { StoreV6PagePartitionItem } from '../pagePartition/pagePartitionBuilder'
import type { StoreV6PageSlice } from '../pageSliceV2'

export type StoreV6HistoryPageRequest = {
  lookaheadRows?: number
  pageIndex?: number
  pages: StoreV6PagePartitionItem[]
  period: string
  symbol: string
  warmupRows?: number
}

export type StoreV6HistoryPageResult = {
  page: StoreV6PagePartitionItem
  pageIndex: number
  slice: StoreV6PageSlice
  source: 'store-v6-history-page-request-v2'
  status: 'ready'
}

export type StoreV6HistoryPageSliceReader = (request: {
  lookaheadRows?: number
  mode: 'history-page'
  page: StoreV6PagePartitionItem
  period: string
  symbol: string
  warmupRows?: number
}) => Promise<StoreV6PageSlice>
