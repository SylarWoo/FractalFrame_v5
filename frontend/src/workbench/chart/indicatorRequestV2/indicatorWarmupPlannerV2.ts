import type {
  StoreV6IndicatorDefinitionV2,
  StoreV6IndicatorRequestSpecV2,
  StoreV6IndicatorWarmupModeV2,
  StoreV6IndicatorWarmupPlanV2,
  StoreV6IndicatorWindowKindV2,
} from './indicatorRequestTypes'

function finiteRows(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0
}

function resolveRows<Params>(
  value: number | ((request: StoreV6IndicatorRequestSpecV2<Params>) => number) | null | undefined,
  request: StoreV6IndicatorRequestSpecV2<Params>,
) {
  return finiteRows(typeof value === 'function' ? value(request) : value)
}

function resolveWarmupMode<Params>(
  definition: StoreV6IndicatorDefinitionV2<Params>,
): StoreV6IndicatorWarmupModeV2 {
  if (definition.warmup?.mode) return definition.warmup.mode
  if (definition.warmupRows != null) return 'fixedRows'
  return 'none'
}

export function planIndicatorWarmupV2<Params>(options: {
  availableRows: number
  definition: StoreV6IndicatorDefinitionV2<Params>
  request: StoreV6IndicatorRequestSpecV2<Params>
  windowKind: StoreV6IndicatorWindowKindV2
}): StoreV6IndicatorWarmupPlanV2 {
  const { definition, request, windowKind } = options
  const mode = resolveWarmupMode(definition)
  const explicitRows = windowKind === 'history'
    ? definition.warmup?.historyRows
    : definition.warmup?.realtimeRows
  const legacyRows = definition.warmupRows
  const requiredRows = mode === 'none' || mode === 'currentWindowOnly'
    ? 0
    : resolveRows(explicitRows ?? legacyRows, request)
  const availableRows = finiteRows(options.availableRows)
  return {
    availableRows,
    missingRows: Math.max(0, requiredRows - availableRows),
    mode,
    requiredRows,
    windowKind,
  }
}

export function maxIndicatorWarmupRowsV2<Params>(options: {
  definitions: Array<{ definition: StoreV6IndicatorDefinitionV2<Params>; request: StoreV6IndicatorRequestSpecV2<Params> }>
  windowKind: StoreV6IndicatorWindowKindV2
}) {
  return options.definitions.reduce((maxRows, entry) => {
    const plan = planIndicatorWarmupV2({
      availableRows: 0,
      definition: entry.definition,
      request: entry.request,
      windowKind: options.windowKind,
    })
    return Math.max(maxRows, plan.requiredRows)
  }, 0)
}
