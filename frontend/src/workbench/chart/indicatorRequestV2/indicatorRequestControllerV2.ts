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
import {
  createStoreV6IndicatorComputeKeyV2,
  planCompositeIndicatorDependenciesV2,
} from './compositeIndicatorDependencyOrchestratorV2'
import {
  createComputedDependencyIdentityV2,
  createHistoryIndicatorComputeCacheKeyV2,
  createIndicatorRowsIdentityV2,
  createRealtimeIndicatorComputeCacheKeyV2,
  readIndicatorComputeCacheV2,
  writeIndicatorComputeCacheV2,
} from './indicatorComputeCacheV2'

type IndicatorPerfEntryV2 = {
  at: number
  cacheHit: boolean
  cacheMissReason?: string
  computeKey: string
  definitionIdentity: string
  dependencyIdentity: string
  displayRows?: number
  historyRows?: number
  id: string
  ms: number
  outputIds: string[]
  realtimeRows?: number
  requestedVisible: boolean
  rowsIdentity: string
  source: 'history' | 'realtime'
  warmupRows: number
  windowRows: number
}

const indicatorDefinitionCacheIdsV2 = new WeakMap<object, string>()
let indicatorDefinitionCacheSeqV2 = 0

declare global {
  interface Window {
    __ffIndicatorV2Perf?: {
      entries: IndicatorPerfEntryV2[]
      historyRuns: number
      realtimeRuns: number
      totals: Record<string, {
        cacheHits: number
        count: number
        maxMs: number
        totalMs: number
      }>
    }
  }
}

function getIndicatorDefinitionCacheIdentityV2(definition: StoreV6IndicatorDefinitionV2) {
  const existing = indicatorDefinitionCacheIdsV2.get(definition)
  if (existing) return existing
  indicatorDefinitionCacheSeqV2 += 1
  const next = `${definition.id}:${indicatorDefinitionCacheSeqV2}`
  indicatorDefinitionCacheIdsV2.set(definition, next)
  return next
}

function publishIndicatorPerfV2(entry: IndicatorPerfEntryV2) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const debug = window.__ffIndicatorV2Perf ?? {
    entries: [],
    historyRuns: 0,
    realtimeRuns: 0,
    totals: {},
  }
  debug.entries.push(entry)
  if (debug.entries.length > 300) debug.entries.splice(0, debug.entries.length - 300)
  if (entry.source === 'history') debug.historyRuns += 1
  if (entry.source === 'realtime') debug.realtimeRuns += 1
  const total = debug.totals[entry.id] ?? { cacheHits: 0, count: 0, maxMs: 0, totalMs: 0 }
  total.count += 1
  if (entry.cacheHit) total.cacheHits += 1
  total.totalMs += entry.ms
  total.maxMs = Math.max(total.maxMs, entry.ms)
  debug.totals[entry.id] = total
  window.__ffIndicatorV2Perf = debug
}

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
  const plan = planCompositeIndicatorDependenciesV2(options.requests ?? options.runtime?.list())
  const requests = resolveRequests(registry, plan.computeRequests)
  let computedIndicators: StoreV6HistoryPageWindowIndicators = {}
  let computedIndicatorsByKey: StoreV6HistoryPageWindowIndicators = {}
  let visibleIndicators: StoreV6HistoryPageWindowIndicators = {}
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
    const start = performance.now()
    const dependencyIdentity = createComputedDependencyIdentityV2(computedIndicatorsByKey)
    const definitionIdentity = getIndicatorDefinitionCacheIdentityV2(definition)
    const rowsIdentity = [
      createIndicatorRowsIdentityV2(options.warmupRows),
      createIndicatorRowsIdentityV2(options.calculationRows),
      createIndicatorRowsIdentityV2(options.displayRows),
    ].join('|')
    const cacheKey = createHistoryIndicatorComputeCacheKeyV2({
      dependencyIdentity,
      definitionIdentity,
      request,
      source: options,
    })
    const cached = readIndicatorComputeCacheV2(cacheKey)
    const calculated = cached ?? attachIndicatorMetadata(await definition.calculateHistory({
      boundary: options.boundary,
      calculationRows: options.calculationRows,
      calculationMode,
      computedDependencies: computedIndicators,
      computedDependenciesByKey: computedIndicatorsByKey,
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
    }), definition, request)
    if (!cached) writeIndicatorComputeCacheV2(cacheKey, calculated)
    publishIndicatorPerfV2({
      at: Date.now(),
      cacheHit: cached != null,
      cacheMissReason: cached ? undefined : 'key-not-found',
      computeKey: createStoreV6IndicatorComputeKeyV2(request),
      definitionIdentity,
      dependencyIdentity,
      displayRows: options.displayRows.length,
      id: request.id,
      ms: Number((performance.now() - start).toFixed(3)),
      outputIds: Object.keys(calculated),
      requestedVisible: plan.visibleRequestKeys.has(createStoreV6IndicatorComputeKeyV2(request)) || request.visible !== false,
      rowsIdentity,
      source: 'history',
      warmupRows: options.warmupRows.length,
      windowRows: options.calculationRows.length,
    })
    computedIndicators = mergeIndicators(computedIndicators, calculated)
    const calculatedSeries = Object.values(calculated)[0]
    if (calculatedSeries) {
      computedIndicatorsByKey = mergeIndicators(computedIndicatorsByKey, {
        [createStoreV6IndicatorComputeKeyV2(request)]: calculatedSeries,
      })
    }
    if (plan.visibleRequestKeys.has(createStoreV6IndicatorComputeKeyV2(request)) || request.visible !== false) {
      visibleIndicators = mergeIndicators(visibleIndicators, calculated)
    }
  }
  return visibleIndicators
}

