import { describe, expect, it } from 'vitest'
import { resolveCountdownEndTimestamp } from './useCurrentCandleCountdown'

describe('resolveCountdownEndTimestamp', () => {
  it('uses the latest candle end when it is still active', () => {
    expect(resolveCountdownEndTimestamp(1_000, 300_000, 120_000)).toBe(301_000)
  })

  it('falls back to the current period end when the latest candle is stale', () => {
    expect(resolveCountdownEndTimestamp(1_000, 300_000, 760_000)).toBe(900_000)
  })
})
