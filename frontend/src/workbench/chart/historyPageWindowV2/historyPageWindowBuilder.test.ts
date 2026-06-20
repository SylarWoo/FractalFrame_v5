import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryStoreV6Ohlcv } from '../../../services/mt5/mt5SymbolsApi'
import type { StoreV6HistoryPageResult } from '../historyPageRequestV2'
import { createStoreV6IndicatorRegistryV2 } from '../indicatorRequestV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import {
  clearPersistedIndicatorsState,
  defaultMmfStochH2IndicatorSettings,
  defaultStochIndicatorSettings,
  readPersistedIndicatorsState,
  writePersistedIndicatorsState,
} from '../../rightDrawer/indicatorPersistence'
import { buildStoreV6HistoryPageWindow } from './historyPageWindowBuilder'

vi.mock('../../../services/mt5/mt5SymbolsApi', () => ({
  queryStoreV6Ohlcv: vi.fn(),
}))

function installStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => {
          values.delete(key)
        },
        setItem: (key: string, value: string) => {
          values.set(key, value)
        },
      },
    },
  })
}

function kline(time: number, globalIndex: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: 2,
    closeTime: time + 300,
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

function h2Kline(time: number, close: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|H2|${time}`,
    close,
    closeTime: time + 7200,
    globalIndex: time / 7200,
    high: 100,
    low: 0,
    open: close,
    period: 'H2',
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
  beforeEach(() => {
    installStorage()
    vi.mocked(queryStoreV6Ohlcv).mockReset()
    clearPersistedIndicatorsState('M5')
    clearPersistedIndicatorsState('H2')
  })

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
      request: expect.objectContaining({ id: 'TEST' }),
      warmupRows: source.slice.warmupRows,
      windowKind: 'history',
    }))
    expect(window.indicators.TEST.rows).toEqual([{ globalIndex: 2, value: 1 }])
    expect(window.renderData.indicators).toBe(window.indicators)
  })

  it('injects MMF_STOCH_H2 receiver events into an M5 history window from H2 source rows', async () => {
    const h2State = readPersistedIndicatorsState('H2')
    writePersistedIndicatorsState({
      ...h2State,
      loaded: {
        ...h2State.loaded,
        MMF_STOCH_H2: true,
      },
      mmfStochH2: {
        ...defaultMmfStochH2IndicatorSettings,
        passthroughPeriods: ['M5'],
        passthroughVisible: true,
        showEnterOverbought: true,
      },
      stoch: {
        ...defaultStochIndicatorSettings,
        dSmoothing: 1,
        kSmoothing: 1,
        length: 1,
      },
    }, 'H2')
    vi.mocked(queryStoreV6Ohlcv).mockResolvedValue({
      rows: [
        h2Kline(7200, 50),
        h2Kline(14400, 80),
      ],
    } as never)
    const displayRows = [kline(21000, 1), kline(21300, 2), kline(21600, 3)]
    const source: StoreV6HistoryPageResult = {
      ...historyPage(),
      pageIndex: 3,
      slice: {
        ...historyPage().slice,
        calculationRows: displayRows,
        displayOffset: 0,
        displayRows,
        key: 'XAUUSDm|M5|3|time|21000|21600',
        lookaheadRows: [],
        pageIndex: 3,
        warmupRows: [],
      },
    }

    const window = await buildStoreV6HistoryPageWindow({ historyPage: source })
    const indicator = window.renderData.indicators.MMF_STOCH_H2

    expect(indicator?.source).toBe('store-v6-mmf-stoch-h2-event-receiver-v2')
    expect((indicator?.settings as { eventStore?: { events?: unknown[] } }).eventStore?.events).toHaveLength(1)
    expect(indicator?.displayRows?.[1]).toEqual(expect.objectContaining({
      barKey: 'XAUUSDm|M5|21300',
      enterOverboughtMarker: 3,
      enterOverboughtMarkerPrice: 3,
    }))
  })
})
