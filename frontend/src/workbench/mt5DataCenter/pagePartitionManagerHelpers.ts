import type { StoreV6PagePartition, StoreV6PagePartitionItem } from '../chart/pagePartition/pagePartitionBuilder'
import type { M5AnchorRuntimeCacheMetaV2 } from '../chart/pagePartition/m5AnchorRuntimeContextV2'
import {
  storeV6HistoryPageSize,
  storeV6LivePageSize,
  type StoreV6PagePartitionMode,
} from '../chart/pagePartition/pagePartitionBuilder'
import { readRealtimePageBuffer } from '../chart/realtimePageBuffer'
import { readJson, readString, writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { queryStoreV6IndexTimes, queryStoreV6Ohlcv } from '../../services/mt5/mt5SymbolsApi'
import type { StoreV6CheckPayload, StoreV6DailyMaintenanceEvent } from '../../services/mt5/mt5SymbolsApi'

export type RealtimePageRow = StoreV6PagePartitionItem

export type PersistedPageIndex = {
  builtAt: string
  livePageSize: number
  pageSize: number
  pages: RealtimePageRow[]
  partitionKind?: 'rows' | 'time'
  partitionMode?: StoreV6PagePartitionMode
  period: string
  profileVersion?: number
  m5AnchorMeta?: M5AnchorRuntimeCacheMetaV2 | null
  symbol: string
  totalRows: number | null
}

export type PersistedPageResetInfo = {
  period: string
  reason: 'auto' | 'manual' | 'daily-close'
  resetAt: string
  rows: number
  symbol: string
}

export type UpdateSummary = {
  text: string
  timestamp: number
}

type MaintenanceRunSummary = {
  completed: StoreV6DailyMaintenanceEvent
  resultsCount?: unknown
  rowsWritten?: unknown
  timestamp: number
  trigger: string
}

export const historicalPageSize = storeV6HistoryPageSize
export const realtimePageSize = storeV6LivePageSize
export const defaultPageTableHeight = 220
export const minPageTableHeight = 120
export const maxPageTableHeight = 520

export function formatPageDateTime(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(seconds * 1000))
}

export function formatPageDateTimeWithWeekday(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '-'
  return formatPageTradingDateTime(seconds)
}

export function formatPageTradingDateTime(seconds: number, suffix = '') {
  const date = new Date(seconds * 1000)
  const shanghaiSeconds = seconds + 8 * 60 * 60
  const localSecondsInDay = ((shanghaiSeconds % 86_400) + 86_400) % 86_400
  const weekdaySeconds = localSecondsInDay < 6 * 60 * 60 ? seconds - 86_400 : seconds
  const weekday = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
  }).format(new Date(weekdaySeconds * 1000))
  const dateTime = new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(date)
  return `${weekday}${suffix} ${dateTime}`
}

export function formatPageRows(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '-'
}

function formatPageGlobalIndex(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `#${value.toLocaleString('en-US')}` : '-'
}

