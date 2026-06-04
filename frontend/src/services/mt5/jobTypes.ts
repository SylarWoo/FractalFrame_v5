import type { StoreV6AggregatePayload, StoreV6CheckPayload, StoreV6PullPayload } from './storeV6Types'

export type Mt5M1CheckJobPayload = {
  ok: boolean
  jobId: string
  symbol: string
  mode?: 'refresh' | 'incremental' | string
  phase: 'queued' | 'fetching' | 'validating' | 'completed' | 'failed' | 'cancelled' | string
  status: string
  error?: string
  chunkSize?: number
  maxCount?: number | null
  chunksCompleted?: number
  currentBatchIndex?: number
  currentBatchRequested?: number
  currentBatchFetched?: number
  mt5RowsCount?: number
  progressPercent?: number | null
  firstTimeText?: string | null
  lastTimeText?: string | null
  result?: StoreV6CheckPayload
}

export type StoreV6PullJobPayload = {
  ok: boolean
  jobId: string
  symbol: string
  mode: 'refresh' | 'incremental' | string
  phase: string
  status: string
  error?: string
  currentAction?: string
  progressPercent?: number | null
  progressLabel?: string
  sessionRuleId?: string | null
  sessionRuleVersion?: number | null
  detailMessage?: string
  rowsFetched?: number
  rowsWritten?: number
  rawRowsCount?: number
  duplicateRows?: number
  trueM1RowsCount?: number
  discardedBeforeTrueM1RowsCount?: number
  gapCount?: number
  validationPreviewStatus?: string
  chunksCompleted?: number
  fetchChunkSize?: number
  maxCount?: number | null
  currentBatchIndex?: number
  currentBatchRequested?: number
  currentBatchFetched?: number
  probedRowsCount?: number
  writeBatchStart?: number
  writeBatchRows?: number
  writeBatchWritten?: number
  pendingWriteRows?: number
  writeBatchSize?: number
  cleanupStatus?: string
  cleanupDeletedRows?: number
  cleanupKeptRows?: number
  firstTimeText?: string | null
  lastTimeText?: string | null
  result?: StoreV6PullPayload
  createdAt?: string
  updatedAt?: string
}

export type StoreV6AggregateJobPayload = {
  ok: boolean
  jobId: string
  symbol: string
  phase: string
  status: string
  error?: string
  targets?: string[]
  currentTarget?: string | null
  currentIndex?: number
  totalTargets?: number
  progressPercent?: number | null
  progressLabel?: string
  sessionRuleId?: string | null
  sessionRuleVersion?: number | null
  aggregateBatchSize?: number
  currentBatchIndex?: number
  currentBatchTotal?: number
  sourceRowsProcessed?: number
  sourceRowsTotal?: number
  rowsWritten?: number
  results?: StoreV6AggregatePayload['results']
  result?: StoreV6AggregatePayload
  periods: string[]
  currentPeriod?: string
  completed: number
  total: number
}
