import { describe, expect, it, vi } from 'vitest'
import { queryStoreV6Ohlcv } from '../../services/mt5/mt5SymbolsApi'
import { materializeTimePageIndexRanges, type RealtimePageRow } from './pagePartitionManagerHelpers'

vi.mock('../../services/mt5/mt5SymbolsApi', () => ({
  queryStoreV6Ohlcv: vi.fn(),
}))

const queryStoreV6OhlcvMock = vi.mocked(queryStoreV6Ohlcv)

function page(timeFrom: number, timeTo: number): RealtimePageRow {
  return {
    fromGlobalIndex: null,
    identity: 'page',
    index: 1,
    limit: 1000,
    pageType: 'history',
    realtime: false,
    rows: null,
    timeFrom,
    timeTo,
    toGlobalIndex: null,
  }
}

describe('materializeTimePageIndexRanges', () => {
  it('keeps the planned H2 monthly page boundary after StoreV6 returns sparse actual rows', async () => {
    queryStoreV6OhlcvMock.mockResolvedValueOnce({
      metadata: {
        indexFromResult: 1,
        indexToResult: 2,
        timeFromResult: 10,
        timeToResult: 20,
      },
      rowsCount: 2,
    } as never)

    const result = await materializeTimePageIndexRanges({
      pages: [page(100, 200)],
      period: 'H2',
      symbol: 'XAUUSDm',
    })

    expect(result[0]).toMatchObject({
      fromGlobalIndex: 1,
      rows: 2,
      timeFrom: 100,
      timeTo: 200,
      toGlobalIndex: 2,
    })
  })
})
