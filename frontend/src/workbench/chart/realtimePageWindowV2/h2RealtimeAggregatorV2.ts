import type { StoreV6QueryRow } from '../../../services/mt5/mt5SymbolsApi'
import type { StoreV6WindowKLine } from '../pageSliceV2'

const h2Seconds = 2 * 60 * 60
const m30Seconds = 30 * 60
const utc2200OffsetSeconds = 22 * 60 * 60

function finiteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function h2BucketStartSeconds(time: number) {
  return Math.floor((Math.floor(time) - utc2200OffsetSeconds) / h2Seconds) * h2Seconds + utc2200OffsetSeconds
}

function createH2BarKey(symbol: string, time: number) {
  return `${symbol.trim()}|H2|${Math.floor(time)}`
}

function estimateTurnover(high: number, low: number, close: number, volume: number) {
  const typicalPrice = Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
    ? (high + low + close) / 3
    : close
  return Number.isFinite(typicalPrice) && Number.isFinite(volume) ? typicalPrice * volume : 0
}

type H2BucketAccumulator = {
  close: number
  high: number
  low: number
  open: number
  sourceBars: number
  sourceFromOpenTime: number
  sourceToOpenTime: number
  time: number
  volume: number
}

export function aggregateM30RatesToH2RealtimeRowsV2(options: {
  rows: StoreV6QueryRow[] | null | undefined
  sessionTimeFrom: number
  sessionTimeTo: number | null
  symbol: string
}) {
  const buckets = new Map<number, H2BucketAccumulator>()
  ;(options.rows ?? [])
    .map((row) => {
      const time = finiteNumber(row.time ?? row.openTime ?? row.timestamp)
      const open = finiteNumber(row.open)
      const high = finiteNumber(row.high)
      const low = finiteNumber(row.low)
      const close = finiteNumber(row.close)
      const volume = finiteNumber(row.volume ?? 0)
      if (time == null || open == null || high == null || low == null || close == null || volume == null) return null
      return { close, high, low, open, time: Math.floor(time), volume: Math.max(0, volume) }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((left, right) => left.time - right.time)
    .forEach((row) => {
      const bucketTime = h2BucketStartSeconds(row.time)
      if (bucketTime < options.sessionTimeFrom) return
      if (options.sessionTimeTo != null && bucketTime > options.sessionTimeTo) return
      const existing = buckets.get(bucketTime)
      if (!existing) {
        buckets.set(bucketTime, {
          close: row.close,
          high: row.high,
          low: row.low,
          open: row.open,
          sourceBars: 1,
          sourceFromOpenTime: row.time,
          sourceToOpenTime: row.time,
          time: bucketTime,
          volume: row.volume,
        })
        return
      }
      existing.close = row.close
      existing.high = Math.max(existing.high, row.high)
      existing.low = Math.min(existing.low, row.low)
      existing.sourceBars += 1
      existing.sourceToOpenTime = row.time
      existing.volume += row.volume
    })

  return [...buckets.values()]
    .sort((left, right) => left.time - right.time)
    .map((bucket): StoreV6WindowKLine => ({
      barKey: createH2BarKey(options.symbol, bucket.time),
      close: bucket.close,
      globalIndex: null,
      high: bucket.high,
      low: bucket.low,
      open: bucket.open,
      period: 'H2',
      source: 'mt5-realtime-window-v2',
      sourceBars: bucket.sourceBars,
      sourceFromOpenTime: bucket.sourceFromOpenTime,
      sourceToOpenTime: bucket.sourceToOpenTime + m30Seconds,
      symbol: options.symbol,
      time: bucket.time,
      timestamp: bucket.time * 1000,
      turnover: estimateTurnover(bucket.high, bucket.low, bucket.close, bucket.volume),
      volume: bucket.volume,
    } as StoreV6WindowKLine))
}

export function resolveH2RealtimeRateVolumeForPeriodStartV2(
  rows: StoreV6QueryRow[] | null | undefined,
  periodStartSeconds: number,
) {
  const [row] = aggregateM30RatesToH2RealtimeRowsV2({
    rows,
    sessionTimeFrom: Math.floor(periodStartSeconds),
    sessionTimeTo: Math.floor(periodStartSeconds),
    symbol: '',
  })
  return typeof row?.volume === 'number' && Number.isFinite(row.volume) ? row.volume : null
}
