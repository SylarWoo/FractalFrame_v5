import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import type { KLineChartPaneFrame } from './historyPageKLineChartFrameV2'
import {
  storeV6MorganRangeH2IndicatorIdV2,
  storeV6MorganRangeM30IndicatorIdV2,
  storeV6MorganRangeM5IndicatorIdV2,
} from './indicatorRequestV2/morganRangeIndicatorV2'
import type { KLineChartRenderFrameV2 } from './klineChartRenderFrameV2'
import type { MorganRangeSegment } from './morganRangeModel'
import {
  readCurrentMorganRangeDataFromFrameV2,
  readCurrentMorganRangeDataFromSnapshotV2,
  readMorganRangeSegmentsFromFrameV2,
  resolveMorganRangeRuntimeDefinitionV2,
} from './morganRangeRuntimeV2'

function kline(index: number): KLineData {
  return {
    close: 100 + index,
    high: 101 + index,
    low: 99 + index,
    open: 100 + index,
    timestamp: 1_700_000_000_000 + index * 300_000,
    volume: 100,
  }
}

function segment(startIndex: number, endIndex: number, center = 100): MorganRangeSegment {
  const range = 10
  return {
    atr7: range / 3,
    center,
    endIndex,
    index: startIndex,
    levels: [-0.236, 0, 0.236].map((ratio) => ({
      price: center + range * ratio,
      ratio,
    })),
    lower: center - range,
    range,
    startIndex,
    startTimestamp: 1_700_000_000_000 + startIndex * 300_000,
    trueRange: range * 0.472,
    upper: center + range,
  }
}

function pane(rows: MorganRangeSegment[]): KLineChartPaneFrame {
  return {
    key: 'mr-pane',
    paneId: 'main-mr',
    paneRole: 'main',
    renderRole: 'main-overlay',
    rows,
    settings: {},
    source: 'kline-chart-render-pane-frame-v2',
  }
}

function frame(period: string, indicatorId: string, rows: MorganRangeSegment[]): KLineChartRenderFrameV2 {
  const mainRows = Array.from({ length: 10 }, (_, index) => kline(index))
  return {
    alignment: {
      barKeyToDataIndex: new Map(),
      dataIndexToBarKey: [],
      dataIndexToGlobalIndex: [],
      dataIndexToTimestamp: mainRows.map((row) => Number(row.timestamp)),
      globalIndexToDataIndex: new Map(),
      timestampToDataIndex: new Map(),
    },
    key: `frame:${period}`,
    mainRows,
    pageIndex: 1,
    panes: {
      [indicatorId]: pane(rows),
    },
    period,
    segments: {
      history: {
        fromIndex: 0,
        key: 'history',
        rows: mainRows.length,
        source: 'history',
        timeFrom: Number(mainRows[0].timestamp),
        timeTo: Number(mainRows[mainRows.length - 1].timestamp),
        toIndex: mainRows.length - 1,
      },
    },
    source: 'kline-chart-render-frame-v2',
    symbol: 'XAUUSDm',
  }
}

describe('morganRangeRuntimeV2', () => {
  it('resolves the three Morgan range modules independently', () => {
    expect(resolveMorganRangeRuntimeDefinitionV2({ period: 'M5' })).toMatchObject({
      indicatorId: storeV6MorganRangeM5IndicatorIdV2,
      mode: 'H4_M5',
      requestId: 'MR-M5',
    })
    expect(resolveMorganRangeRuntimeDefinitionV2({ requestId: 'MR-M30' })).toMatchObject({
      indicatorId: storeV6MorganRangeM30IndicatorIdV2,
      mode: 'D1_M30',
    })
    expect(resolveMorganRangeRuntimeDefinitionV2({ indicatorId: storeV6MorganRangeH2IndicatorIdV2 })).toMatchObject({
      mode: 'D5_H2',
      period: 'H2',
    })
  })

  it('reads current MR-M5 runtime data from a render frame', () => {
    const first = segment(0, 4, 100)
    const second = segment(5, 9, 120)
    const data = readCurrentMorganRangeDataFromFrameV2(
      frame('M5', storeV6MorganRangeM5IndicatorIdV2, [first, second]),
      { dataIndex: 6 },
    )

    expect(data).toMatchObject({
      core: {
        lower: 117.64,
        upper: 122.36,
      },
      indicatorId: storeV6MorganRangeM5IndicatorIdV2,
      mode: 'H4_M5',
      requestId: 'MR-M5',
    })
    expect(data?.core.trueRange).toBeCloseTo(4.72)
    expect(data?.segment).toBe(second)
    expect(data?.levelsByRatio['0.236']).toBe(122.36)
  })

  it('reads MR-H2 runtime data from snapshots for indicator calc consumers', () => {
    const current = segment(0, 9, 200)
    const data = readCurrentMorganRangeDataFromSnapshotV2({
      byBarKey: {},
      calculatedAt: 'now',
      morganRange: {
        mode: 'D5_H2',
        segments: [current],
      },
      pageKey: 'page',
      period: 'H2',
      rows: Array.from({ length: 10 }, (_, index) => ({
        barKey: `XAUUSDm|H2|${index}`,
        sourceIndex: index,
        time: index,
      })),
      settingsHash: 'hash',
      settingsHashes: { MR_H2: 'hash' },
      symbol: 'XAUUSDm',
    }, { dataIndex: 5 })

    expect(data).toMatchObject({
      core: {
        lower: 197.64,
        upper: 202.36,
      },
      indicatorId: storeV6MorganRangeH2IndicatorIdV2,
      mode: 'D5_H2',
      period: 'H2',
    })
  })

  it('returns no frame data when the expected module has no segment rows', () => {
    const source = readMorganRangeSegmentsFromFrameV2(frame('M30', storeV6MorganRangeM30IndicatorIdV2, []))
    expect(source?.definition.indicatorId).toBe(storeV6MorganRangeM30IndicatorIdV2)
    expect(source?.segments).toEqual([])
    expect(readCurrentMorganRangeDataFromFrameV2(frame('M30', storeV6MorganRangeM30IndicatorIdV2, []))).toBeNull()
  })
})
