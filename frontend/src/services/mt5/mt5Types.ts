export type Mt5SymbolRow = {
  symbol: string
  name?: string
  description?: string
  path?: string
  category?: string
  source?: string
  market?: string
  visible?: boolean
  select?: boolean | null
  custom?: boolean | null
  digits?: number | null
  point?: number | null
  spread?: number | null
  spreadFloat?: boolean | null
  currencyBase?: string
  currencyProfit?: string
  currencyMargin?: string
  tradeMode?: number | null
  tradeCalcMode?: number | null
  tradeContractSize?: number | null
  volumeMin?: number | null
  volumeMax?: number | null
  volumeStep?: number | null
  tradeTickSize?: number | null
  tradeTickValue?: number | null
  tradeStopsLevel?: number | null
  seenAt?: string
  lastSeenAt?: string
  missingFromLatestScan?: boolean | null
  tradeExeMode?: number | null
  orderMode?: number | null
  fillingMode?: number | null
  expirationMode?: number | null
  expirationTime?: number | null
  orderGtcMode?: number | null
  swapMode?: number | null
  swapLong?: number | null
  swapShort?: number | null
  swapRollover3Days?: number | null
  sessions?: {
    quote?: string[]
    trade?: string[]
  }
  sessionsPath?: string
  sessionsSource?: string
  sessionsUpdatedAt?: string
}

export type Mt5SymbolsPayload = {
  ok: boolean
  status: string
  count: number
  totalCount?: number
  symbols: Mt5SymbolRow[]
  error?: string
  scanReport?: {
    added?: number
    updated?: number
  }
  cache?: {
    ready?: boolean
    updatedAt?: string
    lastScanReport?: {
      added?: number
      updated?: number
    }
  }
}

export type Mt5RealtimeTick = {
  symbol: string
  bid?: number | null
  ask?: number | null
  last?: number | null
  volume?: number | null
  time?: number | null
  timeMsc?: number | null
  dayOpen?: number | null
  change?: number | null
  changePercent?: number | null
  publishedAt?: string
}

export type Mt5MarketStatusValue = 'open' | 'closed' | 'unknown'

export type Mt5MarketStatus = {
  status: Mt5MarketStatusValue
  label?: string
  lastM1Time?: number | null
  lastM1TimeMsc?: number | null
  lastM1Iso?: string | null
  lastTickTime?: number | null
  lastTickTimeMsc?: number | null
  serverTime?: number | null
  serverTimeIso?: string | null
  ageSeconds?: number | null
  tickAgeSeconds?: number | null
  staleSeconds?: number | null
  tradeMode?: number | null
  reason?: string
}

export type Mt5MarketStatusPayload = {
  ok: boolean
  status: string
  symbol?: string
  marketStatus?: Mt5MarketStatus | null
  error?: string
  publishedAt?: string
}
