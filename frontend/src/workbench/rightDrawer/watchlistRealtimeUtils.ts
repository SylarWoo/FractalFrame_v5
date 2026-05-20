import type { Mt5RealtimeTick } from '../../services/mt5/mt5SymbolsApi'

export const watchlistRealtimeLogLimit = 8

export function appendWatchlistRealtimeLog(current: string[], message: string, timestamp: string) {
  return [`${timestamp}  ${message}`, ...current].slice(0, watchlistRealtimeLogLimit)
}

export function mergeWatchlistRealtimeTicks(
  current: Record<string, Mt5RealtimeTick>,
  ticks: Mt5RealtimeTick[],
) {
  const next = { ...current }
  ticks.forEach((tick) => {
    if (tick.symbol) next[tick.symbol] = tick
  })
  return next
}
