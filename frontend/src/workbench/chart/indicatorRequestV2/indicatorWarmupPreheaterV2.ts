import { buildStoreV6HistoryPageWindow, type StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import { readStoreV6PageSlice } from '../pageSliceV2'
import { maxIndicatorWarmupRowsV2 } from './indicatorWarmupPlannerV2'
import { planCompositeIndicatorDependenciesV2 } from './compositeIndicatorDependencyOrchestratorV2'
import type { StoreV6IndicatorRegistryV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

function resolveRequestedDefinitions(options: {
  registry: StoreV6IndicatorRegistryV2
  requests: StoreV6IndicatorRequestSpecV2[]
}) {
  return options.requests
    .filter((request) => request.enabled !== false)
    .map((request) => {
      const definition = options.registry.get(request.id)
      return definition ? { definition, request } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
}

export async function preheatHistoryWindowForIndicatorsV2(options: {
  registry: StoreV6IndicatorRegistryV2
  requests: StoreV6IndicatorRequestSpecV2[]
  window: StoreV6HistoryPageWindow
}): Promise<StoreV6HistoryPageWindow> {
  const plan = planCompositeIndicatorDependenciesV2(options.requests)
  const definitions = resolveRequestedDefinitions({
    registry: options.registry,
    requests: plan.computeRequests,
  })
  const requiredWarmupRows = maxIndicatorWarmupRowsV2({
    definitions,
    windowKind: 'history',
  })
  if (requiredWarmupRows <= options.window.warmupRows.length) return options.window

  const slice = await readStoreV6PageSlice({
    mode: 'history-page',
    page: options.window.page,
    period: options.window.period,
    symbol: options.window.symbol,
    warmupRows: requiredWarmupRows,
  })
  return buildStoreV6HistoryPageWindow({
    historyPage: {
      page: options.window.page,
      pageIndex: options.window.pageIndex,
      slice,
      source: 'store-v6-history-page-request-v2',
      status: 'ready',
    },
    indicatorRegistry: options.registry,
    indicatorRequests: plan.computeRequests,
  })
}
