import type { KLineData } from 'klinecharts'
import { readRealtimePageBuffer } from '../chartRealtimeBridge'
import { readRealtimeStableWindowSnapshotV2 } from './realtimePageWindowBuilder'

export type RealtimePageMonitorSnapshotV2 = {
  rangeTimeFrom: number | null
  rangeTimeTo: number | null
  rows: number
  sessionTimeFrom: number | null
  tailTime: number | null
}

function normalizeTimestampSeconds(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
}

export function splitRealtimeMonitorRowsV2(rows: KLineData[]) {
  const sorted = rows
    .map((row) => ({ row, time: normalizeTimestampSeconds(row.timestamp) }))
    .filter((item): item is { row: KLineData; time: number } => item.time != null)
    .sort((left, right) => left.time - right.time)
  const tail = sorted[sorted.length - 1] ?? null
  const stable = tail ? sorted.slice(0, -1) : sorted
  return {
    stableRows: stable.map((item) => item.row),
    tailRow: tail?.row ?? null,
    stableTimes: stable.map((item) => item.time),
    tailTime: tail?.time ?? null,
  }
}

export function buildRealtimePageMonitorSnapshotV2(options: {
  rowsAreStable?: boolean
  rows: KLineData[]
  sessionTimeFrom: number | null | undefined
  tailTime?: number | null
}): RealtimePageMonitorSnapshotV2 {
  const sessionTimeFrom = normalizeTimestampSeconds(options.sessionTimeFrom)
  const split = splitRealtimeMonitorRowsV2(options.rows)
  const stableTimes = options.rowsAreStable
    ? options.rows
      .map((row) => normalizeTimestampSeconds(row.timestamp))
      .filter((time): time is number => time != null)
      .sort((left, right) => left - right)
    : split.stableTimes
  const stableTimesInSession = sessionTimeFrom == null
    ? stableTimes
    : stableTimes.filter((time) => time >= sessionTimeFrom)
  return {
    rangeTimeFrom: sessionTimeFrom,
    rangeTimeTo: stableTimesInSession[stableTimesInSession.length - 1] ?? null,
    rows: stableTimesInSession.length,
    sessionTimeFrom,
    tailTime: normalizeTimestampSeconds(options.tailTime) ?? split.tailTime,
  }
}

export function readRealtimePageMonitorSnapshotV2(options: {
  period: string
  sessionTimeFrom: number | null | undefined
  sessionTimeTo?: number | null
  symbol: string
}) {
  const sessionTimeFrom = normalizeTimestampSeconds(options.sessionTimeFrom)
  const stableSnapshot = readRealtimeStableWindowSnapshotV2({
    period: options.period,
    sessionTimeFrom,
    sessionTimeTo: options.sessionTimeTo ?? null,
    symbol: options.symbol,
  })
  if (stableSnapshot) {
    return buildRealtimePageMonitorSnapshotV2({
      rowsAreStable: true,
      rows: stableSnapshot.stableRows as KLineData[],
      sessionTimeFrom: stableSnapshot.sessionTimeFrom,
      tailTime: stableSnapshot.tailRow?.time ?? null,
    })
  }
  return buildRealtimePageMonitorSnapshotV2({
    rows: readRealtimePageBuffer(options.symbol, options.period),
    sessionTimeFrom,
  })
}