export async function requestRealtimeWindowIndicatorsV2(
  options: RequestRealtimeWindowIndicatorsV2Options,
): Promise<StoreV6HistoryPageWindowIndicators> {
  const registry = options.registry ?? storeV6IndicatorRegistryV2
  const plan = planCompositeIndicatorDependenciesV2(options.requests ?? options.runtime?.list())
  const requests = resolveRequests(registry, plan.computeRequests)
  let computedIndicators: StoreV6HistoryPageWindowIndicators = {}
  let computedIndicatorsByKey: StoreV6HistoryPageWindowIndicators = {}
  let visibleIndicators: StoreV6HistoryPageWindowIndicators = {}
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
    const start = performance.now()
    const dependencyIdentity = createComputedDependencyIdentityV2(computedIndicatorsByKey)
    const definitionIdentity = getIndicatorDefinitionCacheIdentityV2(definition)
    const rowsIdentity = [
      createIndicatorRowsIdentityV2(historyRows),
      createIndicatorRowsIdentityV2(options.activeRows),
    ].join('|')
    const cacheKey = createRealtimeIndicatorComputeCacheKeyV2({
      dependencyIdentity,
      definitionIdentity,
      request,
      source: options,
    })
    const cached = readIndicatorComputeCacheV2(cacheKey)
    const calculated = cached ?? attachIndicatorMetadata(await definition.calculateRealtime({
      activeRows: options.activeRows,
      calculationMode,
      computedDependencies: computedIndicators,
      computedDependenciesByKey: computedIndicatorsByKey,
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
    }), definition, request)
    if (!cached) writeIndicatorComputeCacheV2(cacheKey, calculated)
    publishIndicatorPerfV2({
      at: Date.now(),
      cacheHit: cached != null,
      cacheMissReason: cached ? undefined : 'key-not-found',
      computeKey: createStoreV6IndicatorComputeKeyV2(request),
      definitionIdentity,
      dependencyIdentity,
      historyRows: historyRows.length,
      id: request.id,
      ms: Number((performance.now() - start).toFixed(3)),
      outputIds: Object.keys(calculated),
      realtimeRows: options.activeRows.length,
      requestedVisible: plan.visibleRequestKeys.has(createStoreV6IndicatorComputeKeyV2(request)) || request.visible !== false,
      rowsIdentity,
      source: 'realtime',
      warmupRows: historyRows.length,
      windowRows: historyRows.length + options.activeRows.length,
    })
    computedIndicators = mergeIndicators(computedIndicators, calculated)
    const calculatedSeries = Object.values(calculated)[0]
    if (calculatedSeries) {
      computedIndicatorsByKey = mergeIndicators(computedIndicatorsByKey, {
        [createStoreV6IndicatorComputeKeyV2(request)]: calculatedSeries,
      })
    }
    if (plan.visibleRequestKeys.has(createStoreV6IndicatorComputeKeyV2(request)) || request.visible !== false) {
      visibleIndicators = mergeIndicators(visibleIndicators, calculated)
    }
  }
  return visibleIndicators
}
