import { resolveTimeAlignedTradingProfile } from './timeAligned/timeAlignedTradingProfile'

const shanghaiOffsetMs = 8 * 60 * 60 * 1000
const dayMs = 24 * 60 * 60 * 1000
const rolloverDelayAfterCloseMs = 60_000
const friday = 5

export const historyPageDailyRolloverRebuildEvent = 'fractalframe:history-page-daily-rollover-rebuild'

export type HistoryPageRolloverReason = 'daily-close' | 'weekly-close' | 'monthly-close'

export type HistoryPageDailyRolloverRebuildDetail = {
  period?: string | null
  reason: HistoryPageRolloverReason
  symbol?: string | null
}

export function dispatchHistoryPageDailyRolloverRebuild(options: {
  period?: string | null
  reason?: HistoryPageRolloverReason
  symbol?: string | null
}) {
  window.dispatchEvent(new CustomEvent<HistoryPageDailyRolloverRebuildDetail>(historyPageDailyRolloverRebuildEvent, {
    detail: {
      period: options.period ?? null,
      reason: options.reason ?? resolveHistoryPageRolloverReasonForPeriod(options.period),
      symbol: options.symbol ?? null,
    },
  }))
}

export function resolveHistoryPageRolloverReasonForPeriod(period: string | null | undefined): HistoryPageRolloverReason {
  const normalized = String(period ?? '').trim().toUpperCase()
  if (normalized === 'M30') return 'weekly-close'
  if (normalized === 'H2') return 'monthly-close'
  return 'daily-close'
}

export function resolveNextHistoryPageDailyRolloverDelayMs(options: {
  nowMs?: number
  symbol: string | null | undefined
}) {
  return resolveNextHistoryPageRolloverDelayMs({
    nowMs: options.nowMs,
    period: 'M5',
    symbol: options.symbol,
  })
}

export function resolveNextHistoryPageRolloverDelayMs(options: {
  nowMs?: number
  period: string | null | undefined
  symbol: string | null | undefined
}) {
  const profile = resolveTimeAlignedTradingProfile(options.symbol)
  const maintenance = profile.dailyMaintenance
  if (!maintenance) return null
  const nowMs = options.nowMs ?? Date.now()
  const reason = resolveHistoryPageRolloverReasonForPeriod(options.period)
  const rolloverAtMs = reason === 'weekly-close'
    ? resolveNextWeeklyRolloverAtMs(nowMs, maintenance.closeHourShanghai, maintenance.closeMinuteShanghai)
    : reason === 'monthly-close'
    ? resolveNextMonthlyRolloverAtMs(nowMs, maintenance.closeHourShanghai, maintenance.closeMinuteShanghai, profile.weekendClosed)
    : resolveNextDailyRolloverAtMs(nowMs, maintenance.closeHourShanghai, maintenance.closeMinuteShanghai)
  return rolloverAtMs - nowMs
}

function resolveNextDailyRolloverAtMs(nowMs: number, closeHourShanghai: number, closeMinuteShanghai: number) {
  const shanghaiNowMs = nowMs + shanghaiOffsetMs
  const shanghaiDayStartMs = Math.floor(shanghaiNowMs / dayMs) * dayMs
  let rolloverAtMs = shanghaiDayStartMs +
    closeHourShanghai * 60 * 60 * 1000 +
    closeMinuteShanghai * 60 * 1000 -
    shanghaiOffsetMs
    + rolloverDelayAfterCloseMs
  while (rolloverAtMs < nowMs) rolloverAtMs += dayMs
  return rolloverAtMs
}

function resolveNextWeeklyRolloverAtMs(nowMs: number, closeHourShanghai: number, closeMinuteShanghai: number) {
  const shanghaiNowMs = nowMs + shanghaiOffsetMs
  const shanghaiDayStartMs = Math.floor(shanghaiNowMs / dayMs) * dayMs
  const weekday = new Date(shanghaiDayStartMs).getUTCDay()
  const daysUntilFriday = (friday - weekday + 7) % 7
  let rolloverAtMs = shanghaiDayStartMs + daysUntilFriday * dayMs +
    closeHourShanghai * 60 * 60 * 1000 +
    closeMinuteShanghai * 60 * 1000 -
    shanghaiOffsetMs
    + rolloverDelayAfterCloseMs
  while (rolloverAtMs < nowMs) rolloverAtMs += 7 * dayMs
  return rolloverAtMs
}

function resolveNextMonthlyRolloverAtMs(nowMs: number, closeHourShanghai: number, closeMinuteShanghai: number, weekendClosed: boolean) {
  const parts = resolveShanghaiParts(nowMs)
  let year = parts.year
  let monthIndex = parts.monthIndex
  let rolloverAtMs = resolveMonthlyRolloverAtMs(year, monthIndex, closeHourShanghai, closeMinuteShanghai, weekendClosed)
  while (rolloverAtMs < nowMs) {
    monthIndex += 1
    if (monthIndex > 11) {
      monthIndex = 0
      year += 1
    }
    rolloverAtMs = resolveMonthlyRolloverAtMs(year, monthIndex, closeHourShanghai, closeMinuteShanghai, weekendClosed)
  }
  return rolloverAtMs
}

export function resolveLastHistoryPageDailyRolloverAtMs(options: {
  nowMs?: number
  symbol: string | null | undefined
}) {
  return resolveLastHistoryPageRolloverAtMs({
    nowMs: options.nowMs,
    period: 'M5',
    symbol: options.symbol,
  })
}

