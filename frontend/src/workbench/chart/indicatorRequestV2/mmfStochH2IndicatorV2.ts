import { queryStoreV6Ohlcv, type StoreV6QueryRow } from '../../../services/mt5/mt5SymbolsApi'
import { readPersistedIndicatorsState } from '../../rightDrawer/indicatorPersistence'
import {
  normalizeMmfStochH2Settings,
  normalizeStochSettings,
  type MmfStochH2IndicatorSettings,
  type MmfStochH2PassthroughPeriod,
  type StochIndicatorSettings,
} from '../../rightDrawer/indicatorSettingsSchema'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'
import {
  applyMmfStochH2EventsToTargetRows,
  createEmptyMmfStochH2MarkerRows,
  createMmfStochH2EventsFromH2Rows,
  createMmfStochH2EventStore,
} from './mmfStochH2EventReceiverV2'
import type { MmfStochH2EventStoreJson } from './mmfStochH2EventReceiverV2'
import type { MmfStochH2EventMarkerRow } from './mmfStochH2EventReceiverV2'

export const storeV6MmfStochH2IndicatorIdV2 = 'MMF_STOCH_H2'
export const storeV6MmfStochH2PaneIdV2 = 'candle_pane'
const mmfStochH2EventReceiverSourceV2 = 'store-v6-mmf-stoch-h2-event-receiver-v2'

export type StoreV6MmfStochH2IndicatorParamsV2 = {
  settings?: Partial<MmfStochH2IndicatorSettings>
  stochSettings?: Partial<StochIndicatorSettings>
  targetPeriod?: string
}

export type MmfStochH2IndicatorRow = MmfStochH2EventMarkerRow

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function finiteIntegerOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

function normalizePeriod(period: string | null | undefined) {
  return String(period || '').trim().toUpperCase()
}

function periodSeconds(period: string | null | undefined) {
  const normalized = normalizePeriod(period)
  if (normalized === 'M5') return 5 * 60
  if (normalized === 'M30') return 30 * 60
  if (normalized === 'H2') return 2 * 60 * 60
  return null
}

function isMmfStochH2PassthroughPeriod(period: string): period is MmfStochH2PassthroughPeriod {
  return period === 'M5' || period === 'M30' || period === 'H2'
}

function normalizeRequestParams(request: StoreV6IndicatorRequestSpecV2<StoreV6MmfStochH2IndicatorParamsV2>) {
  const params = request.params ?? {}
  return {
    settings: normalizeMmfStochH2Settings(params.settings),
    stochSettings: normalizeStochSettings(params.stochSettings),
    targetPeriod: normalizePeriod(params.targetPeriod),
  }
}

function requiredWarmupRows(request: StoreV6IndicatorRequestSpecV2<StoreV6MmfStochH2IndicatorParamsV2>) {
  const { stochSettings, targetPeriod } = normalizeRequestParams(request)
  const sourceRows = stochSettings.length + stochSettings.kSmoothing + stochSettings.dSmoothing + 2
  const targetSeconds = periodSeconds(targetPeriod)
  const multiplier = targetSeconds ? Math.max(1, Math.ceil((2 * 60 * 60) / targetSeconds)) : 1
  return Math.max(0, Math.min(5000, sourceRows * multiplier))
}

function normalizeStoreV6H2Rows(rows: StoreV6QueryRow[], symbol: string): StoreV6WindowKLine[] {
  const normalized = new Map<string, StoreV6WindowKLine>()
  rows.forEach((row) => {
    const time = finiteIntegerOrNull(row.time)
    if (time == null) return
    const open = Number(row.open)
    const high = Number(row.high)
    const low = Number(row.low)
    const close = Number(row.close)
    const volume = Number(row.volume ?? 0)
    if (![open, high, low, close, volume].every(Number.isFinite)) return
    const barKey = typeof row.barKey === 'string' && row.barKey ? row.barKey : `${symbol}|H2|${time}`
    normalized.set(barKey, {
      barKey,
      close,
      closeTime: finiteIntegerOrNull(row.closeTime) ?? undefined,
      globalIndex: finiteIntegerOrNull(row.globalIndex),
      high,
      low,
      open,
      period: 'H2',
      sessionId: typeof row.sessionId === 'string' ? row.sessionId : undefined,
      source: 'store-v6-page-slice-v2',
      symbol,
      time,
      timestamp: time * 1000,
      tradingDay: typeof row.tradingDay === 'string' ? row.tradingDay : undefined,
      volume,
    })
  })
  return [...normalized.values()].sort((left, right) => finiteNumber(left.time) - finiteNumber(right.time))
}

