import { describe, expect, it } from 'vitest'
import { resolveRealtimeBoundaryIndex, resolveRealtimeFutureAxisGeometry } from './KLineChartRealtimePaneV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

describe('resolveRealtimeFutureAxisGeometry', () => {
  it('does not create a future pseudo coordinate geometry', () => {
    expect(resolveRealtimeFutureAxisGeometry()).toBeNull()
  })
})

describe('resolveRealtimeBoundaryIndex', () => {
  it('aligns the realtime boundary with the first realtime candle center', () => {
    const frame = {
      segments: {
        history: {
          fromIndex: 0,
          key: 'history',
          rows: 10,
          source: 'history',
          timeFrom: 1000,
          timeTo: 2000,
          toIndex: 9,
        },
        realtime: {
          fromIndex: 10,
          key: 'realtime',
          rows: 3,
          source: 'realtime',
          timeFrom: 3000,
          timeTo: 3600,
          toIndex: 12,
        },
      },
    } as unknown as KLineChartRenderFrameV2

    expect(resolveRealtimeBoundaryIndex(frame)).toBe(10)
  })

  it('places the empty realtime boundary on the last history candle after close', () => {
    const frame = {
      segments: {
        history: {
          fromIndex: 0,
          key: 'history',
          rows: 10,
          source: 'history',
          timeFrom: 1000,
          timeTo: 2000,
          toIndex: 9,
        },
        realtime: null,
      },
    } as unknown as KLineChartRenderFrameV2

    expect(resolveRealtimeBoundaryIndex(frame, {
      current: {
        index: 1,
        timeFrom: 1000,
        timeTo: 2000,
      },
      newer: null,
      older: null,
      realtimeStart: 2000,
    })).toBe(9)
  })
})