export function resolveLastHistoryPageRolloverAtMs(options: {
  nowMs?: number
  period: string | null | undefined
  symbol: string | null | undefined
}) {
  const profile = resolveTimeAlignedTradingProfile(options.symbol)
  const maintenance = profile.dailyMaintenance
  if (!maintenance) return null
  const nowMs = options.nowMs ?? Date.now()
  const reason = resolveHistoryPageRolloverReasonForPeriod(options.period)
  if (reason === 'weekly-close') {
    return resolveLastWeeklyRolloverAtMs(nowMs, maintenance.closeHourShanghai, maintenance.closeMinuteShanghai)
  }
  if (reason === 'monthly-close') {
    return resolveLastMonthlyRolloverAtMs(nowMs, maintenance.closeHourShanghai, maintenance.closeMinuteShanghai, profile.weekendClosed)
  }
  return resolveLastDailyRolloverAtMs(nowMs, maintenance.closeHourShanghai, maintenance.closeMinuteShanghai)
}

function resolveLastDailyRolloverAtMs(nowMs: number, closeHourShanghai: number, closeMinuteShanghai: number) {
  const shanghaiNowMs = nowMs + shanghaiOffsetMs
  const shanghaiDayStartMs = Math.floor(shanghaiNowMs / dayMs) * dayMs
  let rolloverUtcMs = shanghaiDayStartMs +
    closeHourShanghai * 60 * 60 * 1000 +
    closeMinuteShanghai * 60 * 1000 -
    shanghaiOffsetMs +
    rolloverDelayAfterCloseMs
  while (rolloverUtcMs > nowMs) rolloverUtcMs -= dayMs
  return rolloverUtcMs
}

function resolveLastWeeklyRolloverAtMs(nowMs: number, closeHourShanghai: number, closeMinuteShanghai: number) {
  const shanghaiNowMs = nowMs + shanghaiOffsetMs
  const shanghaiDayStartMs = Math.floor(shanghaiNowMs / dayMs) * dayMs
  const weekday = new Date(shanghaiDayStartMs).getUTCDay()
  const daysUntilFriday = (friday - weekday + 7) % 7
  let rolloverAtMs = shanghaiDayStartMs + daysUntilFriday * dayMs +
    closeHourShanghai * 60 * 60 * 1000 +
    closeMinuteShanghai * 60 * 1000 -
    shanghaiOffsetMs +
    rolloverDelayAfterCloseMs
  while (rolloverAtMs > nowMs) rolloverAtMs -= 7 * dayMs
  return rolloverAtMs
}

function resolveLastMonthlyRolloverAtMs(nowMs: number, closeHourShanghai: number, closeMinuteShanghai: number, weekendClosed: boolean) {
  const parts = resolveShanghaiParts(nowMs)
  let year = parts.year
  let monthIndex = parts.monthIndex
  let rolloverAtMs = resolveMonthlyRolloverAtMs(year, monthIndex, closeHourShanghai, closeMinuteShanghai, weekendClosed)
  while (rolloverAtMs > nowMs) {
    monthIndex -= 1
    if (monthIndex < 0) {
      monthIndex = 11
      year -= 1
    }
    rolloverAtMs = resolveMonthlyRolloverAtMs(year, monthIndex, closeHourShanghai, closeMinuteShanghai, weekendClosed)
  }
  return rolloverAtMs
}

function resolveMonthlyRolloverAtMs(
  year: number,
  monthIndex: number,
  closeHourShanghai: number,
  closeMinuteShanghai: number,
  weekendClosed: boolean,
) {
  const nextMonthStartShanghaiMs = Date.UTC(year, monthIndex + 1, 1)
  let lastTradingDayStartShanghaiMs = nextMonthStartShanghaiMs - dayMs
  if (weekendClosed) {
    while (isWeekendShanghaiDayStart(lastTradingDayStartShanghaiMs)) {
      lastTradingDayStartShanghaiMs -= dayMs
    }
  }
  return lastTradingDayStartShanghaiMs +
    closeHourShanghai * 60 * 60 * 1000 +
    closeMinuteShanghai * 60 * 1000 -
    shanghaiOffsetMs +
    rolloverDelayAfterCloseMs
}

function resolveShanghaiParts(utcMs: number) {
  const date = new Date(utcMs + shanghaiOffsetMs)
  return {
    monthIndex: date.getUTCMonth(),
    year: date.getUTCFullYear(),
  }
}

function isWeekendShanghaiDayStart(shanghaiDayStartMs: number) {
  const weekday = new Date(shanghaiDayStartMs).getUTCDay()
  return weekday === 0 || weekday === 6
}

export function isHistoryPageIndexCacheStaleAfterDailyRollover(options: {
  builtAt?: string | null
  nowMs?: number
  symbol: string | null | undefined
}) {
  return isHistoryPageIndexCacheStaleAfterRollover({
    builtAt: options.builtAt,
    nowMs: options.nowMs,
    period: 'M5',
    symbol: options.symbol,
  })
}

export function isHistoryPageIndexCacheStaleAfterRollover(options: {
  builtAt?: string | null
  nowMs?: number
  period: string | null | undefined
  symbol: string | null | undefined
}) {
  if (!options.builtAt) return false
  const builtAtMs = Date.parse(options.builtAt)
  if (!Number.isFinite(builtAtMs)) return false
  const lastRolloverAtMs = resolveLastHistoryPageRolloverAtMs({
    nowMs: options.nowMs,
    period: options.period,
    symbol: options.symbol,
  })
  return typeof lastRolloverAtMs === 'number' && builtAtMs < lastRolloverAtMs
}