function formatResetTime(value: string | null | undefined) {
  if (!value) return ''
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

export function hasPageRangeTime(page: RealtimePageRow) {
  return typeof page.timeFrom === 'number' && typeof page.timeTo === 'number'
}

export function isTimePartitionPage(page: RealtimePageRow | null | undefined) {
  return Boolean(
    page &&
    typeof page.timeFrom === 'number' &&
    typeof page.timeTo === 'number' &&
    page.fromGlobalIndex == null &&
    page.toGlobalIndex == null,
  )
}

export function resolvePartitionKind(pages: RealtimePageRow[] | null | undefined) {
  return isTimePartitionPage(pages?.[0]) ? 'time' : 'rows'
}

export function resolvePartitionCacheKind(partition: Pick<StoreV6PagePartition, 'partitionMode'>) {
  return partition.partitionMode === 'm5-time' || partition.partitionMode === 'm30-time' ? 'time' : 'rows'
}

export function formatPageRange(page: RealtimePageRow) {
  if (typeof page.timeFrom === 'number' && typeof page.timeTo === 'number') {
    return `${formatPageTradingDateTime(page.timeFrom, '开盘')} ~ ${formatPageTradingDateTime(page.timeTo, '停盘')}`
  }
  if (typeof page.timeFrom === 'number' || typeof page.timeTo === 'number') {
    return `${formatPageDateTimeWithWeekday(page.timeFrom)} ~ ${formatPageDateTimeWithWeekday(page.timeTo)}`
  }
  return `${formatPageGlobalIndex(page.fromGlobalIndex)} ~ ${page.realtime ? '当前' : formatPageGlobalIndex(page.toGlobalIndex)}`
}

export function parseRowsCount(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value ?? '').replace(/[^\d]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function formatResetInfoSummary(info: PersistedPageResetInfo | null): UpdateSummary | null {
  if (!info) return null
  const timestamp = Date.parse(info.resetAt)
  if (!Number.isFinite(timestamp)) return null
  return {
    text: `上次重置更新：${formatResetTime(info.resetAt)}，${info.reason === 'auto' ? '自动整理' : '手动更新'}，实时页 ${formatPageRows(info.rows)} 根`,
    timestamp,
  }
}

export function formatMaintenanceSummary(events: StoreV6DailyMaintenanceEvent[]): UpdateSummary | null {
  const byRunId = new Map<string, StoreV6DailyMaintenanceEvent[]>()
  events.forEach((event) => {
    const runId = typeof event.runId === 'string' && event.runId ? event.runId : ''
    if (!runId) return
    byRunId.set(runId, [...(byRunId.get(runId) ?? []), event])
  })
  const runs: MaintenanceRunSummary[] = []
  byRunId.forEach((items) => {
    const completed = [...items].reverse().find((item) => item.step === 'page_plan_rebuild_requested' || item.step === 'audit_completed' || item.status === 'completed')
    if (!completed?.createdAt) return
    const rowsWritten = items.find((item) => typeof item.rowsWritten === 'number')?.rowsWritten
    const resultsCount = items.find((item) => typeof item.resultsCount === 'number')?.resultsCount
    const trigger = String(completed.trigger ?? items[0]?.trigger ?? '')
    const timestamp = Date.parse(completed.createdAt)
    if (!Number.isFinite(timestamp)) return
    runs.push({ completed, resultsCount, rowsWritten, timestamp, trigger })
  })
  runs.sort((left, right) => right.timestamp - left.timestamp)
  const latest = runs[0]
  if (!latest) return null
  const kind = latest.trigger === 'manual' ? '手动更新' : '自动拉取、聚合、更新'
  const rows = typeof latest.rowsWritten === 'number' ? `，拉取 ${formatPageRows(latest.rowsWritten)} 根` : ''
  const aggregate = typeof latest.resultsCount === 'number' ? `，聚合 ${formatPageRows(latest.resultsCount)} 项` : ''
  return {
    text: `上次重置更新：${formatResetTime(latest.completed.createdAt)}，${kind}${rows}${aggregate}`,
    timestamp: latest.timestamp,
  }
}

export function latestUpdateSummary(left: UpdateSummary | null, right: UpdateSummary | null) {
  if (!left) return right
  if (!right) return left
  return right.timestamp > left.timestamp ? right : left
}

export function resolveRowsFromStoreStatus(payload: StoreV6CheckPayload | null | undefined, period: string) {
  const normalizedPeriod = period.trim().toUpperCase()
  if (!payload || !normalizedPeriod) return null
  if (normalizedPeriod === 'M1') {
    return parseRowsCount(payload.directM1?.rowsCount ?? payload.rawDirectM1?.rowsCount)
  }
  const normalizedStorePeriod = normalizedPeriod === 'MN' ? 'MN1' : normalizedPeriod
  const aggregate = payload.aggregated.find((cell) => String(cell.timeframe || '').trim().toUpperCase() === normalizedStorePeriod)
  return parseRowsCount(aggregate?.rowsCount)
}

export function resolveLastTimeFromStoreStatus(payload: StoreV6CheckPayload | null | undefined, period: string) {
  const normalizedPeriod = period.trim().toUpperCase()
  if (!payload || !normalizedPeriod) return null
  if (normalizedPeriod === 'M1') {
    return typeof payload.directM1?.lastTime === 'number'
      ? payload.directM1.lastTime
      : typeof payload.rawDirectM1?.lastTime === 'number'
      ? payload.rawDirectM1.lastTime
      : null
  }
  const normalizedStorePeriod = normalizedPeriod === 'MN' ? 'MN1' : normalizedPeriod
  const aggregate = payload.aggregated.find((cell) => String(cell.timeframe || '').trim().toUpperCase() === normalizedStorePeriod)
  return typeof aggregate?.lastTime === 'number' ? aggregate.lastTime : null
}

export function pageCacheKey(symbol: string, period: string, partitionKind: 'rows' | 'time' = 'rows') {
  return `${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}:${partitionKind}`
}

export function readPageIndexCache() {
  return readJson<Record<string, PersistedPageIndex>>(storageKeys.realtimePageIndexCache, {})
}

export function writePageIndexCache(key: string, value: PersistedPageIndex) {
  writeJson(storageKeys.realtimePageIndexCache, {
    ...readPageIndexCache(),
    [key]: value,
  })
}

export function deletePageIndexCache(key: string) {
  const cache = readPageIndexCache()
  delete cache[key]
  writeJson(storageKeys.realtimePageIndexCache, cache)
}

export function readLastResetCache() {
  return readJson<Record<string, PersistedPageResetInfo>>(storageKeys.realtimePageLastResetCache, {})
}

export function writeLastResetCache(key: string, value: PersistedPageResetInfo) {
  writeJson(storageKeys.realtimePageLastResetCache, {
    ...readLastResetCache(),
    [key]: value,
  })
}

export function readPageTableHeight() {
  const parsed = Number(readString(storageKeys.realtimePageTableHeightPx))
  return Number.isFinite(parsed)
    ? Math.max(minPageTableHeight, Math.min(Math.round(parsed), maxPageTableHeight))
    : defaultPageTableHeight
}

export function isCurrentCache(
  value: PersistedPageIndex | undefined,
  expectedPartition: Pick<StoreV6PagePartition, 'partitionMode' | 'profileVersion'>,
) {
  if (value?.pageSize !== historicalPageSize || value.livePageSize !== realtimePageSize) return false
  const actualMode = value.partitionMode ?? 'rows'
  if (actualMode !== expectedPartition.partitionMode) return false
  if (value.profileVersion !== expectedPartition.profileVersion) return false
  const expectedKind = resolvePartitionCacheKind(expectedPartition)
  const actualKind = value.partitionKind ?? resolvePartitionKind(value.pages)
  const actualPageKind = expectedKind === 'time' && (value.partitionMode === 'm5-time' || value.partitionMode === 'm30-time')
    ? 'time'
    : resolvePartitionKind(value.pages)
  return actualKind === expectedKind && actualKind === actualPageKind
}

export function readRolloverDetail(event: Event) {
  const detail = (event as CustomEvent<{
    period?: string
    rows?: number
    symbol?: string
    thresholdRows?: number
  }>).detail
  if (!detail || typeof detail !== 'object') return null
  return detail
}

export function readRealtimeBufferDetail(event: Event) {
  const detail = (event as CustomEvent<{
    period?: string
    rows?: number
    symbol?: string
    timeFrom?: number | null
    timeTo?: number | null
  }>).detail
  if (!detail || typeof detail !== 'object') return null
  return detail
}

export function applyLiveRowsFromBuffer(pages: RealtimePageRow[], options: {
  period: string
  symbol: string
}) {
  const buffer = readRealtimePageBuffer(options.symbol, options.period)
  if (!buffer.length) return pages
  const first = buffer[0]
  const last = buffer[buffer.length - 1]
  return pages.map((page) => {
    if (!page.realtime || page.index !== 1) return page
    if (page.fromGlobalIndex == null && page.toGlobalIndex == null && hasPageRangeTime(page)) return page
    return {
      ...page,
      rows: buffer.length,
      timeFrom: typeof first?.timestamp === 'number' ? Math.floor(first.timestamp / 1000) : page.timeFrom,
      timeTo: typeof last?.timestamp === 'number' ? Math.floor(last.timestamp / 1000) : page.timeTo,
    }
  })
}

function normalizeTimeframeForStore(period: string) {
  const value = period.trim().toUpperCase()
  return value === 'MN' ? 'MN1' : value
}

async function queryPageBoundaryTimes(options: {
  pages: RealtimePageRow[]
  period: string
  symbol: string
}) {
  const timeframe = normalizeTimeframeForStore(options.period)
  const isM1 = timeframe === 'M1'
  const indices = [
    ...new Set(options.pages.flatMap((page) => [
      typeof page.fromGlobalIndex === 'number' ? page.fromGlobalIndex : null,
      typeof page.toGlobalIndex === 'number' ? page.toGlobalIndex : null,
    ]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))),
  ]
  if (!indices.length) return new Map<number, number>()
  const timesByIndex = new Map<number, number>()
  const batchSize = 500
  try {
    for (let start = 0; start < indices.length; start += batchSize) {
      const payload = await queryStoreV6IndexTimes({
        indices: indices.slice(start, start + batchSize),
        mode: isM1 ? 'direct' : 'aggregated',
        symbol: options.symbol,
        timeframe,
      })
      payload.rows.forEach((row) => {
        if (Number.isFinite(row.globalIndex) && Number.isFinite(row.time)) {
          timesByIndex.set(Math.round(row.globalIndex), Math.round(row.time))
        }
      })
    }
    return timesByIndex
  } catch {
    return new Map<number, number>()
  }
}

export async function enrichPageTimeRanges(options: {
  pages: RealtimePageRow[]
  period: string
  symbol: string
}) {
  const timesByIndex = await queryPageBoundaryTimes(options)
  return options.pages.map((page) => ({
    ...page,
    timeFrom: typeof page.fromGlobalIndex === 'number' ? timesByIndex.get(page.fromGlobalIndex) ?? null : null,
    timeTo: typeof page.toGlobalIndex === 'number' ? timesByIndex.get(page.toGlobalIndex) ?? null : null,
  }))
}

export async function materializeTimePageIndexRanges(options: {
  pages: RealtimePageRow[]
  period: string
  symbol: string
}) {
  const timeframe = normalizeTimeframeForStore(options.period)
  const isM1 = timeframe === 'M1'
  const materializePage = async (page: RealtimePageRow): Promise<RealtimePageRow> => {
    if (typeof page.timeFrom !== 'number' || typeof page.timeTo !== 'number') {
      return page
    }
    try {
      const payload = await queryStoreV6Ohlcv({
        anchor: isM1 ? undefined : 'UTC2200',
        baseTimeframe: isM1 ? undefined : 'M1',
        mode: isM1 ? 'direct' : 'aggregated',
        symbol: options.symbol,
        timeframe,
        timeFrom: page.timeFrom,
        timeTo: page.timeTo,
      })
      const fromGlobalIndex = typeof payload.metadata?.indexFromResult === 'number'
        ? Math.round(payload.metadata.indexFromResult)
        : null
      const toGlobalIndex = typeof payload.metadata?.indexToResult === 'number'
        ? Math.round(payload.metadata.indexToResult)
        : null
      const rows = typeof payload.rowsCount === 'number' && Number.isFinite(payload.rowsCount)
        ? payload.rowsCount
        : fromGlobalIndex != null && toGlobalIndex != null
        ? Math.max(0, toGlobalIndex - fromGlobalIndex + 1)
        : 0
      return {
        ...page,
        fromGlobalIndex,
        limit: Math.max(1, rows || page.limit),
        rows,
        timeFrom: typeof payload.metadata?.timeFromResult === 'number' ? payload.metadata.timeFromResult : page.timeFrom,
        timeTo: typeof payload.metadata?.timeToResult === 'number' ? payload.metadata.timeToResult : page.timeTo,
        toGlobalIndex,
      }
    } catch {
      return {
        ...page,
        rows: 0,
      }
    }
  }
  const concurrency = 8
  const materialized: RealtimePageRow[] = new Array(options.pages.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, options.pages.length) }, async () => {
    while (nextIndex < options.pages.length) {
      const index = nextIndex
      nextIndex += 1
      materialized[index] = await materializePage(options.pages[index])
    }
  })
  await Promise.all(workers)
  return materialized
}
