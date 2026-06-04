import { describe, expect, it } from 'vitest'
import type { Chart } from 'klinecharts'
import { isAxisRangeUsableForVisiblePrices, type AxisRangeSnapshot } from './chartViewportAxisRange'

function axisRange(realFrom: number, realTo: number): AxisRangeSnapshot {
  return {
    from: realFrom,
    range: realTo - realFrom,
    realFrom,
    realRange: realTo - realFrom,
    realTo,
    to: realTo,
  }
}

function chartWithMainIndicator(values: Array<Record<string, unknown>>): Chart {
  return {
    getChartStore: () => ({
      getIndicatorStore: () => ({
        getInstances: (paneId: string) => paneId === 'candle_pane'
          ? [{
              figures: [{ key: 'upperBand1' }, { key: 'lowerBand1' }],
              result: values,
            }]
          : [],
      }),
    }),
    getDataList: () => [
      { high: 110, low: 100 },
      { high: 112, low: 101 },
      { high: 111, low: 99 },
    ],
    getVisibleRange: () => ({ realFrom: 0, realTo: 2 }),
  } as unknown as Chart
}

describe('chartViewportAxisRange', () => {
  it('rejects a saved y-axis range that excludes visible main indicator values', () => {
    const chart = chartWithMainIndicator([
      { lowerBand1: 90, upperBand1: 120 },
      { lowerBand1: 91, upperBand1: 450 },
      { lowerBand1: 92, upperBand1: 121 },
    ])

    expect(isAxisRangeUsableForVisiblePrices(chart, axisRange(80, 130))).toBe(false)
  })

  it('keeps a saved y-axis range that covers visible candle and main indicator values', () => {
    const chart = chartWithMainIndicator([
      { lowerBand1: 90, upperBand1: 120 },
      { lowerBand1: 91, upperBand1: 450 },
      { lowerBand1: 92, upperBand1: 121 },
    ])

    expect(isAxisRangeUsableForVisiblePrices(chart, axisRange(80, 500))).toBe(true)
  })
})
