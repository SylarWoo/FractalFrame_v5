import { describe, expect, it } from 'vitest'
import {
  formatChartLoadStatus,
  formatStoreOperationLine,
  resolveLocalM1Rows,
  resolveStoreOperationProgress,
  storeTableKeyForPeriod,
} from './storeV5StatusFormat'
import type { StoreV5CheckPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'

describe('StoreV5 status formatting', () => {
  it('formats pull progress from structured job state', () => {
    const job: StoreV5PullJobPayload = {
      ok: true,
      jobId: 'job-1',
      symbol: 'XAUUSDm',
      mode: 'incremental',
      phase: 'fetching',
      status: 'fetching',
      rowsFetched: 120000,
      fetchChunkSize: 200000,
    }

    expect(formatStoreOperationLine(job, null, null, 'idle')).toContain('开始读取')
  })

  it('uses numeric progress percent when available', () => {
    const job: StoreV5PullJobPayload = {
      ok: true,
      jobId: 'job-1',
      symbol: 'XAUUSDm',
      mode: 'incremental',
      phase: 'fetching',
      status: 'fetching',
      progressPercent: 42,
    }

    expect(resolveStoreOperationProgress(job, null, null)).toEqual({ hasEstimate: true, width: 42 })
  })

  it('resolves local M1 rows from legacy and current status shapes', () => {
    const status: StoreV5CheckPayload = {
      ok: true,
      status: 'ok',
      symbol: 'XAUUSDm',
      directM1: null,
      rawDirectM1: { rawRowsCount: 12 },
      aggregated: [],
    }

    expect(resolveLocalM1Rows(status)).toBe(12)
  })

  it('maps store table keys and chart load status consistently', () => {
    expect(storeTableKeyForPeriod('m1')).toBe('m1-M1')
    expect(storeTableKeyForPeriod('h4')).toBe('aggregate-H4')
    expect(formatChartLoadStatus({
      error: false,
      loading: false,
      loadingMore: true,
      period: 'H4',
      requestedRows: 10000,
      rows: 500,
      symbol: 'XAUUSDm',
      totalRows: 20000,
    })).toContain('加载历史')
  })
})
