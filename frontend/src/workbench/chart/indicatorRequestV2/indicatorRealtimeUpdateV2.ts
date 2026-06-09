import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import { refreshRealtimeWindowIndicatorsWithStableCacheV2 } from './realtimeIndicatorStableCacheV2'
import type {
  StoreV6IndicatorRegistryV2,
  StoreV6IndicatorRequestRuntimeV2,
  StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestTypes'
import type { StoreV6WindowKLine } from '../pageSliceV2'

export async function refreshRealtimeWindowIndicatorsV2(options: {
  historyRows?: StoreV6WindowKLine[]
  registry?: StoreV6IndicatorRegistryV2
  requests?: StoreV6IndicatorRequestSpecV2[]
  runtime?: StoreV6IndicatorRequestRuntimeV2
  window: StoreV6RealtimePageWindow
}): Promise<StoreV6RealtimePageWindow> {
  return refreshRealtimeWindowIndicatorsWithStableCacheV2({
    historyRows: options.historyRows,
    registry: options.registry,
    requests: options.requests ?? options.window.indicatorRequests,
    runtime: options.runtime,
    window: options.window,
  })
}
