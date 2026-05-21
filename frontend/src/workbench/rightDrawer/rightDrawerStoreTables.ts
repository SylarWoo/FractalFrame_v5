import { formatCount, formatEpochSeconds, resolveLocalM1LastTime, resolveLocalM1Rows } from '../mt5DataCenter/storeV5StatusFormat'
import type { StoreTableRow } from '../mt5DataCenter/storeV5StatusFormat'
import type { Mt5SymbolRow, StoreV5CheckPayload } from '../../services/mt5/mt5SymbolsApi'

export const storeTableAggregatePeriods = ['M5', 'M15', 'M30', 'H1', 'H2', 'H3', 'H4', 'D1', 'W1', 'MN1']

export function resolveStoreV5AggregateTargets(status: StoreV5CheckPayload) {
  return status.aggregated
    .map((cell) => String(cell.timeframe || '').toUpperCase())
    .filter((period) => storeTableAggregatePeriods.includes(period))
}

export function buildVisibleStoreAggregateRows(localStoreStatus: StoreV5CheckPayload | null) {
  const cellsByPeriod = new Map(
    (localStoreStatus?.aggregated ?? [])
      .filter((cell) => typeof cell.timeframe === 'string')
      .map((cell) => [String(cell.timeframe).toUpperCase(), cell]),
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
  localStoreStatus: StoreV5CheckPayload | null
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

export function buildWatchlistDirectPeriods(localStoreStatus: StoreV5CheckPayload | null): StoreTableRow[] {
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

export function buildWatchlistAggregatedPeriods(localStoreStatus: StoreV5CheckPayload | null): StoreTableRow[] {
  const cellsByPeriod = new Map(
    (localStoreStatus?.aggregated ?? [])
      .filter((cell) => typeof cell.timeframe === 'string')
      .map((cell) => [String(cell.timeframe).toUpperCase(), cell]),
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
