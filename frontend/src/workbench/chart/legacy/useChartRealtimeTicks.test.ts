import { describe, expect, it } from 'vitest'
import { resolveMt5RateVolumeForPeriodStart, resolveRealtimeRateVolume } from './useChartRealtimeTicks'

describe('resolveRealtimeRateVolume', () => {
  it('uses the current timeframe MT5 rate volume for a new realtime candle', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: true, latestVolume: 1128, mt5RateVolume: 3 })).toBe(3)
  })

  it('uses the realtime tick volume before the MT5 rate snapshot arrives', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: true, latestVolume: 1128, mt5RateVolume: null, tickVolume: 7 })).toBe(7)
  })

  it('uses the current timeframe MT5 rate volume for the open realtime candle', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: false, latestVolume: 1128, mt5RateVolume: 1131 })).toBe(1131)
  })

  it('uses the open realtime tick volume when MT5 rates lag behind', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: false, latestVolume: 1128, mt5RateVolume: null, tickVolume: 1130 })).toBe(1130)
  })

  it('keeps the existing open candle volume until the MT5 rate snapshot arrives', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: false, latestVolume: 1128, mt5RateVolume: null })).toBe(1128)
  })

  it('seeds a new realtime candle with a minimum visible volume when no upstream volume is available yet', () => {
    expect(resolveRealtimeRateVolume({ appendNewBar: true, latestVolume: 1128, mt5RateVolume: null })).toBe(1)
  })
})

describe('resolveMt5RateVolumeForPeriodStart', () => {
  it('uses the MT5 rate volume whose open time matches the current period start', () => {
    expect(resolveMt5RateVolumeForPeriodStart([
      { close: 1, high: 1, low: 1, open: 1, time: 1_700_000_000, volume: 12 },
      { close: 1, high: 1, low: 1, open: 1, time: 1_700_000_300, volume: 34 },
    ], 1_700_000_300_000)).toBe(34)
  })

  it('returns null when the current timeframe rate is not in the MT5 snapshot', () => {
    expect(resolveMt5RateVolumeForPeriodStart([
      { close: 1, high: 1, low: 1, open: 1, time: 1_700_000_000, volume: 12 },
    ], 1_700_000_300_000)).toBeNull()
  })
})
