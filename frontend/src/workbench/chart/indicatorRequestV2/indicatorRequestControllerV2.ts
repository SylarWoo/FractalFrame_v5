import type { StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import { storeV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import type {
  RequestHistoryWindowIndicatorsV2Options,
  RequestRealtimeWindowIndicatorsV2Options,
  StoreV6IndicatorCalculationModeV2,
  StoreV6IndicatorDefinitionV2,
  StoreV6IndicatorPaneRoleV2,
  StoreV6IndicatorRegistryV2,
  StoreV6IndicatorRenderRoleV2,
  StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestTypes'
import { planIndicatorWarmupV2 } from './indicatorWarmupPlannerV2'

function normalizeIndicatorId(id: string) {
  return id.trim().toUpperCase()
}

function mergeIndicators(
  left: StoreV6HistoryPageWindowIndicators,
  right: StoreV6HistoryPageWindowIndicators | null | undefined,
) {
  return {
    ...left,
    ...(right ?? {}),
  }
}

function resolvePaneRole(definition: StoreV6IndicatorDefinitionV2): StoreV6IndicatorPaneRoleV2 {
  return definition.paneRole ?? 'sub'
}

function resolveRenderRole(definition: StoreV6IndicatorDefinitionV2): StoreV6IndicatorRenderRoleV2 {
  return definition.renderRole ?? (resolvePaneRole(definition) === 'main' ? 'main-overlay' : 'sub-pane')
}

function resolveCalculationMode(definition: StoreV6IndicatorDefinitionV2): StoreV6IndicatorCalculationModeV2 {
  return definition.calculationMode ?? 'computed'
}

function resolvePaneId(definition: StoreV6IndicatorDefinitionV2, request: StoreV6IndicatorRequestSpecV2) {
  return request.paneId ?? definition.paneId ?? definition.id
}

function attachIndicatorMetadata(
  indicators: StoreV6HistoryPageWindowIndicators | null | undefined,
  definition: StoreV6IndicatorDefinitionV2,
  request: StoreV6IndicatorRequestSpecV2,
) {
  const value = indicators ?? {}
  const paneRole = resolvePaneRole(definition)
  const renderRole = resolveRenderRole(definition)
  const calculationMode = resolveCalculationMode(definition)
  const paneId = resolvePaneId(definition, request)
  return Object.fromEntries(Object.entries(value).map(([name, series]) => [name, {
    calculationMode: series.calculationMode ?? calculationMode,
    id: series.id ?? definition.id,
    paneId: series.paneId ?? paneId,
    paneRole: series.paneRole ?? paneRole,
    renderRole: series.renderRole ?? renderRole,
    ...series,
  }]))
}

function resolveRequests(
  registry: StoreV6IndicatorRegistryV2,
  requests: StoreV6IndicatorRequestSpecV2[] | null | undefined,
): Array<{ definition: StoreV6IndicatorDefinitionV2; request: StoreV6IndicatorRequestSpecV2 }> {
  if (requests) {
    return requests
      .filter((request) => request.enabled !== false)
      .map((request) => ({
        definition: registry.get(request.id),
        request: {
          ...request,
          id: normalizeIndicatorId(request.id),
        },
      }))
      .filter((entry): entry is { definition: StoreV6IndicatorDefinitionV2; request: StoreV6IndicatorRequestSpecV2 } => entry.definition != null)
  }
  return registry.list().map((definition) => ({
    definition,
    request: {
      id: definition.id,
    },
  }))
}

export async function requestHistoryWindowIndicatorsV2(
  options: RequestHistoryWindowIndicatorsV2Options,
): Promise<StoreV6HistoryPageWindowIndicators> {
  const registry = options.registry ?? storeV6IndicatorRegistryV2
  const requests = resolveRequests(registry, options.requests ?? options.runtime?.list())
  let indicators: StoreV6HistoryPageWindowIndicators = {}
  for (const { definition, request } of requests) {
    if (!definition.calculateHistory) continue
    const paneRole = resolvePaneRole(definition)
    const renderRole = resolveRenderRole(definition)
    const calculationMode = resolveCalculationMode(definition)
    const paneId = resolvePaneId(definition, request)
    const warmupPlan = planIndicatorWarmupV2({
      availableRows: options.warmupRows.length,
      definition,
      request,
      windowKind: 'history',
    })
    indicators = mergeIndicators(indicators, attachIndicatorMetadata(await definition.calculateHistory({
      boundary: options.boundary,
      calculationRows: options.calculationRows,
      calculationMode,
      displayOffset: options.displayOffset,
      displayRows: options.displayRows,
      pageIndex: options.pageIndex,
      paneId,
      paneRole,
      params: request.params,
      period: options.period,
      renderRole,
      request,
      symbol: options.symbol,
      warmupPlan,
      warmupRows: options.warmupRows,
      windowKind: 'history',
    }), definition, request))
  }
  return indicators
}

export async function requestRealtimeWindowIndicatorsV2(
  options: RequestRealtimeWindowIndicatorsV2Options,
): Promise<StoreV6HistoryPageWindowIndicators> {
  const registry = options.registry ?? storeV6IndicatorRegistryV2
  const requests = resolveRequests(registry, options.requests ?? options.runtime?.list())
  let indicators: StoreV6HistoryPageWindowIndicators = {}
  for (const { definition, request } of requests) {
    if (!definition.calculateRealtime) continue
    const historyRows = options.historyRows ?? []
    const paneRole = resolvePaneRole(definition)
    const renderRole = resolveRenderRole(definition)
    const calculationMode = resolveCalculationMode(definition)
    const paneId = resolvePaneId(definition, request)
    const warmupPlan = planIndicatorWarmupV2({
      availableRows: historyRows.length,
      definition,
      request,
      windowKind: 'realtime',
    })
    indicators = mergeIndicators(indicators, attachIndicatorMetadata(await definition.calculateRealtime({
      activeRows: options.activeRows,
      calculationMode,
      historyRows,
      paneId,
      paneRole,
      params: request.params,
      period: options.period,
      renderRole,
      request,
      sessionTimeFrom: options.sessionTimeFrom,
      sessionTimeTo: options.sessionTimeTo,
      symbol: options.symbol,
      warmupPlan,
      windowKind: 'realtime',
    }), definition, request))
  }
  return indicators
}
