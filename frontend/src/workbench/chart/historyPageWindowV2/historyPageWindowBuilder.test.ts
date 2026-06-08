import { describe, expect, it, vi } from 'vitest'
import type { StoreV6HistoryPageResult } from '../historyPageRequestV2'
import { createStoreV6IndicatorRegistryV2 } from '../indicatorRequestV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { buildStoreV6HistoryPageWindow } from './historyPageWindowBuilder'

function kline(time: number, globalIndex: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: 2,
    globalIndex,
    high: 3,
    low: 1,
    open: 1.5,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: 10,
  }
}

function historyPage(): StoreV6HistoryPageResult {
  const warmupRows = [kline(100, 1)]
  const displayRows = [kline(400, 2), kline(700, 3)]
  const lookaheadRows = [kline(1000, 4)]
  return {
    page: {
      fromGlobalIndex: null,
      index: 1,
      limit: 2,
      pageType: 'history',
      realtime: false,
      rows: 2,
      timeFrom: 400,
      timeTo: 700,
      toGlobalIndex: null,
    },
    pageIndex: 1,
    slice: {
      boundary: {
        actualFromGlobalIndex: 2,
        actualTimeFrom: 400,
        actualTimeTo: 700,
        actualToGlobalIndex: 3,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 400,
        requestedTimeTo: 700,
        requestedToGlobalIndex: null,
      },
      calculationRows: [...warmupRows, ...displayRows, ...lookaheadRows],
      displayOffset: 1,
      displayRows,
      key: 'XAUUSDm|M5|1|time|400|700',
      lookaheadRows,
      mode: 'history-page',
      pageIndex: 1,
      period: 'M5',
      source: 'store-v6-page-slice-v2',
      symbol: 'XAUUSDm',
      warmupRows,
    },
    source: 'store-v6-history-page-request-v2',
    status: 'ready',
  }
}

describe('buildStoreV6HistoryPageWindow', () => {
  it('builds a ready history page window from a history page slice', async () => {
    const source = historyPage()

    const window = await buildStoreV6HistoryPageWindow({ historyPage: source })

    expect(window.source).toBe('store-v6-history-page-window-v2')
    expect(window.status).toBe('ready')
    expect(window.key).toBe('history-window-v2:XAUUSDm|M5|1|time|400|700')
    expect(window.historyRows).toBe(source.slice.displayRows)
    expect(window.renderData.klineRows).toBe(source.slice.displayRows)
    expect(window.calculationRows).toBe(source.slice.calculationRows)
    expect(window.warmupRows).toBe(source.slice.warmupRows)
    expect(window.displayOffset).toBe(1)
    expect(window.indicators).toEqual({})
  })

  it('passes calculation context into the future indicator preloader hook', async () => {
    const source = historyPage()
    const indicatorPreloader = vi.fn().mockResolvedValue({
      TEST: {
        key: 'TEST',
        rows: [{ value: 1 }],
        source: 'test-indicator-preloader',
      },
    })

    const window = await buildStoreV6HistoryPageWindow({
      historyPage: source,
      indicatorPreloader,
    })

    expect(indicatorPreloader).toHaveBeenCalledWith({
      boundary: source.slice.boundary,
      calculationRows: source.slice.calculationRows,
      displayOffset: source.slice.displayOffset,
      displayRows: source.slice.displayRows,
      pageIndex: 1,
      period: 'M5',
      symbol: 'XAUUSDm',
      warmupRows: source.slice.warmupRows,
    })
    expect(window.indicators.TEST.rows).toEqual([{ value: 1 }])
    expect(window.renderData.indicators).toBe(window.indicators)
  })

  it('requests history indicators through the v2 indicator controller', async () => {
    const source = historyPage()
    const registry = createStoreV6IndicatorRegistryV2()
    const calculateHistory = vi.fn().mockReturnValue({
      TEST: {
        key: 'TEST',
        rows: [{ globalIndex: 2, value: 1 }],
        source: 'test-indicator-controller',
      },
    })
    registry.register({
      calculateHistory,
      id: 'test',
    })

    const window = await buildStoreV6HistoryPageWindow({
      historyPage: source,
      indicatorRegistry: registry,
      indicatorRequests: [{ id: 'test' }],
    })

    expect(calculateHistory).toHaveBeenCalledWith(expect.objectContaining({
      boundary: source.slice.boundary,
      calculationRows: source.slice.calculationRows,
      displayRows: source.slice.displayRows,
      pageIndex: 1,
      request: { id: 'TEST' },
      warmupRows: source.slice.warmupRows,
      windowKind: 'history',
    }))
    expect(window.indicators.TEST.rows).toEqual([{ globalIndex: 2, value: 1 }])
    expect(window.renderData.indicators).toBe(window.indicators)
  })
})
