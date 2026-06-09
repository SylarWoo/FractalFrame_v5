import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchStoreV6Check, queryStoreV6Ohlcv } from '../../../services/mt5/mt5SymbolsApi'
import { storageKeys } from '../../persistence/storageKeys'
import {
  restoreKLineChartRenderPageTargetV2,
  writeKLineChartRenderPageConfigV2,
} from './klineChartRenderPageConfigV2'

vi.mock('../../../services/mt5/mt5SymbolsApi', () => ({
  fetchStoreV6Check: vi.fn(),
  queryStoreV6Ohlcv: vi.fn(),
}))

const fetchStoreV6CheckMock = vi.mocked(fetchStoreV6Check)
const queryStoreV6OhlcvMock = vi.mocked(queryStoreV6Ohlcv)

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

function createLocalStorage() {
  const values = new Map<string, string>()
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('klineChartRenderPageConfigV2', () => {
  beforeEach(() => {
    const localStorage = createLocalStorage()
    vi.stubGlobal('window', {
      localStorage,
      location: { origin: 'http://127.0.0.1:5185' },
    })
    vi.stubGlobal('fetch', undefined)
    vi.stubGlobal('XMLHttpRequest', undefined)
    localStorage.removeItem(storageKeys.realtimePageIndexCache)
    fetchStoreV6CheckMock.mockReset()
    queryStoreV6OhlcvMock.mockReset()
  })

  it('restores a refreshed history page by rebuilding the full M5 page list when page-index cache is missing', async () => {
    const latestTime = shanghaiSeconds(2026, 6, 9, 6, 5)
    fetchStoreV6CheckMock.mockResolvedValue({
      aggregated: [{
        lastTime: latestTime,
        rowsCount: '8,200',
        timeframe: 'M5',
      }],
    } as never)
    queryStoreV6OhlcvMock.mockResolvedValue({
      metadata: {
        indexFromResult: 10,
        indexToResult: 11,
        timeFromResult: shanghaiSeconds(2026, 5, 22, 6, 0),
        timeToResult: shanghaiSeconds(2026, 5, 30, 5, 0) - 1,
      },
      mode: 'aggregated',
      ok: true,
      rows: [{
        barKey: 'XAUUSDm|M5|1',
        close: 2,
        globalIndex: 10,
        high: 3,
        low: 1,
        open: 1.5,
        time: shanghaiSeconds(2026, 5, 22, 6, 0),
        volume: 10,
      }, {
        barKey: 'XAUUSDm|M5|2',
        close: 2,
        globalIndex: 11,
        high: 3,
        low: 1,
        open: 1.5,
        time: shanghaiSeconds(2026, 5, 30, 5, 0) - 1,
        volume: 10,
      }],
      rowsCount: 2,
      symbol: 'XAUUSDm',
      timeframe: 'M5',
    } as never)

    writeKLineChartRenderPageConfigV2({
      page: {
        fromGlobalIndex: null,
        index: 2,
        limit: 2,
        realtime: false,
        rows: 2,
        timeFrom: 1,
        timeTo: 2,
        toGlobalIndex: null,
      },
      period: 'M5',
      realtimeEnabled: false,
      symbol: 'XAUUSDm',
      totalRows: 8_200,
    })

    const target = await restoreKLineChartRenderPageTargetV2()

    expect(target?.page.index).toBe(2)
    expect(target?.historyPageWindow.historyRows).toHaveLength(2)
    expect(queryStoreV6OhlcvMock).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'XAUUSDm',
      timeframe: 'M5',
      timeFrom: shanghaiSeconds(2026, 5, 22, 6, 0),
      timeTo: shanghaiSeconds(2026, 5, 30, 5, 0) - 1,
    }))
  })

  it('restores M30 from the saved period config without requiring the history drawer page cache to be mounted', async () => {
    const latestTime = shanghaiSeconds(2026, 6, 10, 6, 30)
    fetchStoreV6CheckMock.mockResolvedValue({
      aggregated: [{
        lastTime: latestTime,
        rowsCount: '109,471',
        timeframe: 'M30',
      }],
    } as never)
    queryStoreV6OhlcvMock.mockResolvedValue({
      metadata: {
        indexFromResult: 100,
        indexToResult: 101,
        timeFromResult: shanghaiSeconds(2026, 5, 11, 6, 0),
        timeToResult: shanghaiSeconds(2026, 6, 6, 5, 0) - 1,
      },
      mode: 'aggregated',
      ok: true,
      rows: [{
        barKey: 'XAUUSDm|M30|1',
        close: 2,
        globalIndex: 100,
        high: 3,
        low: 1,
        open: 1.5,
        time: shanghaiSeconds(2026, 5, 11, 6, 0),
        volume: 10,
      }, {
        barKey: 'XAUUSDm|M30|2',
        close: 2,
        globalIndex: 101,
        high: 3,
        low: 1,
        open: 1.5,
        time: shanghaiSeconds(2026, 6, 6, 5, 0) - 1,
        volume: 10,
      }],
      rowsCount: 2,
      symbol: 'XAUUSDm',
      timeframe: 'M30',
    } as never)

    writeKLineChartRenderPageConfigV2({
      pageIndex: 1,
      period: 'M30',
      realtimeEnabled: true,
      symbol: 'XAUUSDm',
      totalRows: 109_471,
    })

    const target = await restoreKLineChartRenderPageTargetV2()

    expect(target?.period).toBe('M30')
    expect(target?.page.index).toBe(1)
    expect(target?.historyPageWindow.historyRows).toHaveLength(2)
    expect(queryStoreV6OhlcvMock).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'XAUUSDm',
      timeframe: 'M30',
      timeFrom: shanghaiSeconds(2026, 5, 11, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 6, 5, 0) - 1,
    }))
  })
})
