import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchMt5Symbols,
  queryStoreV5Ohlcv,
  startStoreV5AggregateJob,
  startStoreV5PullJob,
} from './mt5SymbolsApi'

function mockFetch(payload: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    void url
    void options
    return {
      json: async () => payload,
      ok,
      status,
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('mt5SymbolsApi', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds MT5 symbol query URLs with defaults and refresh flag', async () => {
    const fetchMock = mockFetch({ ok: true, status: 'ok', count: 0, symbols: [] })

    await fetchMt5Symbols({ query: 'xau', refresh: true })

    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/mt5/symbols?query=xau&limit=50000&refresh=1')
    expect(options).toMatchObject({ cache: 'no-store', headers: { Accept: 'application/json' } })
  })

  it('builds StoreV5 query URLs with optional parameters', async () => {
    const fetchMock = mockFetch({
      ok: true,
      symbol: 'XAUUSDm',
      timeframe: 'H4',
      mode: 'aggregated',
      rowsCount: 0,
      rows: [],
    })

    await queryStoreV5Ohlcv({
      anchor: 'UTC2200',
      baseTimeframe: 'M1',
      limit: 10,
      mode: 'aggregated',
      symbol: 'XAUUSDm',
      timeFrom: 100,
      timeTo: 200,
      timeframe: 'H4',
    })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v5/query?symbol=XAUUSDm&timeframe=H4&mode=aggregated&baseTimeframe=M1&anchor=UTC2200&timeFrom=100&timeTo=200&limit=10')
  })

  it('throws stable API error messages from payloads', async () => {
    mockFetch({ ok: false, status: 'bad_status', error: 'bad request' }, false, 400)

    await expect(fetchMt5Symbols()).rejects.toThrow('bad request')
  })

  it('does not require ok=true for async job start responses when HTTP succeeds', async () => {
    const pullPayload = {
      ok: false,
      jobId: 'pull-1',
      symbol: 'XAUUSDm',
      mode: 'refresh',
      phase: 'queued',
      status: 'queued',
    }
    mockFetch(pullPayload, true)

    await expect(startStoreV5PullJob('XAUUSDm')).resolves.toEqual(pullPayload)

    const aggregatePayload = {
      ok: false,
      jobId: 'aggregate-1',
      symbol: 'XAUUSDm',
      phase: 'queued',
      status: 'queued',
      periods: ['H4'],
      completed: 0,
      total: 1,
    }
    mockFetch(aggregatePayload, true)

    await expect(startStoreV5AggregateJob('XAUUSDm', ['H4'])).resolves.toEqual(aggregatePayload)
  })

  it('passes rebuild flag when starting aggregate jobs', async () => {
    const fetchMock = mockFetch({
      ok: true,
      jobId: 'aggregate-1',
      symbol: 'XAUUSDm',
      phase: 'queued',
      status: 'queued',
      periods: ['H4'],
      completed: 0,
      total: 1,
    }, true)

    await startStoreV5AggregateJob('XAUUSDm', ['H4'], { rebuild: true })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v5/aggregate/start?symbol=XAUUSDm&rebuild=1&timeframes=H4')
  })
})
