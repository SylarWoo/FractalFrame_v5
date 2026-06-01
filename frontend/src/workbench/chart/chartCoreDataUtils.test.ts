import { describe, expect, it } from 'vitest'
import { historyPageSize, initialLoadLimit, maxInitialLoadLimit, resolveInitialLimit } from './chartCoreDataUtils'

describe('chartCoreDataUtils', () => {
  it('keeps chart windows small enough for live indicators', () => {
    expect(initialLoadLimit).toBe(5_000)
    expect(historyPageSize).toBe(5_000)
    expect(resolveInitialLimit()).toBe(5_000)
    expect(resolveInitialLimit(100_000)).toBe(maxInitialLoadLimit)
  })
})
