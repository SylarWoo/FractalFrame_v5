import { describe, expect, it } from 'vitest'
import { buildTwoPointStatsRows, resolveTwoPointStatsAnchorPoint } from './twoPointDrawingStats'

describe('twoPointDrawingStats', () => {
  it('builds reusable two-point stats rows', () => {
    expect(buildTwoPointStatsRows({
      end: { x: 130, y: 60 },
      options: { data: ['price-range', 'percent-change', 'point-change', 'bar-range', 'date-time-range', 'distance', 'angle'] },
      points: [
        { dataIndex: 10, timestamp: 1_700_000_000, value: 100 },
        { dataIndex: 16, timestamp: 1_700_003_600, value: 112.5 },
      ],
      start: { x: 100, y: 100 },
    })).toEqual([
      '12.5 (12.5%), 12,500',
      '6\u6839K\u7ebf (1\u5c0f\u65f6), \u8ddd\u79bb: 50 px',
      '53.13\u00b0',
    ])
  })

  it('resolves anchor points by configured position', () => {
    const start = { x: 10, y: 20 }
    const end = { x: 30, y: 60 }

    expect(resolveTwoPointStatsAnchorPoint('left', start, end)).toEqual(start)
    expect(resolveTwoPointStatsAnchorPoint('right', start, end)).toEqual(end)
    expect(resolveTwoPointStatsAnchorPoint('center', start, end)).toEqual({ x: 20, y: 40 })
  })
})