async function queryH2SourceRowsForTargetWindow(options: {
  rows: StoreV6WindowKLine[]
  sourceWarmupRows: number
  symbol: string
}) {
  const firstTime = finiteIntegerOrNull(options.rows[0]?.time)
  const lastTime = finiteIntegerOrNull(options.rows[options.rows.length - 1]?.time)
  if (firstTime == null || lastTime == null) return []
  const payload = await queryStoreV6Ohlcv({
    anchor: 'UTC2200',
    baseTimeframe: 'M1',
    limit: Math.min(5000, Math.max(100, options.sourceWarmupRows + Math.ceil((lastTime - firstTime) / 7200) + 8)),
    mode: 'aggregated',
    symbol: options.symbol,
    timeframe: 'H2',
    timeFrom: Math.max(0, firstTime - options.sourceWarmupRows * 7200),
    timeTo: lastTime,
  })
  return normalizeStoreV6H2Rows(payload.rows, options.symbol)
}

function emptyIndicatorRows(rows: StoreV6WindowKLine[]): MmfStochH2IndicatorRow[] {
  return createEmptyMmfStochH2MarkerRows(rows)
}

function createH2SourceRows(rows: StoreV6WindowKLine[], targetPeriod: string) {
  if (normalizePeriod(targetPeriod) === 'H2') return rows
  const targetSeconds = periodSeconds(targetPeriod)
  if (!targetSeconds) return []

  const sortedRows = [...rows].sort((left, right) => finiteNumber(left.time) - finiteNumber(right.time))
  const buckets = new Map<number, StoreV6WindowKLine[]>()
  sortedRows.forEach((row) => {
    const time = finiteNumber(row.time)
    const bucketStart = Math.floor(time / 7200) * 7200
    const bucketRows = buckets.get(bucketStart) ?? []
    bucketRows.push(row)
    buckets.set(bucketStart, bucketRows)
  })

  const sourceRows: StoreV6WindowKLine[] = []
  for (const [bucketStart, bucketRows] of buckets.entries()) {
    const firstTime = finiteNumber(bucketRows[0]?.time)
    const lastTime = finiteNumber(bucketRows[bucketRows.length - 1]?.time)
    if (firstTime !== bucketStart || lastTime !== bucketStart + 7200 - targetSeconds) continue
    const first = bucketRows[0]
    const last = bucketRows[bucketRows.length - 1]
    const high = Math.max(...bucketRows.map((row) => finiteNumber(row.high)))
    const low = Math.min(...bucketRows.map((row) => finiteNumber(row.low)))
    const volume = bucketRows.reduce((sum, row) => sum + finiteNumber(row.volume ?? 0), 0)
    sourceRows.push({
      ...last,
      barKey: `${last.symbol}|H2_SOURCE|${bucketStart}`,
      close: finiteNumber(last.close),
      closeTime: bucketStart + 7200,
      globalIndex: first.globalIndex,
      high,
      low,
      open: finiteNumber(first.open),
      period: 'H2',
      time: bucketStart,
      timestamp: bucketStart,
      tradingDay: first.tradingDay,
      volume,
    })
  }
  return sourceRows
}

export function calculateMmfStochH2Rows(
  rows: StoreV6WindowKLine[],
  options: {
    period: string
    settings: MmfStochH2IndicatorSettings
    skipLast?: boolean
    stochSettings: StochIndicatorSettings
    targetPeriod?: string
  },
): MmfStochH2IndicatorRow[] {
  const targetPeriod = normalizePeriod(options.targetPeriod || options.period)
  const baseRows = emptyIndicatorRows(rows)
  if (
    rows.length === 0
    || options.settings.passthroughVisible !== true
    || !isMmfStochH2PassthroughPeriod(targetPeriod)
    || !options.settings.passthroughPeriods.includes(targetPeriod)
  ) {
    return baseRows
  }

  const sourceRows = createH2SourceRows(rows, targetPeriod)
  return calculateMmfStochH2RowsFromH2Source(rows, sourceRows, {
    settings: options.settings,
    skipLast: options.skipLast,
    stochSettings: options.stochSettings,
    targetPeriod,
  })
}

