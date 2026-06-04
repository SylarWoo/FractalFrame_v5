import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelStoreV6AggregateJob,
  cancelStoreV6AggregateJobsForSymbol,
  auditStoreV6,
  fetchStoreV6DailyMaintenanceEvents,
  fetchStoreV6DailyMaintenanceStatus,
  fetchMt5Symbols,
  queryStoreV6Ohlcv,
  startStoreV6AggregateJob,
  startStoreV6DailyMaintenance,
  startStoreV6PullJob,
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

  it('includes session export flag for full MT5 symbol detail scans', async () => {
    const fetchMock = mockFetch({ ok: true, status: 'ok', count: 0, symbols: [] })

    await fetchMt5Symbols({ includeSessions: true, refresh: true })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/mt5/symbols?limit=50000&refresh=1&sessions=1')
  })

  it('builds StoreV6 query URLs with optional parameters', async () => {
    const fetchMock = mockFetch({
      ok: true,
      symbol: 'XAUUSDm',
      timeframe: 'H4',
      mode: 'aggregated',
      rowsCount: 0,
      rows: [],
    })

    await queryStoreV6Ohlcv({
      anchor: 'UTC2200',
      baseTimeframe: 'M1',
      indexFrom: 300,
      indexTo: 399,
      limit: 10,
      mode: 'aggregated',
      symbol: 'XAUUSDm',
      timeFrom: 100,
      timeTo: 200,
      timeframe: 'H4',
    })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v6/query?symbol=XAUUSDm&timeframe=H4&mode=aggregated&baseTimeframe=M1&anchor=UTC2200&indexFrom=300&indexTo=399&timeFrom=100&timeTo=200&limit=10')
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

    await expect(startStoreV6PullJob('XAUUSDm')).resolves.toEqual(pullPayload)

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

    await expect(startStoreV6AggregateJob('XAUUSDm', ['H4'])).resolves.toEqual(aggregatePayload)
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

    await startStoreV6AggregateJob('XAUUSDm', ['H4'], { rebuild: true })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v6/aggregate/start?symbol=XAUUSDm&rebuild=1&timeframes=H4')
  })

  it('builds StoreV6 aggregate cancel URLs', async () => {
    const fetchMock = mockFetch({
      ok: true,
      jobId: 'aggregate-1',
      symbol: 'XAUUSDm',
      phase: 'cancelled',
      status: 'cancelled',
      periods: ['H4'],
      completed: 0,
      total: 1,
    }, true)

    await cancelStoreV6AggregateJob('aggregate-1')

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v6/aggregate/cancel?jobId=aggregate-1')
  })

  it('builds StoreV6 aggregate cancel-by-symbol URLs', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 'store_v6_aggregate_cancel_requested',
      symbol: 'XAUUSDm',
      cancelledCount: 2,
      jobs: [],
    }, true)

    await cancelStoreV6AggregateJobsForSymbol('XAUUSDm')

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v6/aggregate/cancel?symbol=XAUUSDm')
  })

  it('builds StoreV6 audit repair URLs', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 'store_v6_audit_repaired',
      symbol: 'XAUUSDm',
      checkedDatasets: 3,
      issueDatasets: 1,
      repairedDatasets: 1,
      datasets: [],
    }, true)

    await auditStoreV6('XAUUSDm', { repair: true })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v6/audit?symbol=XAUUSDm&repair=1')
  })

  it('builds StoreV6 daily maintenance URLs', async () => {
    const fetchMock = mockFetch({ ok: true, status: 'ok', today: '2026-06-03', records: [] }, true)

    await fetchStoreV6DailyMaintenanceStatus('XAUUSDm')
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v6/daily-maintenance/status?symbol=XAUUSDm')

    mockFetch({ ok: true, status: 'ok', count: 0, events: [] }, true)
    await fetchStoreV6DailyMaintenanceEvents('XAUUSDm', 50)
    expect(String((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v6/daily-maintenance/events?symbol=XAUUSDm&limit=50')

    mockFetch({ ok: true, status: 'queued', symbol: 'XAUUSDm' }, true)
    await startStoreV6DailyMaintenance('XAUUSDm')
    expect(String((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toBe('http://127.0.0.1:8765/api/market-data/v1/store-v6/daily-maintenance/start?symbol=XAUUSDm&trigger=manual')
  })
})
