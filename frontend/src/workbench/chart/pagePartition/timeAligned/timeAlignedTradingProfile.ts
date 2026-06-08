const continuousCryptoPrefixes = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'LTC', 'BCH', 'DOT', 'AVAX', 'TRX', 'LINK']

export type TimeAlignedTradingProfile = {
  boundaryHourShanghai: number
  boundaryMinuteShanghai: number
  dailyMaintenance?: {
    closeHourShanghai: number
    closeMinuteShanghai: number
    openHourShanghai: number
    openMinuteShanghai: number
  } | null
  weekendClosed: boolean
}

function isContinuousCryptoSymbol(symbol: string | null | undefined) {
  const normalized = String(symbol ?? '').toUpperCase()
  return continuousCryptoPrefixes.some((prefix) => normalized.startsWith(prefix))
}

export function resolveTimeAlignedTradingProfile(symbol: string | null | undefined): TimeAlignedTradingProfile {
  if (isContinuousCryptoSymbol(symbol)) {
    return {
      boundaryHourShanghai: 6,
      boundaryMinuteShanghai: 0,
      dailyMaintenance: null,
      weekendClosed: false,
    }
  }
  return {
    boundaryHourShanghai: 6,
    boundaryMinuteShanghai: 0,
    dailyMaintenance: {
      closeHourShanghai: 5,
      closeMinuteShanghai: 0,
      openHourShanghai: 6,
      openMinuteShanghai: 0,
    },
    weekendClosed: true,
  }
}

export function shouldSkipClosedWeekends(symbol: string | null | undefined) {
  return resolveTimeAlignedTradingProfile(symbol).weekendClosed
}
