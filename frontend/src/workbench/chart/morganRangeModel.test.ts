import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { collectH4MorganCandles, resolveH4MorganBucketKey } from './morganRangeModel'

const utc = (value: string) => Date.parse(value)

function row(timestamp: number, price: number): KLineData {
  return { timestamp, open: price, high: price + 1, low: price - 1, close: price }
}

describe('morganRangeModel', () => {
  it('starts a new H4 bucket at 10:00 Asia/Shanghai when the session anchor is 06:00', () => {
    const before = utc('2026-05-25T01:55:00.000Z')
    const boundary = utc('2026-05-25T02:00:00.000Z')
    const after = utc('2026-05-25T02:15:00.000Z')

    expect(resolveH4MorganBucketKey(boundary)).toBe(resolveH4MorganBucketKey(before) + 1)
    expect(resolveH4MorganBucketKey(after)).toBe(resolveH4MorganBucketKey(boundary))
  })

  it('groups M5 rows after 10:00 Asia/Shanghai into the new H4 bucket', () => {
    const candles = collectH4MorganCandles([
      row(utc('2026-05-25T01:55:00.000Z'), 100),
      row(utc('2026-05-25T02:00:00.000Z'), 101),
      row(utc('2026-05-25T02:05:00.000Z'), 102),
      row(utc('2026-05-25T02:10:00.000Z'), 103),
      row(utc('2026-05-25T02:15:00.000Z'), 104),
    ])

    expect(candles).toHaveLength(2)
    expect(candles[1].startTimestamp).toBe(utc('2026-05-25T02:00:00.000Z'))
    expect(candles[1].close).toBe(104)
  })
})
