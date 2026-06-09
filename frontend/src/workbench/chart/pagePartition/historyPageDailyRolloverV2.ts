import { resolveTimeAlignedTradingProfile } from './timeAligned/timeAlignedTradingProfile'

const shanghaiOffsetMs = 8 * 60 * 60 * 1000
const dayMs = 24 * 60 * 60 * 1000
const rolloverDelayAfterCloseMs = 60_000

export const historyPageDailyRolloverRebuildEvent = 'fractalframe:history-page-daily-rollover-rebuild'

export type HistoryPageDailyRolloverRebuildDetail = {
  period?: string | null
  reason: 'daily-close'
  symbol?: string | null
}

export function dispatchHistoryPageDailyRolloverRebuild(options: {
  period?: string | null
  symbol?: string | null
}) {
  window.dispatchEvent(new CustomEvent<HistoryPageDailyRolloverRebuildDetail>(historyPageDailyRolloverRebuildEvent, {
    detail: {
      period: options.period ?? null,
      reason: 'daily-close',
      symbol: options.symbol ?? null,
    },
  }))
}

export function resolveNextHistoryPageDailyRolloverDelayMs(options: {
  nowMs?: number
  symbol: string | null | undefined
}) {
  const profile = resolveTimeAlignedTradingProfile(options.symbol)
  const maintenance = profile.dailyMaintenance
  if (!maintenance) return null
  const nowMs = options.nowMs ?? Date.now()
  const shanghaiNowMs = nowMs + shanghaiOffsetMs
  const shanghaiDayStartMs = Math.floor(shanghaiNowMs / dayMs) * dayMs
  let closeUtcMs = shanghaiDayStartMs +
    maintenance.closeHourShanghai * 60 * 60 * 1000 +
    maintenance.closeMinuteShanghai * 60 * 1000 -
    shanghaiOffsetMs
  const earliestMs = nowMs + rolloverDelayAfterCloseMs
  while (closeUtcMs < earliestMs) closeUtcMs += dayMs
  return closeUtcMs - nowMs + rolloverDelayAfterCloseMs
}

export function resolveLastHistoryPageDailyRolloverAtMs(options: {
  nowMs?: number
  symbol: string | null | undefined
}) {
  const profile = resolveTimeAlignedTradingProfile(options.symbol)
  const maintenance = profile.dailyMaintenance
  if (!maintenance) return null
  const nowMs = options.nowMs ?? Date.now()
  const shanghaiNowMs = nowMs + shanghaiOffsetMs
  const shanghaiDayStartMs = Math.floor(shanghaiNowMs / dayMs) * dayMs
  let rolloverUtcMs = shanghaiDayStartMs +
    maintenance.closeHourShanghai * 60 * 60 * 1000 +
    maintenance.closeMinuteShanghai * 60 * 1000 -
    shanghaiOffsetMs +
    rolloverDelayAfterCloseMs
  while (rolloverUtcMs > nowMs) rolloverUtcMs -= dayMs
  return rolloverUtcMs
}

export function isHistoryPageIndexCacheStaleAfterDailyRollover(options: {
  builtAt?: string | null
  nowMs?: number
  symbol: string | null | undefined
}) {
  if (!options.builtAt) return false
  const builtAtMs = Date.parse(options.builtAt)
  if (!Number.isFinite(builtAtMs)) return false
  const lastRolloverAtMs = resolveLastHistoryPageDailyRolloverAtMs({
    nowMs: options.nowMs,
    symbol: options.symbol,
  })
  return typeof lastRolloverAtMs === 'number' && builtAtMs < lastRolloverAtMs
}
