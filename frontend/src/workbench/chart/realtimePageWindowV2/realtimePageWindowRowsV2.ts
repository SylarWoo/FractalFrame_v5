import type { StoreV6WindowKLine } from '../pageSliceV2'

const maxCachedRealtimeRows = 10_000

export function mergeRealtimeRowsV2(rows: StoreV6WindowKLine[], next: StoreV6WindowKLine[]) {
  const byTime = new Map<number, StoreV6WindowKLine>()
  rows.forEach((row) => {
    if (Number.isFinite(row.time)) byTime.set(Number(row.time), row)
  })
  next.forEach((row) => {
    if (Number.isFinite(row.time)) byTime.set(Number(row.time), row)
  })
  return [...byTime.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}

export function splitRealtimeRowsV2(rows: StoreV6WindowKLine[]) {
  const normalized = mergeRealtimeRowsV2([], rows).slice(-maxCachedRealtimeRows)
  const tailRow = normalized[normalized.length - 1] ?? null
  const stableRows = tailRow ? normalized.slice(0, -1) : normalized
  return { stableRows, tailRow }
}

export function combineRealtimeRowsV2(stableRows: StoreV6WindowKLine[], tailRow: StoreV6WindowKLine | null) {
  return tailRow ? [...stableRows, tailRow] : stableRows
}

export function stableRowsKeyV2(rows: StoreV6WindowKLine[]) {
  if (!rows.length) return 'stable-empty'
  return `stable:${rows[0]?.time ?? 'none'}:${rows[rows.length - 1]?.time ?? 'none'}:${rows.length}`
}

export function tailRowKeyV2(row: StoreV6WindowKLine | null) {
  if (!row) return 'tail-empty'
  return `tail:${row.time}:${row.open}:${row.high}:${row.low}:${row.close}:${row.volume ?? 0}`
}
