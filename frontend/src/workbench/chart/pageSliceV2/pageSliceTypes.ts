import type { StoreV6WindowKLine } from './storeV6KLineTypes'
import type { StoreV6PagePartitionItem } from '../pagePartition/pagePartitionBuilder'

export type StoreV6PageSliceMode = 'history-page' | 'realtime-window'

export type StoreV6PageSliceRequest = {
  lookaheadRows?: number
  mode?: StoreV6PageSliceMode
  page: StoreV6PagePartitionItem
  period: string
  symbol: string
  warmupRows?: number
}

export type StoreV6PageSliceBoundary = {
  actualFromGlobalIndex: number | null
  actualTimeFrom: number | null
  actualTimeTo: number | null
  actualToGlobalIndex: number | null
  requestedFromGlobalIndex: number | null
  requestedTimeFrom: number | null
  requestedTimeTo: number | null
  requestedToGlobalIndex: number | null
}

export type StoreV6PageSlice = {
  boundary: StoreV6PageSliceBoundary
  calculationRows: StoreV6WindowKLine[]
  displayOffset: number
  displayRows: StoreV6WindowKLine[]
  key: string
  lookaheadRows: StoreV6WindowKLine[]
  mode: StoreV6PageSliceMode
  pageIndex: number
  period: string
  source: 'store-v6-page-slice-v2'
  symbol: string
  warmupRows: StoreV6WindowKLine[]
}
