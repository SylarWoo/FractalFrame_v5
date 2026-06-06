import { describe, expect, it } from 'vitest'
import { createPageDataSliceFromDisplayRows } from '../pageData/pageDataProvider'
import { createChartPageWindow } from './chartPageWindow'

describe('createChartPageWindow', () => {
  it('creates a static history window from display rows', () => {
    const slice = createPageDataSliceFromDisplayRows({
      displayRows: [
        { close: 1, high: 1, low: 1, open: 1, timestamp: 1_000 },
        { close: 2, high: 2, low: 2, open: 2, timestamp: 2_000 },
      ],
      mode: 'history',
      pageIndex: 2,
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    const window = createChartPageWindow(slice)

    expect(window.mode).toBe('history')
    expect(window.behavior.acceptRealtimeTicks).toBe(false)
    expect(window.behavior.staticPage).toBe(true)
    expect(window.displayRows).toHaveLength(2)
    expect(window.indicators.rows).toHaveLength(2)
    expect(window.indicators.rows[0]?.barKey).toBe(window.displayRows[0]?.barKey)
    expect(window.key).toContain('history:XAUUSDm:M5:2')
  })

  it('creates a live window identity for realtime pages', () => {
    const slice = createPageDataSliceFromDisplayRows({
      displayRows: [
        { close: 1, high: 1, low: 1, open: 1, timestamp: 1_000 },
      ],
      mode: 'realtime',
      pageIndex: 1,
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    const window = createChartPageWindow(slice)

    expect(window.key).toBe('realtime:XAUUSDm:M5')
    expect(window.behavior.acceptRealtimeTicks).toBe(true)
    expect(window.behavior.followLatest).toBe(true)
    expect(window.behavior.staticPage).toBe(false)
  })
})
