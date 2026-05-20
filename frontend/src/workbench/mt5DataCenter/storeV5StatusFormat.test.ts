import { describe, expect, it } from 'vitest'
import { formatStoreOperationLine, resolveStoreOperationProgress } from './storeV5StatusFormat'
import type { StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'

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
})
