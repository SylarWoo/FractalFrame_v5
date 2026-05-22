import { beforeEach, describe, expect, it } from 'vitest'
import {
  isPeriodVisibleByVisibilityRange,
  isStoredVisibilityRangePeriodVisible,
  normalizeVisibilityRangeRows,
  parseChartPeriodForVisibilityRange,
  readVisibilityRangeRows,
  visibilityRangeStorageKey,
  writeVisibilityRangeRows,
} from './visibilityRangeModel'

function installStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      dispatchEvent: () => true,
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => {
          values.delete(key)
        },
        setItem: (key: string, value: string) => {
          values.set(key, value)
        },
      },
    },
  })
}

describe('visibilityRangeModel', () => {
  beforeEach(() => {
    installStorage()
  })

  it('normalizes saved rows and keeps known default units', () => {
    const rows = normalizeVisibilityRangeRows([
      { enabled: false, from: 80, key: 'minutes', to: -4 },
      { enabled: true, from: 4, key: 'hours', to: 2 },
    ])

    expect(rows.map((row) => row.key)).toEqual(['minutes', 'hours', 'days', 'weeks', 'months'])
    expect(rows[0]).toMatchObject({ enabled: false, from: 1, key: 'minutes', to: 59 })
    expect(rows[1]).toMatchObject({ enabled: true, from: 2, key: 'hours', to: 4 })
  })

  it('parses supported chart periods into visibility units', () => {
    expect(parseChartPeriodForVisibilityRange('M5')).toEqual({ unit: 'minutes', value: 5 })
    expect(parseChartPeriodForVisibilityRange('15m')).toEqual({ unit: 'minutes', value: 15 })
    expect(parseChartPeriodForVisibilityRange('H4')).toEqual({ unit: 'hours', value: 4 })
    expect(parseChartPeriodForVisibilityRange('1D')).toEqual({ unit: 'days', value: 1 })
    expect(parseChartPeriodForVisibilityRange('W1')).toEqual({ unit: 'weeks', value: 1 })
    expect(parseChartPeriodForVisibilityRange('MN3')).toEqual({ unit: 'months', value: 3 })
    expect(parseChartPeriodForVisibilityRange('custom')).toBeNull()
  })

  it('checks whether a chart period is allowed by rows', () => {
    const rows = normalizeVisibilityRangeRows([
      { enabled: true, from: 5, key: 'minutes', to: 30 },
      { enabled: false, from: 1, key: 'hours', to: 24 },
    ])

    expect(isPeriodVisibleByVisibilityRange(rows, 'M1')).toBe(false)
    expect(isPeriodVisibleByVisibilityRange(rows, 'M15')).toBe(true)
    expect(isPeriodVisibleByVisibilityRange(rows, 'M45')).toBe(false)
    expect(isPeriodVisibleByVisibilityRange(rows, 'H4')).toBe(false)
    expect(isPeriodVisibleByVisibilityRange(rows, 'D1')).toBe(true)
    expect(isPeriodVisibleByVisibilityRange(rows, 'unknown')).toBe(true)
  })

  it('reads and writes stored range rows by module key', () => {
    const key = 'indicator:MACD'
    const rows = normalizeVisibilityRangeRows([{ enabled: false, from: 1, key: 'minutes', to: 59 }])

    expect(visibilityRangeStorageKey(key)).toBe('fractalframe:visibilityRange:indicator:MACD:v1')
    expect(writeVisibilityRangeRows(key, rows)).toBe(true)
    expect(readVisibilityRangeRows(key)[0]).toMatchObject({ enabled: false, key: 'minutes' })
    expect(isStoredVisibilityRangePeriodVisible(key, 'M5')).toBe(false)
  })
})
