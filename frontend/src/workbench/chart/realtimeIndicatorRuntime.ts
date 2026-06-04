import type { KLineData } from 'klinecharts'
import type { ChartIndicatorCommand } from './ChartCoreHost'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'
import { createIndicatorSettingsHash } from './indicatorPageSnapshotStore'
import type { RealtimeKLineData } from './realtimeBarIdentity'
import { enrichRealtimeBarIdentity, normalizeRealtimePeriod } from './realtimeBarIdentity'

export type RealtimeIndicatorRuntimeMode = 'realtime'

export type RealtimeIndicatorRuntimeEventType =
  | 'indicator_loaded'
  | 'indicator_unloaded'
  | 'indicator_settings_changed'
  | 'runtime_bars_changed'

export type RealtimeIndicatorRuntimeEvent = {
  at: string
  barKeyFrom: string | null
  barKeyTo: string | null
  bars: number
  commandId: number
  indicator: string
  pageKey: string
  settingsHash: string | null
  type: RealtimeIndicatorRuntimeEventType
}

export type RealtimeIndicatorRuntimeState = {
  barKeyFrom: string | null
  barKeyTo: string | null
  bars: number
  lastEventAt: string | null
  loaded: Record<string, {
    commandId: number
    loadedAt: string
    settingsHash: string
  }>
  mode: RealtimeIndicatorRuntimeMode
  pageKey: string
  period: string
  symbol: string
  tail: RealtimeIndicatorRuntimeEvent[]
}

const maxRuntimeEvents = 80

function readBarKey(row: KLineData | undefined) {
  const value = (row as Partial<RealtimeKLineData> | undefined)?.barKey
  return typeof value === 'string' && value.trim() ? value : null
}

export function createRealtimeIndicatorPageKey(options: {
  bars: KLineData[]
  period: string
  symbol: string
}) {
  const rows = normalizeRealtimeIndicatorBars(options.bars, options.symbol, options.period)
  const first = rows[0]
  const last = rows[rows.length - 1]
  return [
    options.symbol.trim(),
    normalizeRealtimePeriod(options.period),
    'realtime',
    readBarKey(first) ?? '',
    readBarKey(last) ?? '',
    rows.length,
  ].join('|')
}

export function createRealtimeIndicatorSettingsHash(command: ChartIndicatorCommand) {
  if (command.action !== 'load') return null
  return createIndicatorSettingsHash({
    indicator: command.name,
    settings: command.settings ?? {},
  })
}

export function normalizeRealtimeIndicatorBars(rows: KLineData[], symbol: string, period: string) {
  return stripFuturePlaceholders(rows)
    .map((row) => enrichRealtimeBarIdentity(row, {
      period,
      source: 'realtimeCache',
      symbol,
    }))
    .filter((row): row is RealtimeKLineData => row != null)
}

export function createInitialRealtimeIndicatorRuntimeState(options: {
  bars: KLineData[]
  period: string
  symbol: string
}): RealtimeIndicatorRuntimeState {
  const bars = normalizeRealtimeIndicatorBars(options.bars, options.symbol, options.period)
  return {
    barKeyFrom: readBarKey(bars[0]),
    barKeyTo: readBarKey(bars[bars.length - 1]),
    bars: bars.length,
    lastEventAt: null,
    loaded: {},
    mode: 'realtime',
    pageKey: createRealtimeIndicatorPageKey({ bars, period: options.period, symbol: options.symbol }),
    period: normalizeRealtimePeriod(options.period),
    symbol: options.symbol.trim(),
    tail: [],
  }
}

export function applyRealtimeIndicatorCommandToState(
  current: RealtimeIndicatorRuntimeState,
  command: ChartIndicatorCommand,
  barsInput: KLineData[],
): RealtimeIndicatorRuntimeState {
  const bars = normalizeRealtimeIndicatorBars(barsInput, current.symbol, current.period)
  const pageKey = createRealtimeIndicatorPageKey({ bars, period: current.period, symbol: current.symbol })
  const settingsHash = createRealtimeIndicatorSettingsHash(command)
  const now = new Date().toISOString()
  const eventType: RealtimeIndicatorRuntimeEventType = command.action === 'unload'
    ? 'indicator_unloaded'
    : current.loaded[command.name] && current.loaded[command.name].settingsHash !== settingsHash
      ? 'indicator_settings_changed'
      : 'indicator_loaded'
  const event: RealtimeIndicatorRuntimeEvent = {
    at: now,
    barKeyFrom: readBarKey(bars[0]),
    barKeyTo: readBarKey(bars[bars.length - 1]),
    bars: bars.length,
    commandId: command.id,
    indicator: command.name,
    pageKey,
    settingsHash,
    type: eventType,
  }
  const loaded = { ...current.loaded }
  if (command.action === 'unload') {
    delete loaded[command.name]
  } else if (settingsHash) {
    loaded[command.name] = {
      commandId: command.id,
      loadedAt: now,
      settingsHash,
    }
  }

  return {
    ...current,
    barKeyFrom: event.barKeyFrom,
    barKeyTo: event.barKeyTo,
    bars: bars.length,
    lastEventAt: now,
    loaded,
    pageKey,
    tail: [...current.tail, event].slice(-maxRuntimeEvents),
  }
}
