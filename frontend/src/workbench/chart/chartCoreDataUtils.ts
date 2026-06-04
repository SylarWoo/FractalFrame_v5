import type { KLineData } from 'klinecharts'
import { storeV6HistoryPageSize, storeV6LivePageSize } from './pagePartition/pagePartitionBuilder'

export const initialLoadLimit = storeV6LivePageSize
export const maxInitialLoadLimit = storeV6HistoryPageSize
export const historyPageSize = storeV6HistoryPageSize
export const jumpWindowBars = 50_000
export const jumpDisplayWindowBars = 2_400
export const jumpBarSpace = 6
export const realtimeTailRepairLookbackMinutes = 30
export const realtimeTailRepairMaxGapMinutes = 30

export function resolveInitialLimit(limit?: number) {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return initialLoadLimit
  }
  return Math.max(1, Math.min(Math.round(limit), maxInitialLoadLimit))
}

export function resolveHasMoreOlder(options: {
  loadedRows: number
  pageSize: number
  receivedRows: number
  totalRows?: number | null
}) {
  if (options.receivedRows < options.pageSize) return false
  if (typeof options.totalRows === 'number' && Number.isFinite(options.totalRows)) {
    return options.loadedRows < options.totalRows
  }
  return true
}

export function mergeKLineData(...sets: KLineData[][]): KLineData[] {
  const rowsByTimestamp = new Map<number, KLineData>()
  sets.forEach((rows) => {
    rows.forEach((row) => {
      const timestamp = Number(row.timestamp)
      if (!Number.isFinite(timestamp)) return
      const existing = rowsByTimestamp.get(timestamp) as (KLineData & Record<string, unknown>) | undefined
      const next = { ...row, timestamp } as KLineData & Record<string, unknown>
      rowsByTimestamp.set(timestamp, {
        ...(existing ?? {}),
        ...next,
        barKey: next.barKey ?? existing?.barKey,
        globalIndex: next.globalIndex ?? existing?.globalIndex,
        identityStatus: next.identityStatus ?? existing?.identityStatus,
        isClosed: next.isClosed ?? existing?.isClosed,
        isRealtime: next.isRealtime ?? existing?.isRealtime,
        period: next.period ?? existing?.period,
        sessionId: next.sessionId ?? existing?.sessionId,
        source: next.source ?? existing?.source,
        symbol: next.symbol ?? existing?.symbol,
        time: next.time ?? existing?.time,
        tradingDay: next.tradingDay ?? existing?.tradingDay,
      } as KLineData)
    })
  })
  return [...rowsByTimestamp.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}
