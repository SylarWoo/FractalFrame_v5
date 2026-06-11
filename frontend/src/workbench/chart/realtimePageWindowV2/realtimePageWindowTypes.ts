import type { StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import type { StoreV6IndicatorRegistryV2, StoreV6IndicatorRequestRuntimeV2, StoreV6IndicatorRequestSpecV2 } from '../indicatorRequestV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'

export type StoreV6RealtimePageWindow = {
  activeRows: StoreV6WindowKLine[]
  indicatorRequests: StoreV6IndicatorRequestSpecV2[]
  indicators: StoreV6HistoryPageWindowIndicators
  indicatorHistoryRows?: StoreV6WindowKLine[]
  key: string
  period: string
  updateKind?: 'hydrate' | 'realtime-tail-tick' | 'realtime-bar-close-settlement' | 'stable-page-rebuild'
  renderData: {
    indicators: StoreV6HistoryPageWindowIndicators
    klineRows: StoreV6WindowKLine[]
  }
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  source: 'store-v6-realtime-page-window-v2'
  stableRows: StoreV6WindowKLine[]
  status: 'closed-empty' | 'ready'
  symbol: string
  tailRow: StoreV6WindowKLine | null
}

export type StoreV6RealtimePageWindowRequest = {
  enabled: boolean
  historyRows?: StoreV6WindowKLine[]
  indicatorRegistry?: StoreV6IndicatorRegistryV2
  indicatorRequests?: StoreV6IndicatorRequestSpecV2[]
  indicatorRuntime?: StoreV6IndicatorRequestRuntimeV2
  latestTime?: number | null
  period: string
  sessionTimeFrom?: number | null
  sessionTimeTo?: number | null
  symbol: string
}

export type Mt5RealtimeWindowTick = {
  ask?: number | null
  barVolume?: number | null
  bid?: number | null
  last?: number | null
  symbol: string
  time?: number | null
  timeMsc?: number | null
  volume?: number | null
}
