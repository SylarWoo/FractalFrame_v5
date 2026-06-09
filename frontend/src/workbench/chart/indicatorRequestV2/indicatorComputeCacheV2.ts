import type { StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type {
  RequestHistoryWindowIndicatorsV2Options,
  RequestRealtimeWindowIndicatorsV2Options,
  StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestTypes'
import { createStoreV6IndicatorComputeKeyV2 } from './compositeIndicatorDependencyOrchestratorV2'

const maxCacheEntries = 600
const indicatorComputeCacheV2 = new Map<string, StoreV6HistoryPageWindowIndicators>()

function formatNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(6)) : ''
}

function rowToken(row: StoreV6WindowKLine | null | undefined) {
  if (!row) return 'none'
  return [
    row.barKey,
    row.globalIndex ?? '',
    row.time,
    formatNumber(row.open),
    formatNumber(row.high),
    formatNumber(row.low),
    formatNumber(row.close),
    formatNumber(row.volume),
  ].join(',')
}

export function createIndicatorRowsIdentityV2(rows: StoreV6WindowKLine[] | null | undefined) {
  if (!rows || rows.length === 0) return 'rows:0'
  const first = rows[0]
  const last = rows[rows.length - 1]
  return [
    `rows:${rows.length}`,
    rowToken(first),
    rowToken(last),
  ].join(':')
}

export function createComputedDependencyIdentityV2(indicators: StoreV6HistoryPageWindowIndicators) {
  const entries = Object.entries(indicators)
    .map(([key, series]) => `${key}:${series.key}`)
    .sort()
  return entries.length ? entries.join('|') : 'no-deps'
}

export function createHistoryIndicatorComputeCacheKeyV2(options: {
  dependencyIdentity: string
  definitionIdentity: string
  request: StoreV6IndicatorRequestSpecV2
  source: RequestHistoryWindowIndicatorsV2Options
}) {
  return [
    'history',
    options.source.symbol,
    options.source.period,
    options.source.pageIndex,
    options.source.boundary.actualFromGlobalIndex ?? '',
    options.source.boundary.actualToGlobalIndex ?? '',
    options.source.boundary.actualTimeFrom ?? '',
    options.source.boundary.actualTimeTo ?? '',
    options.source.displayOffset,
    createIndicatorRowsIdentityV2(options.source.warmupRows),
    createIndicatorRowsIdentityV2(options.source.calculationRows),
    createIndicatorRowsIdentityV2(options.source.displayRows),
    createStoreV6IndicatorComputeKeyV2(options.request),
    options.definitionIdentity,
    options.dependencyIdentity,
  ].join('::')
}

export function createRealtimeIndicatorComputeCacheKeyV2(options: {
  dependencyIdentity: string
  definitionIdentity: string
  request: StoreV6IndicatorRequestSpecV2
  source: RequestRealtimeWindowIndicatorsV2Options
}) {
  return [
    'realtime',
    options.source.symbol,
    options.source.period,
    options.source.sessionTimeFrom ?? '',
    options.source.sessionTimeTo ?? '',
    createIndicatorRowsIdentityV2(options.source.historyRows ?? []),
    createIndicatorRowsIdentityV2(options.source.activeRows),
    createStoreV6IndicatorComputeKeyV2(options.request),
    options.definitionIdentity,
    options.dependencyIdentity,
  ].join('::')
}

export function readIndicatorComputeCacheV2(key: string) {
  const cached = indicatorComputeCacheV2.get(key)
  if (!cached) return null
  indicatorComputeCacheV2.delete(key)
  indicatorComputeCacheV2.set(key, cached)
  return cached
}

export function writeIndicatorComputeCacheV2(key: string, value: StoreV6HistoryPageWindowIndicators) {
  indicatorComputeCacheV2.set(key, value)
  if (indicatorComputeCacheV2.size <= maxCacheEntries) return
  const firstKey = indicatorComputeCacheV2.keys().next().value
  if (firstKey) indicatorComputeCacheV2.delete(firstKey)
}

export function clearIndicatorComputeCacheV2() {
  indicatorComputeCacheV2.clear()
}
