import type { KLineData } from 'klinecharts'

export const initialLoadLimit = 3_000
export const maxInitialLoadLimit = 20_000
export const historyPageSize = 3_000
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
      rowsByTimestamp.set(timestamp, { ...row, timestamp })
    })
  })
  return [...rowsByTimestamp.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}
