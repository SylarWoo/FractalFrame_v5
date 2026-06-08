import type { KLineData } from 'klinecharts'

export type StoreV6WindowKLine = KLineData & {
  barKey: string
  globalIndex: number | null
  period: string
  sessionId?: string
  source: 'store-v6-page-slice-v2' | 'mt5-realtime-window-v2'
  symbol: string
  time: number
  tradingDay?: string
}
