import { describe, expect, it } from 'vitest'
import { resolveRealtimeRateVolume } from './useChartRealtimeTicks'

describe('resolveRealtimeRateVolume', () => {
  it('uses the current timeframe MT5 rate volume for a new realtime candle', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: true, latestVolume: 1128, mt5RateVolume: 3 })).toBe(3)
  })

  it('uses the current timeframe MT5 rate volume for the open realtime candle', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: false, latestVolume: 1128, mt5RateVolume: 1131 })).toBe(1131)
  })

  it('keeps the existing open candle volume until the MT5 rate snapshot arrives', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: false, latestVolume: 1128, mt5RateVolume: null })).toBe(1128)
  })
})