function calculateMmfStochH2RowsFromH2Source(
  targetRows: StoreV6WindowKLine[],
  sourceRows: StoreV6WindowKLine[],
  options: {
    settings: MmfStochH2IndicatorSettings
    skipLast?: boolean
    stochSettings: StochIndicatorSettings
    targetPeriod: string
  },
): MmfStochH2IndicatorRow[] {
  const baseRows = emptyIndicatorRows(targetRows)
  if (sourceRows.length === 0) return baseRows
  const events = createMmfStochH2EventsFromH2Rows(sourceRows, {
    skipLast: options.skipLast,
    stochSettings: options.stochSettings,
  })
  if (events.length === 0) return baseRows
  return applyMmfStochH2EventsToTargetRows(targetRows, events, {
    targetPeriod: options.targetPeriod,
  })
}

function calculateMmfStochH2EventPayloadFromH2Source(
  sourceRows: StoreV6WindowKLine[],
  options: {
    skipLast?: boolean
    stochSettings: StochIndicatorSettings
  },
): MmfStochH2EventStoreJson {
  return createMmfStochH2EventStore(createMmfStochH2EventsFromH2Rows(sourceRows, options))
}

function displayRowsFromCalculationRows(
  calculationRows: StoreV6WindowKLine[],
  indicatorRows: MmfStochH2IndicatorRow[],
  displayRows: StoreV6WindowKLine[],
) {
  const byBarKey = new Map<string, MmfStochH2IndicatorRow>()
  calculationRows.forEach((row, index) => {
    byBarKey.set(row.barKey, indicatorRows[index] ?? { barKey: row.barKey })
  })
  return displayRows.map((row) => byBarKey.get(row.barKey) ?? {
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  })
}

export async function requestMmfStochH2EventReceiverIndicatorsV2(options: {
  calculationRows: StoreV6WindowKLine[]
  displayRows: StoreV6WindowKLine[]
  pageIndex?: number | null
  period: string
  sourceKey: string
  symbol: string
}): Promise<StoreV6HistoryPageWindowIndicators> {
  const targetPeriod = normalizePeriod(options.period)
  if (!isMmfStochH2PassthroughPeriod(targetPeriod)) return {}
  const h2SourceSettings = readPersistedIndicatorsState('H2')
  const settings = h2SourceSettings.mmfStochH2
  if (!settings.passthroughVisible || !settings.passthroughPeriods.includes(targetPeriod)) return {}

  const stochSettings = h2SourceSettings.stoch
  const sourceRows = targetPeriod === 'H2'
    ? options.calculationRows
    : await queryH2SourceRowsForTargetWindow({
      rows: options.calculationRows,
      sourceWarmupRows: requiredWarmupRows({
        id: storeV6MmfStochH2IndicatorIdV2,
        params: { settings, stochSettings, targetPeriod },
      }),
      symbol: options.symbol,
    })
  const rows = calculateMmfStochH2RowsFromH2Source(options.calculationRows, sourceRows, {
    settings,
    stochSettings,
    targetPeriod,
  })
  const eventStore = calculateMmfStochH2EventPayloadFromH2Source(sourceRows, { stochSettings })
  return {
    [storeV6MmfStochH2IndicatorIdV2]: {
      calculationMode: 'computed',
      displayRows: displayRowsFromCalculationRows(options.calculationRows, rows, options.displayRows),
      id: storeV6MmfStochH2IndicatorIdV2,
      key: `${storeV6MmfStochH2IndicatorIdV2}:event-receiver:${options.symbol}:${targetPeriod}:${options.pageIndex ?? 'realtime'}:${options.sourceKey}:${eventStore.events.length}`,
      paneId: storeV6MmfStochH2PaneIdV2,
      paneRole: 'main',
      renderRole: 'main-overlay',
      rows,
      settings: { eventStore, settings, stochSettings },
      source: mmfStochH2EventReceiverSourceV2,
    },
  }
}

