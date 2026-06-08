import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import { requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
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
  const indicators = await requestRealtimeWindowIndicatorsV2({
    activeRows: options.window.activeRows,
    historyRows: options.historyRows,
    period: options.window.period,
    registry: options.registry,
    requests: options.requests ?? options.window.indicatorRequests,
    runtime: options.runtime,
    sessionTimeFrom: options.window.sessionTimeFrom,
    sessionTimeTo: options.window.sessionTimeTo,
    symbol: options.window.symbol,
  })
  return {
    ...options.window,
    indicators,
    renderData: {
      ...options.window.renderData,
      indicators,
    },
  }
}
