import { describe, expect, it } from 'vitest'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { createKLineChartIndicatorFrameIdentityV2 } from './klineChartIndicatorFrameIdentityV2'

function frame(paneKey: string): KLineChartRenderFrameV2 {
  return {
    alignment: {
      barKeyToDataIndex: new Map(),
      dataIndexToBarKey: ['a', 'b', 'c'],
      dataIndexToGlobalIndex: [1, 2, 3],
      dataIndexToTimestamp: [1000, 2000, 3000],
      globalIndexToDataIndex: new Map(),
      timestampToDataIndex: new Map(),
    },
    key: `frame:${paneKey}`,
    mainRows: [
      { close: 1, high: 2, low: 0, open: 1, timestamp: 1000, volume: 10 },
      { close: 2, high: 3, low: 1, open: 2, timestamp: 2000, volume: 20 },
      { close: 3, high: 4, low: 2, open: 3, timestamp: 3000, volume: 30 },
    ],
    pageIndex: 1,
    panes: {
      MA: {
        key: paneKey,
        paneId: 'main-ma-overlay',
        paneRole: 'main',
        renderRole: 'main-overlay',
        rows: [{ ma: 1 }, { ma: 2 }, { ma: 3 }],
        settings: { length: 5, shiftLength: 0, type: 'sma' },
        source: 'kline-chart-render-pane-frame-v2',
      },
    },
    period: 'M5',
    segments: {
      history: {
        fromIndex: 0,
        key: 'history',
        rows: 3,
        source: 'history',
        timeFrom: 1000,
        timeTo: 3000,
        toIndex: 2,
      },
    },
    source: 'kline-chart-render-frame-v2',
    symbol: 'XAUUSDm',
  }
}

describe('createKLineChartIndicatorFrameIdentityV2', () => {
  it('ignores pane key churn when frame and indicator rows are unchanged', () => {
    const identity = createKLineChartIndicatorFrameIdentityV2()

    expect(identity.shouldUpdate('mainMa', frame('MA:history:indicators:a'), ['MA'])).toBe(true)
    expect(identity.shouldUpdate('mainMa', frame('MA:history:indicators:b'), ['MA'])).toBe(false)
  })

  it('updates when the MA row content changes', () => {
    const identity = createKLineChartIndicatorFrameIdentityV2()
    const next = frame('MA:history:indicators:a')
    next.panes.MA.rows[2] = { ma: 4 }

    expect(identity.shouldUpdate('mainMa', frame('MA:history:indicators:a'), ['MA'])).toBe(true)
    expect(identity.shouldUpdate('mainMa', next, ['MA'])).toBe(true)
  })

  it('updates when the main chart window changes', () => {
    const identity = createKLineChartIndicatorFrameIdentityV2()
    const next = frame('MA:history:indicators:b')
    next.mainRows[2] = { ...next.mainRows[2], close: 4 }

    expect(identity.shouldUpdate('mainMa', frame('MA:history:indicators:a'), ['MA'])).toBe(true)
    expect(identity.shouldUpdate('mainMa', next, ['MA'])).toBe(true)
  })
})
