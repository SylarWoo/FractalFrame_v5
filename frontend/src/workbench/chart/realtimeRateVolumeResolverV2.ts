import type { StoreV6QueryPayload } from '../../services/mt5/mt5SymbolsApi'
import { queryMt5Rates } from '../../services/mt5/mt5SymbolsApi'
import {
  resolveH2RealtimeRateVolumeForPeriodStartV2,
  resolveMt5RateVolumeForPeriodStartV2,
  type Mt5RealtimeWindowTick,
} from './realtimePageWindowV2'
import { resolvePeriodSeconds } from './chartTimeFormatting'

type QueryMt5RatesV2 = typeof queryMt5Rates

export function normalizeRealtimeRateTimeframeV2(period: string) {
  const value = period.trim().toUpperCase()
  if (value === 'H2') return 'M30'
  if (value === '1M' || value === 'M1') return 'M1'
  if (value === 'MN' || value === 'MN1') return 'MN1'
  if (/^\d+M$/.test(value)) return `M${value.slice(0, -1)}`
  if (/^\d+H$/.test(value)) return `H${value.slice(0, -1)}`
  return value
}

export function resolveRealtimeTickTimestampMsV2(tick: Mt5RealtimeWindowTick) {
  if (typeof tick.timeMsc === 'number' && Number.isFinite(tick.timeMsc)) {
    return tick.timeMsc < 1_000_000_000_000 ? tick.timeMsc * 1000 : tick.timeMsc
  }
  if (typeof tick.time === 'number' && Number.isFinite(tick.time)) {
    return tick.time < 1_000_000_000_000 ? tick.time * 1000 : tick.time
  }
  return Date.now()
}

export function resolveRealtimeTickPeriodStartSecondsV2(tick: Mt5RealtimeWindowTick, period: string) {
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) return null
  return Math.floor(resolveRealtimeTickTimestampMsV2(tick) / (periodSeconds * 1000)) * periodSeconds
}

function resolveRealtimeRateVolumeV2(options: {
  payload: StoreV6QueryPayload
  period: string
  periodStart: number
}) {
  return options.period.trim().toUpperCase() === 'H2'
    ? resolveH2RealtimeRateVolumeForPeriodStartV2(options.payload.rows, options.periodStart)
    : resolveMt5RateVolumeForPeriodStartV2(options.payload.rows, options.periodStart)
}

export function createRealtimeRateVolumeResolverV2(options: {
  apply: (tick: Mt5RealtimeWindowTick, barVolume: number | null) => void
  period: string
  queryRates?: QueryMt5RatesV2
  symbol: string
}) {
  let disposed = false
  let inFlight = false
  let latestTick: Mt5RealtimeWindowTick | null = null
  const queryRates = options.queryRates ?? queryMt5Rates

  const requestLatest = (sourceTick: Mt5RealtimeWindowTick) => {
    const tickPeriodStart = resolveRealtimeTickPeriodStartSecondsV2(sourceTick, options.period)
    if (tickPeriodStart == null) return
    inFlight = true
    void queryRates({
      limit: 3,
      symbol: options.symbol,
      timeframe: normalizeRealtimeRateTimeframeV2(options.period),
    })
      .then((payload) => {
        if (disposed) return
        const currentTick = latestTick ?? sourceTick
        const currentPeriodStart = currentTick
          ? resolveRealtimeTickPeriodStartSecondsV2(currentTick, options.period)
          : tickPeriodStart
        const barVolume = resolveRealtimeRateVolumeV2({
          payload,
          period: options.period,
          periodStart: currentPeriodStart ?? tickPeriodStart,
        })
        if (currentTick) options.apply(currentTick, barVolume)
      })
      .catch(() => {})
      .finally(() => {
        inFlight = false
        if (disposed) return
        const pendingTick = latestTick
        if (pendingTick && pendingTick !== sourceTick) requestLatest(pendingTick)
      })
  }

  return {
    dispose() {
      disposed = true
    },
    request(tick: Mt5RealtimeWindowTick) {
      latestTick = tick
      if (inFlight) return
      requestLatest(tick)
    },
  }
}
