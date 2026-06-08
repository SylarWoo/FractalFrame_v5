import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryStoreV6Ohlcv } from '../../../services/mt5/mt5SymbolsApi'
import { readStoreV6PageSlice } from './storeV6PageSliceReader'

vi.mock('../../../services/mt5/mt5SymbolsApi', () => ({
  queryStoreV6Ohlcv: vi.fn(),
}))

const queryMock = vi.mocked(queryStoreV6Ohlcv)

function row(time: number, globalIndex: number) {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: 2,
    globalIndex,
    high: 3,
    low: 1,
    open: 1.5,
    time,
    volume: 10,
  }
}

describe('readStoreV6PageSlice', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('reads a time page through StoreV6 time boundaries', async () => {
    queryMock.mockResolvedValueOnce({
      mode: 'aggregated',
      ok: true,
      rows: [row(100, 10), row(400, 11)],
      rowsCount: 2,
      symbol: 'XAUUSDm',
      timeframe: 'M5',
      metadata: {
        indexFromResult: 10,
        indexToResult: 11,
        timeFromResult: 100,
        timeToResult: 400,
      },
    })

    const slice = await readStoreV6PageSlice({
      page: {
        fromGlobalIndex: null,
        index: 1,
        limit: 2500,
        pageType: 'history',
        realtime: false,
        rows: null,
        timeFrom: 100,
        timeTo: 400,
        toGlobalIndex: null,
      },
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
      indexFrom: undefined,
      indexTo: undefined,
      limit: 2500,
      mode: 'aggregated',
      symbol: 'XAUUSDm',
      timeframe: 'M5',
      timeFrom: 100,
      timeTo: 400,
    }))
    expect(slice.displayRows).toHaveLength(2)
    expect(slice.boundary.actualFromGlobalIndex).toBe(10)
    expect(slice.boundary.actualToGlobalIndex).toBe(11)
    expect(slice.key).toBe('XAUUSDm|M5|1|time|100|400')
  })

  it('reads a rows page through StoreV6 globalIndex boundaries', async () => {
    queryMock.mockResolvedValueOnce({
      mode: 'aggregated',
      ok: true,
      rows: [row(100, 10), row(400, 11)],
      rowsCount: 2,
      symbol: 'XAUUSDm',
      timeframe: 'M5',
      metadata: {
        indexFromResult: 10,
        indexToResult: 11,
        timeFromResult: 100,
        timeToResult: 400,
      },
    })

    await readStoreV6PageSlice({
      page: {
        fromGlobalIndex: 10,
        index: 2,
        limit: 2,
        pageType: 'history',
        realtime: false,
        rows: 2,
        timeFrom: 100,
        timeTo: 400,
        toGlobalIndex: 11,
      },
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
      indexFrom: 10,
      indexTo: 11,
      limit: 2,
      timeFrom: undefined,
      timeTo: 400,
    }))
  })

  it('builds calculation rows from warmup, display, and lookahead slices', async () => {
    queryMock
      .mockResolvedValueOnce({
        mode: 'aggregated',
        ok: true,
        rows: [row(100, 10), row(400, 11)],
        rowsCount: 2,
        symbol: 'XAUUSDm',
        timeframe: 'M5',
        metadata: {
          indexFromResult: 10,
          indexToResult: 11,
          timeFromResult: 100,
          timeToResult: 400,
        },
      })
      .mockResolvedValueOnce({
        mode: 'aggregated',
        ok: true,
        rows: [row(-200, 9)],
        rowsCount: 1,
        symbol: 'XAUUSDm',
        timeframe: 'M5',
      })
      .mockResolvedValueOnce({
        mode: 'aggregated',
        ok: true,
        rows: [row(700, 12)],
        rowsCount: 1,
        symbol: 'XAUUSDm',
        timeframe: 'M5',
      })

    const slice = await readStoreV6PageSlice({
      lookaheadRows: 1,
      page: {
        fromGlobalIndex: null,
        index: 1,
        limit: 2,
        pageType: 'history',
        realtime: false,
        rows: 2,
        timeFrom: 100,
        timeTo: 400,
        toGlobalIndex: null,
      },
      period: 'M5',
      symbol: 'XAUUSDm',
      warmupRows: 1,
    })

    expect(queryMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      limit: 1,
      timeTo: 99,
    }))
    expect(queryMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      limit: 1,
      timeFrom: 700,
    }))
    expect(slice.warmupRows).toHaveLength(1)
    expect(slice.displayRows).toHaveLength(2)
    expect(slice.lookaheadRows).toHaveLength(1)
    expect(slice.calculationRows.map((item) => item.time)).toEqual([-200, 100, 400, 700])
    expect(slice.displayOffset).toBe(1)
  })
})
