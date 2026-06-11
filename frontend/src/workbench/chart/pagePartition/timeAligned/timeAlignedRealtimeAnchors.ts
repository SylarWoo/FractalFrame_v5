import {
  h2TradingFourMonthProfile,
  m30TradingMonthProfile,
  m5TradingDaySlidingWeekProfile,
} from './timeAlignedPageTypes'
import { resolveH2RealtimeOpenFromHistoryClose } from './h2TradingMonthAnchors'
import { resolveM30RealtimeOpenFromHistoryClose } from './m30TradingAnchors'
import { resolveM5RealtimeOpenFromHistoryClose } from './m5TradingAnchors'

export function resolveTimeAlignedRealtimeOpenFromHistoryClose(options: {
  historyTo: number | null | undefined
  period: string | null | undefined
  symbol: string | null | undefined
}) {
  const period = String(options.period ?? '').trim().toUpperCase()
  if (period === 'M30') {
    return resolveM30RealtimeOpenFromHistoryClose({
      historyTo: options.historyTo,
      profile: m30TradingMonthProfile,
      symbol: options.symbol,
    })
  }
  if (period === 'H2') {
    return resolveH2RealtimeOpenFromHistoryClose({
      historyTo: options.historyTo,
      profile: h2TradingFourMonthProfile,
    })
  }
  if (period === 'M5') {
    return resolveM5RealtimeOpenFromHistoryClose({
      historyTo: options.historyTo,
      profile: m5TradingDaySlidingWeekProfile,
      symbol: options.symbol,
    })
  }
  return null
}
