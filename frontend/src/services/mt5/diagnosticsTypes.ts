export type Mt5DiagnosticsPayload = {
  ok: boolean
  status: string
  error?: string
  symbol?: string | null
  symbolSelectOk?: boolean
  terminal?: Record<string, unknown> | null
  account?: Record<string, unknown> | null
  publishedAt?: string
}

export type RuntimeObservabilityPayload = {
  ok: boolean
  status: string
  startedAt: string
  publishedAt: string
  paths: Record<string, string>
  jobs: Record<string, { count: number; failed: number }>
  activeOperations?: Array<{ symbol: string; operation: string }>
}

export type BridgeLogsPayload = {
  ok: boolean
  status: string
  path: string
  lines: string[]
}
