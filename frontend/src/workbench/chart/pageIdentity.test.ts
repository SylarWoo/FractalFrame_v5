import { describe, expect, it } from 'vitest'
import { createPageIdentity } from './pageIdentity'
import { createIndicatorPageKey } from './indicatorPageSnapshotStore'

describe('createPageIdentity', () => {
  it('uses time boundaries as the stable identity for time-based pages', () => {
    const identity = createPageIdentity({
      fromGlobalIndex: null,
      index: 1,
      timeFrom: 1_700_000_000,
      timeTo: 1_700_604_800,
      toGlobalIndex: null,
    }, 'XAUUSDm', 'm5')

    expect(identity).toBe('XAUUSDm|M5|1|time|1700000000|1700604800')
  })

  it('uses global indexes as the stable identity for rows-based pages', () => {
    const identity = createPageIdentity({
      fromGlobalIndex: 6_200,
      index: 1,
      toGlobalIndex: 8_199,
    }, 'XAUUSDm', 'm15')

    expect(identity).toBe('XAUUSDm|M15|1|rows|6200|8199')
  })

  it('makes indicator keys prefer page identity over chart rows', () => {
    const pageIdentity = 'XAUUSDm|M5|1|time|1700000000|1700604800'
    const key = createIndicatorPageKey({
      pageIdentity,
      pageIndex: 1,
      period: 'M5',
      realtime: true,
      rows: [
        { close: 1, high: 1, low: 1, open: 1, timestamp: 1_700_000_000_000 },
        { close: 2, high: 2, low: 2, open: 2, timestamp: 1_700_000_300_000 },
      ],
      symbol: 'XAUUSDm',
    })

    expect(key).toBe(pageIdentity)
  })
})
