import { describe, expect, it } from 'vitest'
import type { ChartLoadState } from '../chart/ChartCoreHost'
import { resolveIndicatorRestoreContextKey } from './useIndicatorsController'

function createLoadState(overrides: Partial<ChartLoadState> = {}): ChartLoadState {
  return {
    error: false,
    loadedPeriod: 'M5',
    loadedSymbol: 'XAUUSDm',
    loading: false,
    loadingMore: false,
    period: 'M5',
    requestedRows: 500,
    rows: 500,
    symbol: 'XAUUSDm',
    totalRows: 1000,
    ...overrides,
  }
}

describe('resolveIndicatorRestoreContextKey', () => {
  it('waits until chart data is ready', () => {
    expect(resolveIndicatorRestoreContextKey(null, 'M5', 'XAUUSDm')).toBeNull()
    expect(resolveIndicatorRestoreContextKey(createLoadState({ loading: true }), 'M5', 'XAUUSDm')).toBeNull()
    expect(resolveIndicatorRestoreContextKey(createLoadState({ rows: 0 }), 'M5', 'XAUUSDm')).toBeNull()
  })

  it('uses only chart data context, not indicator loaded state', () => {
    expect(resolveIndicatorRestoreContextKey(createLoadState(), 'M5', 'XAUUSDm')).toBe('XAUUSDm:M5:500:500')
    expect(resolveIndicatorRestoreContextKey(createLoadState({ rows: 650 }), 'M5', 'XAUUSDm')).toBe('XAUUSDm:M5:500:650')
  })
})
