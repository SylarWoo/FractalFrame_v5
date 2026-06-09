import { describe, expect, it, vi } from 'vitest'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import { buildCachedKLineChartRenderFrameV2, clearChartRenderCacheV2 } from './chartRenderCache'

function row(time: number, close: number, source: StoreV6WindowKLine['source']): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close,
    globalIndex: null,
    high: close,
    low: close,
    open: close,
    period: 'M5',
    source,
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: close,
  }
}

function historyWindow(rows: StoreV6WindowKLine[]): StoreV6HistoryPageWindow {
  return {
    boundary: {
      actualFromGlobalIndex: null,
      actualTimeFrom: rows[0]?.time ?? null,
      actualTimeTo: rows[rows.length - 1]?.time ?? null,
      actualToGlobalIndex: null,
      requestedFromGlobalIndex: null,
      requestedTimeFrom: null,
      requestedTimeTo: null,
      requestedToGlobalIndex: null,
    },
    calculationRows: rows,
    displayOffset: 0,
    historyRows: rows,
    indicators: {},
    key: 'history-window',
    page: {
      fromGlobalIndex: null,
      index: 1,
      limit: rows.length,
      pageType: 'history',
      realtime: false,
      rows: rows.length,
      timeFrom: rows[0]?.time ?? null,
      timeTo: rows[rows.length - 1]?.time ?? null,
      toGlobalIndex: null,
    },
    pageIndex: 1,
    period: 'M5',
    renderData: {
      indicators: {},
      klineRows: rows,
    },
    source: 'store-v6-history-page-window-v2',
    status: 'ready',
    symbol: 'XAUUSDm',
    warmupRows: [],
  }
}

function realtimeWindow(
  tail: StoreV6WindowKLine,
  stableRows: StoreV6WindowKLine[] = [],
  options: Partial<Pick<StoreV6RealtimePageWindow, 'indicatorRequests' | 'indicators'>> = {},
): StoreV6RealtimePageWindow {
  const activeRows = [...stableRows, tail]
  const indicators = options.indicators ?? {}
  return {
    activeRows,
    indicatorRequests: options.indicatorRequests ?? [],
    indicators,
    key: `realtime-window:${stableRows.length}:${stableRows[0]?.time ?? 'none'}:${stableRows[stableRows.length - 1]?.time ?? 'none'}:${tail.time}:${tail.open}:${tail.high}:${tail.low}:${tail.close}:${tail.volume}`,
    period: 'M5',
    renderData: {
      indicators,
      klineRows: activeRows,
    },
    sessionTimeFrom: tail.time,
    sessionTimeTo: null,
    source: 'store-v6-realtime-page-window-v2',
    stableRows,
    status: 'ready',
    symbol: 'XAUUSDm',
    tailRow: tail,
  }
}

