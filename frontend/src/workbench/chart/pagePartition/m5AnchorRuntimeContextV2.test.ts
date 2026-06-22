import { describe, expect, it } from 'vitest'
import {
  m5AnchorRuntimeCacheMetaEqualsV2,
  resolveM5AnchorRuntimeContextFromPagesV2,
  resolveM5AnchorRuntimeContextV2,
} from './m5AnchorRuntimeContextV2'

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Math.floor(Date.UTC(year, month - 1, day, hour - 8, minute) / 1000)
}

describe('m5AnchorRuntimeContextV2', () => {
  it('keeps the stopped Monday session in realtime before the Tuesday 06:00 open prints', () => {
    const context = resolveM5AnchorRuntimeContextV2({
      latestTime: shanghaiSeconds(2026, 6, 9, 4, 55),
      symbol: 'XAUUSDm',
    })

    expect(context).toEqual(expect.objectContaining({
      historyFrom: shanghaiSeconds(2026, 6, 1, 6, 0),
      historyTo: shanghaiSeconds(2026, 6, 8, 6, 0) - 1,
      realtimeFrom: shanghaiSeconds(2026, 6, 8, 6, 0),
    }))
  })

  it('resolves Friday startup anchors from the latest StoreV6 time', () => {
    const context = resolveM5AnchorRuntimeContextV2({
      latestTime: shanghaiSeconds(2026, 6, 12, 7, 15),
      symbol: 'XAUUSDm',
    })

    expect(context).toEqual(expect.objectContaining({
      historyFrom: shanghaiSeconds(2026, 6, 5, 6, 0),
      historyTo: shanghaiSeconds(2026, 6, 12, 6, 0) - 1,
      realtimeFrom: shanghaiSeconds(2026, 6, 12, 6, 0),
    }))
  })

  it('derives cache anchor metadata from page one', () => {
    const meta = resolveM5AnchorRuntimeContextFromPagesV2({
      pages: [{
        fromGlobalIndex: null,
        index: 1,
        limit: 1650,
        pageType: 'history',
        plannedTimeFrom: shanghaiSeconds(2026, 6, 2, 6, 0),
        plannedTimeTo: shanghaiSeconds(2026, 6, 9, 6, 0) - 1,
        realtime: false,
        rows: 1650,
        timeFrom: shanghaiSeconds(2026, 6, 1, 6, 0),
        timeTo: shanghaiSeconds(2026, 6, 9, 5, 0) - 1,
        toGlobalIndex: null,
      }],
      symbol: 'XAUUSDm',
    })

    expect(meta).toEqual({
      historyFrom: shanghaiSeconds(2026, 6, 2, 6, 0),
      historyTo: shanghaiSeconds(2026, 6, 9, 6, 0) - 1,
      realtimeFrom: shanghaiSeconds(2026, 6, 9, 6, 0),
    })
    expect(m5AnchorRuntimeCacheMetaEqualsV2(meta, { ...meta! })).toBe(true)
  })
})
