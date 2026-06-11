import { formatCount, formatEpochSeconds, normalizePeriodForUi, resolveLocalM1LastTime, resolveLocalM1Rows } from '../mt5DataCenter/storeV6StatusFormat'
import type { StoreTableRow } from '../mt5DataCenter/storeV6StatusFormat'
import type { Mt5SymbolRow, StoreV6CheckPayload } from '../../services/mt5/mt5SymbolsApi'

export const storeTableAggregatePeriods = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'D1', 'W1', 'MN']

const fixedPeriodSeconds: Record<string, number> = {
  M5: 5 * 60,
  M15: 15 * 60,
  M30: 30 * 60,
  H1: 60 * 60,
  H2: 2 * 60 * 60,
  H4: 4 * 60 * 60,
  D1: 24 * 60 * 60,
}

function aggregateBucketStart(openTime: number, period: string) {
  if (period === 'W1' || period === 'MN') return null
  const seconds = fixedPeriodSeconds[period]
  if (!seconds) return null
  const utc2200Offset = 22 * 60 * 60
  return Math.floor((openTime - utc2200Offset) / seconds) * seconds + utc2200Offset
}

export function resolveStoreV6AggregateTargets(status: StoreV6CheckPayload) {
  const cleanLastTime = status.directM1?.lastTime ?? null
  const cellsByPeriod = new Map(
    status.aggregated
      .filter((cell) => typeof cell.timeframe === 'string')
      .map((cell) => [normalizePeriodForUi(String(cell.timeframe)), cell]),
  )
  return storeTableAggregatePeriods.filter((period) => {
    const cell = cellsByPeriod.get(period)
    if (!cell) return true
    if (cell.dirty) return true
    const rowsCount = cell.rowsCount
    if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return true
    if (typeof cleanLastTime === 'number' && Number.isFinite(cleanLastTime)) {
      const sourceLastTime = cell.sourceLastTime
      if (typeof sourceLastTime !== 'number' || !Number.isFinite(sourceLastTime)) return true
      const expectedLastBucket = aggregateBucketStart(cleanLastTime, period)
      const lastTime = cell.lastTime
      if (
        expectedLastBucket != null
        && (typeof lastTime !== 'number' || !Number.isFinite(lastTime) || lastTime < expectedLastBucket)
      ) {
        return true
      }
      return sourceLastTime < cleanLastTime
    }
    return false
  })
}

export function buildVisibleStoreAggregateRows(localStoreStatus: StoreV6CheckPayload | null) {
  const cellsByPeriod = new Map(
    (localStoreStatus?.aggregated ?? [])
      .filter((cell) => typeof cell.timeframe === 'string')
      .map((cell) => [normalizePeriodForUi(String(cell.timeframe)), cell]),
  )
  return storeTableAggregatePeriods.map((period) => {
    const cell = cellsByPeriod.get(period)
    return {
      period,
      count: formatCount(cell?.rowsCount),
      updated: cell ? formatEpochSeconds(cell.lastTime) : '未聚合',
      rowsCount: cell?.rowsCount ?? null,
    }
  })
}

export function buildVisibleStoreTableRows(options: {
  localStoreStatus: StoreV6CheckPayload | null
  selectedRow: Mt5SymbolRow | null
}): StoreTableRow[] {
  const rows: StoreTableRow[] = []
  const rowsCount = resolveLocalM1Rows(options.localStoreStatus)
  if (options.selectedRow?.symbol && typeof rowsCount === 'number' && Number.isFinite(rowsCount) && rowsCount > 0) {
    rows.push({
      period: 'M1',
      count: formatCount(rowsCount),
      updated: formatEpochSeconds(resolveLocalM1LastTime(options.localStoreStatus)),
      kind: 'm1',
      rowsCount,
    })
  }
  return [
    ...rows,
    ...buildVisibleStoreAggregateRows(options.localStoreStatus).map((row) => ({
      ...row,
      kind: 'aggregate' as const,
      rowsCount: row.rowsCount,
    })),
  ]
}

export function buildWatchlistDirectPeriods(localStoreStatus: StoreV6CheckPayload | null): StoreTableRow[] {
  const rowsCount = resolveLocalM1Rows(localStoreStatus)
  if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return []
  return [{
    period: 'M1',
    count: formatCount(rowsCount),
    updated: formatEpochSeconds(resolveLocalM1LastTime(localStoreStatus)),
    kind: 'm1',
    rowsCount,
  }]
}

export function buildWatchlistAggregatedPeriods(localStoreStatus: StoreV6CheckPayload | null): StoreTableRow[] {
  const cellsByPeriod = new Map(
    (localStoreStatus?.aggregated ?? [])
      .filter((cell) => typeof cell.timeframe === 'string')
      .map((cell) => [normalizePeriodForUi(String(cell.timeframe)), cell]),
  )
  return storeTableAggregatePeriods.flatMap((period) => {
    const cell = cellsByPeriod.get(period)
    const rowsCount = cell?.rowsCount
    if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return []
    return [{
      period,
      count: formatCount(rowsCount),
      updated: formatEpochSeconds(cell?.lastTime),
      kind: 'aggregate' as const,
      rowsCount,
    }]
  })
}