describe('chartRenderCacheV2', () => {
  it('does not reuse a stale final frame when the realtime tail price changes in place', () => {
    clearChartRenderCacheV2()
    const history = historyWindow([
      row(1_000, 2290, 'store-v6-page-slice-v2'),
      row(1_300, 2295, 'store-v6-page-slice-v2'),
    ])

    const first = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: realtimeWindow(row(1_600, 2300, 'mt5-realtime-window-v2')),
    }).frame
    const second = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: realtimeWindow(row(1_600, 2301, 'mt5-realtime-window-v2')),
    }).frame

    expect(first.mainRows[first.mainRows.length - 1]?.close).toBe(2300)
    expect(second.mainRows[second.mainRows.length - 1]?.close).toBe(2301)
  })

  it('reuses the stable realtime render structure when only the realtime tail changes', () => {
    vi.stubGlobal('window', { __ffChartV2Perf: [] })
    clearChartRenderCacheV2()
    window.__ffChartV2Perf = []
    const history = historyWindow([
      row(1_000, 2290, 'store-v6-page-slice-v2'),
      row(1_300, 2295, 'store-v6-page-slice-v2'),
    ])
    const stableRows = [
      row(1_600, 2300, 'mt5-realtime-window-v2'),
      row(1_900, 2302, 'mt5-realtime-window-v2'),
    ]

    const first = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: realtimeWindow(row(2_200, 2304, 'mt5-realtime-window-v2'), stableRows),
    })
    const second = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: realtimeWindow(row(2_200, 2305, 'mt5-realtime-window-v2'), stableRows),
    })
    const secondPerf = window.__ffChartV2Perf?.at(-1)

    expect(first.frame.mainRows.map((item) => item.close)).toEqual([2290, 2295, 2300, 2302, 2304])
    expect(second.frame.mainRows.map((item) => item.close)).toEqual([2290, 2295, 2300, 2302, 2305])
    expect(second.renderWindow.rows.map((item) => item.close)).toEqual([2290, 2295, 2300, 2302, 2305])
    expect(secondPerf?.cache.renderWindowHit).toBe(true)
    expect(secondPerf?.cache.finalFrameHit).toBe(true)
    vi.unstubAllGlobals()
  })

  it('does not reuse a realtime indicator pane after the indicator is unloaded', () => {
    clearChartRenderCacheV2()
    const history = historyWindow([
      row(1_000, 2290, 'store-v6-page-slice-v2'),
      row(1_300, 2295, 'store-v6-page-slice-v2'),
    ])
    const stableRows = [row(1_600, 2300, 'mt5-realtime-window-v2')]
    const tail = row(1_900, 2302, 'mt5-realtime-window-v2')

    const loaded = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: realtimeWindow(tail, stableRows, {
        indicatorRequests: [{ id: 'MR-M5' }],
        indicators: {
          MR_M5: {
            displayRows: [{
              atr7: 1,
              center: 2300,
              endIndex: 1,
              index: 1,
              levels: [],
              lower: 2290,
              range: 10,
              startIndex: 0,
              startTimestamp: 1_600_000,
              trueRange: 1,
              upper: 2310,
            }],
            key: 'MR_M5:loaded',
            paneId: 'main-morgan-range-m5-overlay',
            paneRole: 'main',
            renderRole: 'main-overlay',
            rows: [],
            source: 'test',
          },
        },
      }),
    }).frame
    const unloaded = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: realtimeWindow(tail, stableRows),
    }).frame

    expect(loaded.panes.MR_M5).toBeDefined()
    expect(unloaded.panes.MR_M5).toBeUndefined()
  })

  it('passes VDO indicator rows from the history window into the final frame pane', () => {
    clearChartRenderCacheV2()
    const rows = [
      row(1_000, 2290, 'store-v6-page-slice-v2'),
      row(1_300, 2295, 'store-v6-page-slice-v2'),
    ]
    const history = {
      ...historyWindow(rows),
      indicators: {
        VDO: {
          displayRows: [
            { barKey: rows[0].barKey, time: rows[0].time, timestamp: rows[0].timestamp, vdo: 0.1, vdoMa: 0.05 },
            { barKey: rows[1].barKey, time: rows[1].time, timestamp: rows[1].timestamp, vdo: 0.2, vdoMa: 0.1 },
          ],
          key: 'VDO:history:XAUUSDm:M5:1',
          paneId: 'vdo_pane',
          paneRole: 'sub',
          renderRole: 'sub-pane',
          rows: [],
          settings: { length: 5 },
          source: 'store-v6-vdo-indicator-v2',
        },
      },
      renderData: {
        indicators: {
          VDO: {
            displayRows: [
              { barKey: rows[0].barKey, time: rows[0].time, timestamp: rows[0].timestamp, vdo: 0.1, vdoMa: 0.05 },
              { barKey: rows[1].barKey, time: rows[1].time, timestamp: rows[1].timestamp, vdo: 0.2, vdoMa: 0.1 },
            ],
            key: 'VDO:history:XAUUSDm:M5:1',
            paneId: 'vdo_pane',
            paneRole: 'sub',
            renderRole: 'sub-pane',
            rows: [],
            settings: { length: 5 },
            source: 'store-v6-vdo-indicator-v2',
          },
        },
        klineRows: rows,
      },
    } satisfies StoreV6HistoryPageWindow

    const frame = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: null,
    }).frame

    expect(frame.panes.VDO).toMatchObject({
      paneId: 'vdo_pane',
      paneRole: 'sub',
      renderRole: 'sub-pane',
      rows: [
        expect.objectContaining({ barKey: rows[0].barKey, vdo: 0.1, vdoMa: 0.05 }),
        expect.objectContaining({ barKey: rows[1].barKey, vdo: 0.2, vdoMa: 0.1 }),
      ],
    })
  })

  it('passes VMI indicator rows from the history window into the final frame pane', () => {
    clearChartRenderCacheV2()
    const rows = [
      row(1_000, 2290, 'store-v6-page-slice-v2'),
      row(1_300, 2295, 'store-v6-page-slice-v2'),
    ]
    const history = {
      ...historyWindow(rows),
      indicators: {
        VMI: {
          displayRows: [
            { barKey: rows[0].barKey, histogram: 0.1, time: rows[0].time, timestamp: rows[0].timestamp },
            { barKey: rows[1].barKey, histogram: -0.2, time: rows[1].time, timestamp: rows[1].timestamp },
          ],
          key: 'VMI:history:XAUUSDm:M5:1',
          paneId: 'vmi_pane',
          paneRole: 'sub',
          renderRole: 'sub-pane',
          rows: [],
          settings: { fastLength: 5, slowLength: 8 },
          source: 'store-v6-vmi-indicator-v2',
        },
      },
      renderData: {
        indicators: {
          VMI: {
            displayRows: [
              { barKey: rows[0].barKey, histogram: 0.1, time: rows[0].time, timestamp: rows[0].timestamp },
              { barKey: rows[1].barKey, histogram: -0.2, time: rows[1].time, timestamp: rows[1].timestamp },
            ],
            key: 'VMI:history:XAUUSDm:M5:1',
            paneId: 'vmi_pane',
            paneRole: 'sub',
            renderRole: 'sub-pane',
            rows: [],
            settings: { fastLength: 5, slowLength: 8 },
            source: 'store-v6-vmi-indicator-v2',
          },
        },
        klineRows: rows,
      },
    } satisfies StoreV6HistoryPageWindow

    const frame = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: null,
    }).frame

    expect(frame.panes.VMI).toMatchObject({
      paneId: 'vmi_pane',
      paneRole: 'sub',
      renderRole: 'sub-pane',
      rows: [
        expect.objectContaining({ barKey: rows[0].barKey, histogram: 0.1 }),
        expect.objectContaining({ barKey: rows[1].barKey, histogram: -0.2 }),
      ],
    })
  })

  it('passes MMF_V3 indicator rows from the history window into the final frame pane', () => {
    clearChartRenderCacheV2()
    const rows = [
      row(1_000, 2290, 'store-v6-page-slice-v2'),
      row(1_300, 2295, 'store-v6-page-slice-v2'),
    ]
    const history = {
      ...historyWindow(rows),
      indicators: {
        MMF_V3: {
          displayRows: [
            { barKey: rows[0].barKey, highMarker: 2300, time: rows[0].time, timestamp: rows[0].timestamp },
            { barKey: rows[1].barKey, lowMarker: 2280, time: rows[1].time, timestamp: rows[1].timestamp },
          ],
          key: 'MMF_V3:history:XAUUSDm:M5:1',
          paneId: 'candle_pane',
          paneRole: 'main',
          renderRole: 'main-overlay',
          rows: [],
          settings: { settings: { showHigh: true, showLow: true } },
          source: 'store-v6-mmf-v3-indicator-v2',
        },
      },
      renderData: {
        indicators: {
          MMF_V3: {
            displayRows: [
              { barKey: rows[0].barKey, highMarker: 2300, time: rows[0].time, timestamp: rows[0].timestamp },
              { barKey: rows[1].barKey, lowMarker: 2280, time: rows[1].time, timestamp: rows[1].timestamp },
            ],
            key: 'MMF_V3:history:XAUUSDm:M5:1',
            paneId: 'candle_pane',
            paneRole: 'main',
            renderRole: 'main-overlay',
            rows: [],
            settings: { settings: { showHigh: true, showLow: true } },
            source: 'store-v6-mmf-v3-indicator-v2',
          },
        },
        klineRows: rows,
      },
    } satisfies StoreV6HistoryPageWindow

    const frame = buildCachedKLineChartRenderFrameV2({
      historyWindow: history,
      realtimeWindow: null,
    }).frame

    expect(frame.panes.MMF_V3).toMatchObject({
      paneId: 'candle_pane',
      paneRole: 'main',
      renderRole: 'main-overlay',
      rows: [
        expect.objectContaining({ barKey: rows[0].barKey, highMarker: 2300 }),
        expect.objectContaining({ barKey: rows[1].barKey, lowMarker: 2280 }),
      ],
    })
  })
})
