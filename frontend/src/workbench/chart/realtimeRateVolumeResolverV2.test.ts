import { describe, expect, it, vi } from 'vitest'
import {
  createRealtimeRateVolumeResolverV2,
  normalizeRealtimeRateTimeframeV2,
} from './realtimeRateVolumeResolverV2'
import type { Mt5RealtimeWindowTick } from './realtimePageWindowV2'

function tick(time: number, price: number): Mt5RealtimeWindowTick {
  return {
    ask: price,
    bid: price,
    last: price,
    symbol: 'XAUUSDm',
    time,
  }
}

function payload(volume: number) {
  return {
    mode: 'rates',
    ok: true,
    rows: [{
      close: 1,
      high: 1,
      low: 1,
      open: 1,
      time: 1_200,
      volume,
    }],
    rowsCount: 1,
    symbol: 'XAUUSDm',
    timeframe: 'M5',
  }
}

function flushPromises() {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

describe('realtimeRateVolumeResolverV2', () => {
  it('normalizes realtime rate timeframes for MT5 queries', () => {
    expect(normalizeRealtimeRateTimeframeV2('H2')).toBe('M30')
    expect(normalizeRealtimeRateTimeframeV2('5M')).toBe('M5')
    expect(normalizeRealtimeRateTimeframeV2('2H')).toBe('H2')
    expect(normalizeRealtimeRateTimeframeV2('MN')).toBe('MN1')
  })

  it('coalesces ticks while a rate volume request is in flight', async () => {
    let resolveFirst: (value: ReturnType<typeof payload>) => void = () => undefined
    let resolveSecond: (value: ReturnType<typeof payload>) => void = () => undefined
    const queryRates = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecond = resolve
      }))
    const apply = vi.fn()
    const resolver = createRealtimeRateVolumeResolverV2({
      apply,
      period: 'M5',
      queryRates,
      symbol: 'XAUUSDm',
    })

    const firstTick = tick(1_200, 10)
    const latestTick = tick(1_200, 11)
    resolver.request(firstTick)
    resolver.request(latestTick)

    expect(queryRates).toHaveBeenCalledTimes(1)
    resolveFirst(payload(12))
    await flushPromises()

    expect(apply).toHaveBeenCalledWith(latestTick, 12)
    expect(queryRates).toHaveBeenCalledTimes(2)

    resolveSecond(payload(13))
    await flushPromises()

    expect(apply).toHaveBeenLastCalledWith(latestTick, 13)
    resolver.dispose()
  })
})
