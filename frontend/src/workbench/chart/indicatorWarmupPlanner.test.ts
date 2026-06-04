import { describe, expect, it } from 'vitest'
import {
  planPageIndicatorWarmup,
  resolveIndicatorWarmupEntry,
} from './indicatorWarmupPlanner'

describe('indicatorWarmupPlanner', () => {
  it('keeps the planner entry point while warmup strategies are disabled', () => {
    const entry = resolveIndicatorWarmupEntry({
      name: 'MA',
      settings: { length: 900, shiftLength: 15 },
    })

    expect(entry.name).toBe('MA')
    expect(entry.warmupRows).toBe(0)
    expect(entry.lookaheadRows).toBe(0)
  })

  it('returns a zero-row page plan for all indicators during base stabilization', () => {
    const plan = planPageIndicatorWarmup({
      indicators: [
        { name: 'MMF_V3' },
        { name: 'MR-M5' },
        { name: 'MA', settings: { length: 900, shiftLength: 15 } },
        { name: 'VWAP' },
      ],
      period: 'M5',
    })

    expect(plan.warmupRows).toBe(0)
    expect(plan.lookaheadRows).toBe(0)
    expect(plan.entries.map((entry) => entry.name)).toEqual(['MMF_V3', 'MR-M5', 'MA', 'VWAP'])
  })
})
