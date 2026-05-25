export type BacktestRunStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed'

export type BacktestDataScope = {
  anchor?: string
  mode: 'direct' | 'aggregated'
  symbol: string
  timeframe: string
  timeFrom?: number
  timeTo?: number
}

export type BacktestRunSummary = {
  createdAt: string
  dataScope: BacktestDataScope
  id: string
  metrics?: Record<string, number | string | null>
  strategyName: string
  status: BacktestRunStatus
}
