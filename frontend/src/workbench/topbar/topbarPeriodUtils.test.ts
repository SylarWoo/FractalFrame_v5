import { beforeEach, describe, expect, it } from 'vitest'
import { storageKeys } from '../persistence/storageKeys'
import {
  periodOrder,
  periodToChartPeriod,
  readPeriodsForSymbol,
  readShortcutMenuPeriods,
  readShortcutPeriods,
  resolveShortcutActivePeriod,
} from './topbarPeriodUtils'

function installStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
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

describe('topbarPeriodUtils', () => {
  beforeEach(() => {
    installStorage()
  })

  it('keeps the expected shortcut period order', () => {
    expect(periodOrder).toEqual(['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H3', 'H4', 'D1', 'W1', 'MN1'])
    expect(periodToChartPeriod('M1')).toBe('M1')
    expect(periodToChartPeriod('H4')).toBe('H4')
  })

  it('normalizes saved shortcut periods and filters malformed rows', () => {
    installStorage({
      [storageKeys.importCenterShortcutMenuPeriods]: JSON.stringify([
        { period: ' h4 ', rowsCount: 4 },
        { period: '', rowsCount: 1 },
        { rowsCount: 3 },
        { period: 'M1', rowsCount: 10 },
      ]),
    })

    expect(readShortcutPeriods()).toEqual([
      { period: 'H4', rowsCount: 4 },
      { period: 'M1', rowsCount: 10 },
    ])
    expect(readShortcutMenuPeriods()).toEqual([
      { period: 'M1', rowsCount: 10 },
      { period: 'H4', rowsCount: 4 },
    ])
  })

  it('merges direct, aggregated, and saved periods for a symbol in stable order', () => {
    installStorage({
      [storageKeys.importCenterShortcutMenuPeriods]: JSON.stringify([{ period: 'D1', rowsCount: 7 }]),
      [storageKeys.importCenterStoreV5Status]: JSON.stringify({
        XAUUSDm: {
          directM1: { rowsCount: 100 },
          aggregated: [
            { timeframe: 'H4', rowsCount: 40 },
            { timeframe: 'M5', rowsCount: 80 },
            { timeframe: 'W1', rowsCount: 0 },
          ],
        },
      }),
    })

    expect(readPeriodsForSymbol('XAUUSDm')).toEqual([
      { period: 'M1', rowsCount: 100 },
      { period: 'M5', rowsCount: 80 },
      { period: 'H4', rowsCount: 40 },
      { period: 'D1', rowsCount: 7 },
    ])
  })
})

describe('shortcut active period fallback', () => {
  it('resolves fallback without mutating state in an effect', () => {
    const periods = [
      { period: 'M1', rowsCount: 100 },
      { period: 'H4', rowsCount: 40 },
    ]

    expect(resolveShortcutActivePeriod('H4', periods)).toBe('H4')
    expect(resolveShortcutActivePeriod('D1', periods)).toBe('M1')
    expect(resolveShortcutActivePeriod('D1', [])).toBe('D1')
  })
})
