import type { StochIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewStochRows } from '../tradingViewStochIndicator'

export type MmfStochH2EventKind =
  | 'closeOverbought'
  | 'closeOversold'
  | 'enterOverbought'
  | 'enterOversold'

export type MmfStochH2Event = {
  eventTime: number
  id: string
  kind: MmfStochH2EventKind
  sourceBarKey?: string
  sourceTime: number
}

export type MmfStochH2EventMarkerRow = {
  barKey?: string
  closeOverboughtMarker?: number
  closeOverboughtMarkerPrice?: number
  closeOversoldMarker?: number
  closeOversoldMarkerPrice?: number
  enterOverboughtMarker?: number
  enterOverboughtMarkerPrice?: number
  enterOversoldMarker?: number
  enterOversoldMarkerPrice?: number
  globalIndex?: number | null
  time?: number
  timestamp?: number
}

export type MmfStochH2EventStoreJson = {
  events: MmfStochH2Event[]
  source: 'MMF_STOCH_H2'
  version: 1
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function finiteIntegerOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

function periodSeconds(period: string | null | undefined) {
  const normalized = String(period || '').trim().toUpperCase()
  if (normalized === 'M5') return 5 * 60
  if (normalized === 'M30') return 30 * 60
  if (normalized === 'H2') return 2 * 60 * 60
  return null
}

function resolveRowCloseTime(row: StoreV6WindowKLine, fallbackPeriod: string) {
  const explicit = finiteIntegerOrNull(row.closeTime)
  if (explicit != null) return explicit
  const seconds = periodSeconds(row.period || fallbackPeriod)
  const openTime = finiteIntegerOrNull(row.time)
  return openTime != null && seconds != null ? openTime + seconds : openTime
}

function bothAbove(k: number | undefined, d: number | undefined, level: number) {
  return Number.isFinite(k) && Number.isFinite(d) && Number(k) > level && Number(d) > level
}

function bothBelow(k: number | undefined, d: number | undefined, level: number) {
  return Number.isFinite(k) && Number.isFinite(d) && Number(k) < level && Number(d) < level
}

function bothFinite(k: number | undefined, d: number | undefined) {
  return Number.isFinite(k) && Number.isFinite(d)
}

function eventId(kind: MmfStochH2EventKind, sourceRow: StoreV6WindowKLine, eventTime: number) {
  return ['MMF_STOCH_H2', kind, sourceRow.symbol, sourceRow.barKey || sourceRow.time, eventTime].join('|')
}

function createEvent(kind: MmfStochH2EventKind, sourceRow: StoreV6WindowKLine): MmfStochH2Event | null {
  const eventTime = resolveRowCloseTime(sourceRow, 'H2')
  const sourceTime = finiteIntegerOrNull(sourceRow.time)
  if (eventTime == null || sourceTime == null) return null
  return {
    eventTime,
    id: eventId(kind, sourceRow, eventTime),
    kind,
    sourceBarKey: sourceRow.barKey,
    sourceTime,
  }
}

export function createMmfStochH2EventStore(events: MmfStochH2Event[]): MmfStochH2EventStoreJson {
  return {
    events,
    source: 'MMF_STOCH_H2',
    version: 1,
  }
}

export function createMmfStochH2EventsFromH2Rows(
  sourceRows: StoreV6WindowKLine[],
  options: {
    skipLast?: boolean
    stochSettings: StochIndicatorSettings
  },
) {
  const stochRows = calculateTradingViewStochRows(sourceRows, options.stochSettings)
  const lastSignalIndex = options.skipLast ? sourceRows.length - 2 : sourceRows.length - 1
  const events: MmfStochH2Event[] = []
  let activeOverbought = false
  let activeOversold = false
  let initialized = false

  for (let index = 1; index <= lastSignalIndex; index += 1) {
    const previous = stochRows[index - 1]
    const current = stochRows[index]
    const row = sourceRows[index]
    if (!previous || !current || !row) continue
    const hasPreviousPair = bothFinite(previous.k, previous.d)
    const wasOverbought = bothAbove(previous.k, previous.d, 70)
    const isOverbought = bothAbove(current.k, current.d, 70)
    const wasOversold = bothBelow(previous.k, previous.d, 30)
    const isOversold = bothBelow(current.k, current.d, 30)

    if (!initialized && hasPreviousPair) {
      activeOverbought = wasOverbought
      activeOversold = wasOversold
      initialized = true
    }

    if (hasPreviousPair && !activeOverbought && !wasOverbought && isOverbought) {
      activeOverbought = true
      const event = createEvent('enterOverbought', row)
      if (event) events.push(event)
    }
    if (activeOverbought && wasOverbought && !isOverbought) {
      activeOverbought = false
      const event = createEvent('closeOverbought', row)
      if (event) events.push(event)
    }
    if (hasPreviousPair && !activeOversold && !wasOversold && isOversold) {
      activeOversold = true
      const event = createEvent('enterOversold', row)
      if (event) events.push(event)
    }
    if (activeOversold && wasOversold && !isOversold) {
      activeOversold = false
      const event = createEvent('closeOversold', row)
      if (event) events.push(event)
    }
  }

  return events
}

export function createEmptyMmfStochH2MarkerRows(rows: StoreV6WindowKLine[]): MmfStochH2EventMarkerRow[] {
  return rows.map((row) => ({
    barKey: row.barKey,
    globalIndex: row.globalIndex,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  }))
}

function applyEventToRow(
  target: MmfStochH2EventMarkerRow,
  event: MmfStochH2Event,
  row: StoreV6WindowKLine,
) {
  const high = finiteNumber(row.high)
  const low = finiteNumber(row.low)
  if (event.kind === 'enterOverbought') {
    target.enterOverboughtMarker = high
    target.enterOverboughtMarkerPrice = high
  } else if (event.kind === 'closeOverbought') {
    target.closeOverboughtMarker = high
    target.closeOverboughtMarkerPrice = high
  } else if (event.kind === 'enterOversold') {
    target.enterOversoldMarker = low
    target.enterOversoldMarkerPrice = low
  } else if (event.kind === 'closeOversold') {
    target.closeOversoldMarker = low
    target.closeOversoldMarkerPrice = low
  }
}

export function applyMmfStochH2EventsToTargetRows(
  targetRows: StoreV6WindowKLine[],
  events: MmfStochH2Event[],
  options: {
    targetPeriod: string
  },
) {
  const markerRows = createEmptyMmfStochH2MarkerRows(targetRows)
  const markerByBarKey = new Map(targetRows.map((row, index) => [row.barKey, markerRows[index]]))
  const rowByEventTime = new Map<number, StoreV6WindowKLine>()
  targetRows.forEach((row) => {
    const closeTime = resolveRowCloseTime(row, options.targetPeriod)
    if (closeTime != null) rowByEventTime.set(closeTime, row)
  })

  events.forEach((event) => {
    const row = rowByEventTime.get(event.eventTime)
    if (!row) return
    const target = markerByBarKey.get(row.barKey)
    if (!target) return
    applyEventToRow(target, event, row)
  })

  return markerRows
}
