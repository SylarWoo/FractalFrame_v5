import { createMt5EventSource } from './mt5ApiClient'

export function createMt5TicksEventSource(symbols: string[], intervalMs = 500): EventSource {
  const params = new URLSearchParams()
  params.set('symbols', symbols.join(','))
  params.set('intervalMs', String(intervalMs))
  return createMt5EventSource('/api/market-data/v1/mt5/ticks/events', params)
}
