import { getMt5Json } from './mt5ApiClient'
import type { Mt5DiagnosticsPayload, RuntimeObservabilityPayload } from './types'

export async function fetchMt5Diagnostics(symbol?: string): Promise<Mt5DiagnosticsPayload> {
  const params = new URLSearchParams()
  if (symbol) params.set('symbol', symbol)
  return getMt5Json<Mt5DiagnosticsPayload>('/api/market-data/v1/diagnostics/mt5', params)
}

export async function fetchRuntimeObservability(): Promise<RuntimeObservabilityPayload> {
  return getMt5Json<RuntimeObservabilityPayload>('/api/market-data/v1/diagnostics/runtime')
}
