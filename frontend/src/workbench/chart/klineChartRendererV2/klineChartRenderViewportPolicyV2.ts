import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'

export type KLineChartHistoryRealtimeModeV2 = 'visual' | 'background'

export function shouldDisplayRealtimeForHistoryPageV2(historyWindow: StoreV6HistoryPageWindow | null) {
  return resolveRealtimeModeForHistoryPageV2(historyWindow) === 'visual'
}

export function resolveRealtimeModeForHistoryPageV2(historyWindow: StoreV6HistoryPageWindow | null): KLineChartHistoryRealtimeModeV2 {
  return (historyWindow?.pageIndex ?? 1) <= 1 ? 'visual' : 'background'
}
