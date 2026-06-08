import { describe, expect, it } from 'vitest'
import { createFutureTicksV2 } from './klineChartRealtimeXAxisV2'

describe('kLineChartRealtimeXAxisV2', () => {
  it('does not append a custom future coordinate series', () => {
    expect(createFutureTicksV2()).toEqual([])
  })
})
