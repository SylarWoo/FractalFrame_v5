import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateMorganRangeSegments, getMorganRangeLevel, collectH4MorganCandles, resolveH4MorganBucketKey } from './morganRangeModel'

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

  it('calculates callable Morgan range levels with the red zone split into eighths', () => {
    const start = utc('2026-05-25T02:00:00.000Z')
    const rows = Array.from({ length: 9 }, (_, index) => row(start + index * 4 * 60 * 60 * 1000, 100))
    const segments = calculateMorganRangeSegments(rows, 1)
    const segment = segments[0]

    expect(segment.center).toBe(100)
    expect(segment.range).toBe(6)
    expect(segment.upper).toBe(106)
    expect(segment.lower).toBe(94)
    expect(segment.levels.map((level) => level.ratio)).toEqual([
      -1,
      -0.786,
      -0.618,
      -0.5,
      -0.382,
      -0.236,
      -0.177,
      -0.118,
      -0.059,
      0,
      0.059,
      0.118,
      0.177,
      0.236,
      0.382,
      0.5,
      0.618,
      0.786,
      1,
    ])
    expect(getMorganRangeLevel(segment, 0.236)?.price).toBeCloseTo(101.416)
    expect(getMorganRangeLevel(segment, -0.059)?.price).toBeCloseTo(99.646)
  })
})
