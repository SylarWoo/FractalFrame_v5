import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import {
  appendFuturePlaceholders,
  calculateWithoutFuturePlaceholders,
  lastRealKLine,
  resolveFuturePlaceholderCount,
  stripFuturePlaceholders,
} from './chartFuturePlaceholders'

const rows: KLineData[] = [
  { close: 10, high: 11, low: 9, open: 10, timestamp: 1_700_000_000_000, volume: 5 },
  { close: 12, high: 13, low: 11, open: 10, timestamp: 1_700_000_060_000, volume: 7 },
]

describe('chartFuturePlaceholders', () => {
  it('resolves two days of right-side space for the current period', () => {
    const output = appendFuturePlaceholders(rows, 'M1', true)
    const count = resolveFuturePlaceholderCount('M1')

    expect(count).toBe(2880)
    expect(output).toEqual(rows)
  })

  it('strips placeholders and resolves the latest real kline', () => {
    const output = appendFuturePlaceholders(rows, 'H1', true)

    expect(stripFuturePlaceholders(output)).toEqual(rows)
    expect(lastRealKLine(output)).toEqual(rows[1])
  })

  it('keeps indicator results aligned while skipping placeholder calculation', () => {
    const output = appendFuturePlaceholders(rows, 'H1', true)
    const placeholderRows = [
      ...output,
      { ...rows[1], __ffFuturePlaceholder: true, timestamp: rows[1].timestamp + 60_000 },
    ]
    const calculated = calculateWithoutFuturePlaceholders(placeholderRows, (realRows) => realRows.map((row) => Number(row.close) * 2))

    expect(calculated[0]).toBe(20)
    expect(calculated[1]).toBe(24)
    expect(calculated[2]).toBeUndefined()
  })

  it('returns real rows only when disabled', () => {
    expect(appendFuturePlaceholders(rows, 'M1', false)).toEqual(rows)
  })
})