export const storeV6MmfStochH2IndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<StoreV6MmfStochH2IndicatorParamsV2> = {
  calculationMode: 'computed',
  calculateHistory: (context) => {
    const { settings, stochSettings } = normalizeRequestParams(context.request)
    const targetPeriod = normalizePeriod(context.period)
    const buildResult = (rows: MmfStochH2IndicatorRow[], eventStore?: MmfStochH2EventStoreJson) => ({
      [storeV6MmfStochH2IndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(context.calculationRows, rows, context.displayRows),
        key: `${storeV6MmfStochH2IndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
        rows,
        settings: { eventStore, settings, stochSettings },
        source: 'store-v6-mmf-stoch-h2-indicator-v2',
      },
    })
    if (targetPeriod !== 'H2') {
      return queryH2SourceRowsForTargetWindow({
        rows: context.calculationRows,
        sourceWarmupRows: requiredWarmupRows(context.request),
        symbol: context.symbol,
      }).then((sourceRows) => buildResult(calculateMmfStochH2RowsFromH2Source(context.calculationRows, sourceRows, {
        settings,
        stochSettings,
        targetPeriod,
      }), calculateMmfStochH2EventPayloadFromH2Source(sourceRows, { stochSettings }))).catch(() => buildResult(calculateMmfStochH2Rows(context.calculationRows, {
        period: context.period,
        settings,
        stochSettings,
        targetPeriod: context.period,
      })))
    }
    const rows = calculateMmfStochH2Rows(context.calculationRows, {
      period: context.period,
      settings,
      stochSettings,
      targetPeriod: context.period,
    })
    return buildResult(rows, calculateMmfStochH2EventPayloadFromH2Source(context.calculationRows, { stochSettings }))
  },
  calculateRealtime: (context) => {
    const { settings, stochSettings } = normalizeRequestParams(context.request)
    const calculationRows = [...context.historyRows, ...context.activeRows]
    const targetPeriod = normalizePeriod(context.period)
    const buildResult = (rows: MmfStochH2IndicatorRow[], eventStore?: MmfStochH2EventStoreJson) => ({
      [storeV6MmfStochH2IndicatorIdV2]: {
        displayRows: displayRowsFromCalculationRows(calculationRows, rows, context.activeRows),
        key: `${storeV6MmfStochH2IndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
        rows,
        settings: { eventStore, settings, stochSettings },
        source: 'store-v6-mmf-stoch-h2-indicator-v2',
      },
    })
    if (targetPeriod !== 'H2') {
      return queryH2SourceRowsForTargetWindow({
        rows: calculationRows,
        sourceWarmupRows: requiredWarmupRows(context.request),
        symbol: context.symbol,
      }).then((sourceRows) => buildResult(calculateMmfStochH2RowsFromH2Source(calculationRows, sourceRows, {
        settings,
        skipLast: true,
        stochSettings,
        targetPeriod,
      }), calculateMmfStochH2EventPayloadFromH2Source(sourceRows, { skipLast: true, stochSettings }))).catch(() => buildResult(calculateMmfStochH2Rows(calculationRows, {
        period: context.period,
        settings,
        skipLast: true,
        stochSettings,
        targetPeriod: context.period,
      })))
    }
    const rows = calculateMmfStochH2Rows(calculationRows, {
      period: context.period,
      settings,
      skipLast: true,
      stochSettings,
      targetPeriod: context.period,
    })
    return buildResult(rows, calculateMmfStochH2EventPayloadFromH2Source(calculationRows, { skipLast: true, stochSettings }))
  },
  id: storeV6MmfStochH2IndicatorIdV2,
  paneId: storeV6MmfStochH2PaneIdV2,
  paneRole: 'main',
  realtimeUpdateMode: 'deferred',
  renderRole: 'main-overlay',
  warmup: {
    historyRows: requiredWarmupRows,
    mode: 'fixedRows',
    realtimeRows: requiredWarmupRows,
  },
}
