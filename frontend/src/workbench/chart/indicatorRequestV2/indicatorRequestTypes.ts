import type { StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import type { StoreV6PageSliceBoundary, StoreV6WindowKLine } from '../pageSliceV2'

export type StoreV6IndicatorWindowKindV2 = 'history' | 'realtime'
export type StoreV6IndicatorPaneRoleV2 = 'main' | 'sub'
export type StoreV6IndicatorRenderRoleV2 = 'main-overlay' | 'sub-pane'
export type StoreV6IndicatorCalculationModeV2 = 'computed' | 'mixed' | 'passthrough'
export type StoreV6IndicatorWarmupModeV2 = 'currentWindowOnly' | 'dynamicRows' | 'fixedRows' | 'none'

export type StoreV6IndicatorRequestSpecV2<Params = unknown> = {
  enabled?: boolean
  id: string
  paneId?: string
  params?: Params
}

export type StoreV6IndicatorWarmupSpecV2<Params = unknown> = {
  historyRows?: number | ((request: StoreV6IndicatorRequestSpecV2<Params>) => number)
  mode: StoreV6IndicatorWarmupModeV2
  realtimeRows?: number | ((request: StoreV6IndicatorRequestSpecV2<Params>) => number)
}

export type StoreV6IndicatorWarmupPlanV2 = {
  availableRows: number
  missingRows: number
  mode: StoreV6IndicatorWarmupModeV2
  requiredRows: number
  windowKind: StoreV6IndicatorWindowKindV2
}

export type StoreV6HistoryIndicatorRequestContextV2<Params = unknown> = {
  boundary: StoreV6PageSliceBoundary
  calculationRows: StoreV6WindowKLine[]
  calculationMode: StoreV6IndicatorCalculationModeV2
  displayOffset: number
  displayRows: StoreV6WindowKLine[]
  pageIndex: number
  paneId: string
  paneRole: StoreV6IndicatorPaneRoleV2
  params?: Params
  period: string
  renderRole: StoreV6IndicatorRenderRoleV2
  request: StoreV6IndicatorRequestSpecV2<Params>
  symbol: string
  warmupPlan: StoreV6IndicatorWarmupPlanV2
  warmupRows: StoreV6WindowKLine[]
  windowKind: 'history'
}

export type StoreV6RealtimeIndicatorRequestContextV2<Params = unknown> = {
  activeRows: StoreV6WindowKLine[]
  calculationMode: StoreV6IndicatorCalculationModeV2
  historyRows: StoreV6WindowKLine[]
  paneId: string
  paneRole: StoreV6IndicatorPaneRoleV2
  params?: Params
  period: string
  renderRole: StoreV6IndicatorRenderRoleV2
  request: StoreV6IndicatorRequestSpecV2<Params>
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  symbol: string
  warmupPlan: StoreV6IndicatorWarmupPlanV2
  windowKind: 'realtime'
}

export type StoreV6IndicatorDefinitionV2<Params = unknown> = {
  calculateHistory?: (
    context: StoreV6HistoryIndicatorRequestContextV2<Params>,
  ) => Promise<StoreV6HistoryPageWindowIndicators> | StoreV6HistoryPageWindowIndicators
  calculateRealtime?: (
    context: StoreV6RealtimeIndicatorRequestContextV2<Params>,
  ) => Promise<StoreV6HistoryPageWindowIndicators> | StoreV6HistoryPageWindowIndicators
  calculationMode?: StoreV6IndicatorCalculationModeV2
  id: string
  paneId?: string
  paneRole?: StoreV6IndicatorPaneRoleV2
  renderRole?: StoreV6IndicatorRenderRoleV2
  warmup?: StoreV6IndicatorWarmupSpecV2<Params>
  warmupRows?: number | ((request: StoreV6IndicatorRequestSpecV2<Params>) => number)
}

export type StoreV6IndicatorRegistryV2 = {
  clear: () => void
  get: (id: string) => StoreV6IndicatorDefinitionV2<any> | null
  list: () => Array<StoreV6IndicatorDefinitionV2<any>>
  register: (definition: StoreV6IndicatorDefinitionV2<any>) => void
}

export type StoreV6IndicatorRequestRuntimeV2 = {
  list: () => StoreV6IndicatorRequestSpecV2[]
}

export type RequestHistoryWindowIndicatorsV2Options = {
  boundary: StoreV6PageSliceBoundary
  calculationRows: StoreV6WindowKLine[]
  displayOffset: number
  displayRows: StoreV6WindowKLine[]
  pageIndex: number
  period: string
  registry?: StoreV6IndicatorRegistryV2
  requests?: StoreV6IndicatorRequestSpecV2[]
  runtime?: StoreV6IndicatorRequestRuntimeV2
  symbol: string
  warmupRows: StoreV6WindowKLine[]
}

export type RequestRealtimeWindowIndicatorsV2Options = {
  activeRows: StoreV6WindowKLine[]
  historyRows?: StoreV6WindowKLine[]
  period: string
  registry?: StoreV6IndicatorRegistryV2
  requests?: StoreV6IndicatorRequestSpecV2[]
  runtime?: StoreV6IndicatorRequestRuntimeV2
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  symbol: string
}
