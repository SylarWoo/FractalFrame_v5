import type { MorganRangeMode } from './morganRangeModel'

export type IndicatorWarmupName =
  | 'AO'
  | 'DPO'
  | 'MA'
  | 'MACD'
  | 'MMF_V3'
  | 'MR-M5'
  | 'MR-M30'
  | 'RSI'
  | 'SQZMOM'
  | 'Stoch'
  | 'TSI'
  | 'VDO'
  | 'VI'
  | 'VMI'
  | 'VWAP'
  | 'Vol'

export type IndicatorWarmupRequest = {
  name: IndicatorWarmupName | string
  settings?: unknown
  vdoSourceSettings?: unknown
  morganRangeMode?: MorganRangeMode
}

export type IndicatorWarmupEntry = {
  lookaheadRows: number
  name: string
  reason: string
  warmupRows: number
}

export type IndicatorWarmupPlan = {
  entries: IndicatorWarmupEntry[]
  lookaheadRows: number
  warmupRows: number
}

export function resolveIndicatorWarmupEntry(request: IndicatorWarmupRequest): IndicatorWarmupEntry {
  return {
    lookaheadRows: 0,
    name: request.name.trim(),
    reason: 'Warmup strategy is disabled while the indicator runtime base is stabilized',
    warmupRows: 0,
  }
}

export function planPageIndicatorWarmup({
  indicators,
}: {
  indicators: IndicatorWarmupRequest[]
  maxLookaheadRows?: number
  maxWarmupRows?: number
  period: string
}): IndicatorWarmupPlan {
  const entries = indicators.map((indicator) => resolveIndicatorWarmupEntry(indicator))
  return {
    entries,
    lookaheadRows: 0,
    warmupRows: 0,
  }
}
