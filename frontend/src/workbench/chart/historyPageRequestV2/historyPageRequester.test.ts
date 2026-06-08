import { describe, expect, it, vi } from 'vitest'
import type { StoreV6PagePartitionItem } from '../pagePartition/pagePartitionBuilder'
import type { StoreV6PageSlice } from '../pageSliceV2'
import {
  requestStoreV6HistoryPage,
  StoreV6HistoryPageRequestError,
} from './historyPageRequester'

function page(index: number): StoreV6PagePartitionItem {
  return {
    fromGlobalIndex: null,
    index,
    limit: 2500,
    pageType: index === 1 ? 'live' : 'history',
    realtime: index === 1,
    rows: null,
    timeFrom: 1000 - index * 100,
    timeTo: 1099 - index * 100,
    toGlobalIndex: null,
  }
}

function slice(pageIndex: number): StoreV6PageSlice {
  return {
    boundary: {
      actualFromGlobalIndex: 10,
      actualTimeFrom: 100,
      actualTimeTo: 200,
      actualToGlobalIndex: 20,
      requestedFromGlobalIndex: null,
      requestedTimeFrom: 100,
      requestedTimeTo: 200,
      requestedToGlobalIndex: null,
    },
    calculationRows: [],
    displayOffset: 0,
    displayRows: [],
    key: `slice-${pageIndex}`,
    lookaheadRows: [],
    mode: 'history-page',
    pageIndex,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    warmupRows: [],
  }
}

describe('requestStoreV6HistoryPage', () => {
  it('requests page 1 by default', async () => {
    const readSlice = vi.fn().mockResolvedValue(slice(1))
    const pages = [page(1), page(2)]

    const result = await requestStoreV6HistoryPage({
      pages,
      period: 'M5',
      symbol: 'XAUUSDm',
    }, readSlice)

    expect(readSlice).toHaveBeenCalledWith({
      lookaheadRows: undefined,
      mode: 'history-page',
      page: pages[0],
      period: 'M5',
      symbol: 'XAUUSDm',
      warmupRows: undefined,
    })
    expect(result.pageIndex).toBe(1)
    expect(result.page).toBe(pages[0])
    expect(result.slice.key).toBe('slice-1')
  })

  it('requests the selected history page by page index', async () => {
    const readSlice = vi.fn().mockResolvedValue(slice(2))
    const pages = [page(1), page(2)]

    const result = await requestStoreV6HistoryPage({
      lookaheadRows: 5,
      pageIndex: 2,
      pages,
      period: 'M5',
      symbol: 'XAUUSDm',
      warmupRows: 10,
    }, readSlice)

    expect(readSlice).toHaveBeenCalledWith(expect.objectContaining({
      lookaheadRows: 5,
      mode: 'history-page',
      page: pages[1],
      warmupRows: 10,
    }))
    expect(result.pageIndex).toBe(2)
    expect(result.status).toBe('ready')
    expect(result.source).toBe('store-v6-history-page-request-v2')
  })

  it('throws when the requested page does not exist', async () => {
    const readSlice = vi.fn()

    await expect(requestStoreV6HistoryPage({
      pageIndex: 9,
      pages: [page(1)],
      period: 'M5',
      symbol: 'XAUUSDm',
    }, readSlice)).rejects.toMatchObject({
      code: 'missing_page',
    })
    expect(readSlice).not.toHaveBeenCalled()
  })

  it('throws when symbol or period is missing', async () => {
    await expect(requestStoreV6HistoryPage({
      pages: [page(1)],
      period: '',
      symbol: 'XAUUSDm',
    })).rejects.toBeInstanceOf(StoreV6HistoryPageRequestError)
  })
})
