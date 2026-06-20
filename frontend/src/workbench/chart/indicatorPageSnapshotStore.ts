import type { KLineData } from 'klinecharts'
import type { MmfV3IndicatorRow } from './mmfV3Types'
import { createBarKey, getKLineTimeSeconds } from './barIdentity'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'
import type { MorganRangeMode, MorganRangeSegment } from './morganRangeModel'
import type { SqzmomSqueezeState } from './tradingViewSqzmomIndicator'

export type AoSnapshotRow = {
  histogram?: number
}

export type DpoSnapshotRow = {
  dpo?: number
}

export type MaSnapshotRow = {
  breakBefore?: boolean
  ma?: number
  maFadedColor1?: number
  maFadedColor2?: number
  maFadedColor3?: number
  maFadedColor4?: number
  maColor1?: number
  maColor2?: number
  maColor3?: number
  maColor4?: number
  maColorIndex?: number
  oscillator?: number
}

export type MacdSnapshotRow = {
  histogram?: number
  macd?: number
  signal?: number
}

export type MmadSnapshotRow = {
  breakBefore?: boolean
  denominator?: number
  morganHigh?: number
  morganLow?: number
  lowerBand1?: number
  mp?: number
  segmentIndex?: number
  segmentStartTimestamp?: number
  upperBand1?: number
  volumeSum?: number
  value?: number
  weightedMp?: number
}

export type VwapSnapshotRow = {
  lowerBand1?: number
  lowerBand2?: number
  lowerBand3?: number
  upperBand1?: number
  upperBand2?: number
  upperBand3?: number
  vwap?: number
}

export type StochSnapshotRow = {
  d?: number
  k?: number
}

export type SqzmomSnapshotRow = {
  momentum?: number
  squeezeState?: SqzmomSqueezeState
}

export type RsiSnapshotRow = {
  rsi?: number
  rsiMa?: number
}

export type TsiSnapshotRow = {
  signal?: number
  tsi?: number
}

export type VdoSnapshotRow = {
  vdo?: number
  vdoMa?: number
  vdoMa2?: number
}

export type VmiSnapshotRow = {
  histogram?: number
}

export type ViSnapshotRow = {
  minus?: number
  plus?: number
}

export type VolSnapshotRow = {
  volume?: number
  volumeColorIndex?: 0 | 1
  volumeMa?: number
}

export type IndicatorPageSnapshotRow = {
  ao?: AoSnapshotRow
  barKey: string
  dpo?: DpoSnapshotRow
  ma?: MaSnapshotRow
  macd?: MacdSnapshotRow
  mmad?: MmadSnapshotRow
  mmfV3?: MmfV3IndicatorRow
  rsi?: RsiSnapshotRow
  sourceIndex: number
  sqzmom?: SqzmomSnapshotRow
  stoch?: StochSnapshotRow
  time: number
  tsi?: TsiSnapshotRow
  vdo?: VdoSnapshotRow
  vi?: ViSnapshotRow
  vmi?: VmiSnapshotRow
  vol?: VolSnapshotRow
  vwap?: VwapSnapshotRow
}

export type IndicatorPageSnapshot = {
  byBarKey: Record<string, IndicatorPageSnapshotRow>
  calculatedAt: string
  morganRange?: {
    mode: MorganRangeMode
    segments: MorganRangeSegment[]
  }
  pageKey: string
  rows: IndicatorPageSnapshotRow[]
  settingsHash: string
  settingsHashes?: Record<string, string>
  symbol: string
  period: string
}

const snapshots = new Map<string, IndicatorPageSnapshot>()
const maxSnapshots = 24
const writeIdentities = new Map<string, string>()

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

export function createIndicatorSettingsHash(value: unknown) {
  let hash = 0
  const text = stableStringify(value)
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return `v1:${Math.abs(hash).toString(36)}:${text.length}`
}

function createSnapshotRowsIdentity(rows: IndicatorPageSnapshotRow[]) {
  const first = rows[0]
  const last = rows[rows.length - 1]
  const rowToken = (row: IndicatorPageSnapshotRow | undefined) => {
    if (!row) return 'none'
    return [
      row.barKey,
      row.sourceIndex,
      row.time,
      createIndicatorSettingsHash(row),
    ].join(',')
  }
  return [
    rows.length,
    rowToken(first),
    rowToken(last),
  ].join(':')
}

export function createIndicatorPageKey({
  pageIdentity,
  pageIndex,
  period,
  realtime,
  rows,
  symbol,
}: {
  pageIdentity?: string | null
  pageIndex: number
  period: string
  realtime: boolean
  rows: KLineData[]
  symbol: string
}) {
  if (pageIdentity) return pageIdentity
  const realRows = stripFuturePlaceholders(rows)
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return [
    symbol.trim(),
    period.trim().toUpperCase(),
    pageIndex,
    realtime ? 'rt' : 'hist',
    first ? getKLineTimeSeconds(first) : '',
    last ? getKLineTimeSeconds(last) : '',
    realRows.length,
  ].join('|')
}

export function createIndicatorSnapshotRows({
  aoRows,
  dpoRows,
  maRows,
  macdRows,
  mmadRows,
  mmfV3Rows,
  period,
  rsiRows,
  rows,
  sqzmomRows,
  stochRows,
  symbol,
  tsiRows,
  vdoRows,
  viRows,
  vmiRows,
  volRows,
  vwapRows,
}: {
  aoRows?: AoSnapshotRow[]
  dpoRows?: DpoSnapshotRow[]
  maRows?: MaSnapshotRow[]
  macdRows?: MacdSnapshotRow[]
  mmadRows?: MmadSnapshotRow[]
  mmfV3Rows?: MmfV3IndicatorRow[]
  period: string
  rsiRows?: RsiSnapshotRow[]
  rows: KLineData[]
  sqzmomRows?: SqzmomSnapshotRow[]
  stochRows?: StochSnapshotRow[]
  symbol: string
  tsiRows?: TsiSnapshotRow[]
  vdoRows?: VdoSnapshotRow[]
  viRows?: ViSnapshotRow[]
  vmiRows?: VmiSnapshotRow[]
  volRows?: VolSnapshotRow[]
  vwapRows?: VwapSnapshotRow[]
}) {
  return stripFuturePlaceholders(rows).map((row, sourceIndex) => {
    const time = getKLineTimeSeconds(row)
    const snapshotRow: IndicatorPageSnapshotRow = {
      barKey: createBarKey(symbol, period, time),
      sourceIndex,
      time,
    }
    if (aoRows) snapshotRow.ao = aoRows[sourceIndex] ?? {}
    if (dpoRows) snapshotRow.dpo = dpoRows[sourceIndex] ?? {}
    if (maRows) snapshotRow.ma = maRows[sourceIndex] ?? {}
    if (macdRows) snapshotRow.macd = macdRows[sourceIndex] ?? {}
    if (mmadRows) snapshotRow.mmad = mmadRows[sourceIndex] ?? {}
    if (mmfV3Rows) snapshotRow.mmfV3 = mmfV3Rows[sourceIndex] ?? {}
    if (rsiRows) snapshotRow.rsi = rsiRows[sourceIndex] ?? {}
    if (sqzmomRows) snapshotRow.sqzmom = sqzmomRows[sourceIndex] ?? {}
    if (stochRows) snapshotRow.stoch = stochRows[sourceIndex] ?? {}
    if (tsiRows) snapshotRow.tsi = tsiRows[sourceIndex] ?? {}
    if (vdoRows) snapshotRow.vdo = vdoRows[sourceIndex] ?? {}
    if (viRows) snapshotRow.vi = viRows[sourceIndex] ?? {}
    if (vmiRows) snapshotRow.vmi = vmiRows[sourceIndex] ?? {}
    if (volRows) snapshotRow.vol = volRows[sourceIndex] ?? {}
    if (vwapRows) snapshotRow.vwap = vwapRows[sourceIndex] ?? {}
    return snapshotRow
  })
}

export function writeIndicatorPageSnapshot(snapshot: Omit<IndicatorPageSnapshot, 'byBarKey' | 'calculatedAt'> & { calculatedAt?: string; settingsHashKey?: string }) {
  const existing = snapshots.get(snapshot.pageKey)
  const writeIdentity = [
    snapshot.pageKey,
    snapshot.settingsHash,
    snapshot.settingsHashKey ?? '',
    createSnapshotRowsIdentity(snapshot.rows),
    createIndicatorSettingsHash(snapshot.morganRange ?? null),
  ].join('|')
  if (existing && writeIdentities.get(snapshot.pageKey) === writeIdentity) {
    return existing
  }
  const byBarKey: Record<string, IndicatorPageSnapshotRow> = {}
  existing?.rows.forEach((row) => {
    byBarKey[row.barKey] = { ...row }
  })
  snapshot.rows.forEach((row) => {
    byBarKey[row.barKey] = {
      ...(byBarKey[row.barKey] ?? {}),
      ...row,
      ao: row.ao ?? byBarKey[row.barKey]?.ao,
      dpo: row.dpo ?? byBarKey[row.barKey]?.dpo,
      ma: row.ma ?? byBarKey[row.barKey]?.ma,
      macd: row.macd ?? byBarKey[row.barKey]?.macd,
      mmfV3: row.mmfV3 ?? byBarKey[row.barKey]?.mmfV3,
      rsi: row.rsi ?? byBarKey[row.barKey]?.rsi,
      sqzmom: row.sqzmom ?? byBarKey[row.barKey]?.sqzmom,
      stoch: row.stoch ?? byBarKey[row.barKey]?.stoch,
      tsi: row.tsi ?? byBarKey[row.barKey]?.tsi,
      vdo: row.vdo ?? byBarKey[row.barKey]?.vdo,
      vi: row.vi ?? byBarKey[row.barKey]?.vi,
      vmi: row.vmi ?? byBarKey[row.barKey]?.vmi,
      vol: row.vol ?? byBarKey[row.barKey]?.vol,
      vwap: row.vwap ?? byBarKey[row.barKey]?.vwap,
    }
  })
  const rows = Object.values(byBarKey).sort((left, right) => left.sourceIndex - right.sourceIndex)
  const settingsHashes = {
    ...(existing?.settingsHashes ?? {}),
    ...(snapshot.settingsHashes ?? {}),
    ...(snapshot.settingsHashKey ? { [snapshot.settingsHashKey]: snapshot.settingsHash } : {}),
  }
  const next: IndicatorPageSnapshot = {
    ...(existing ?? {}),
    calculatedAt: snapshot.calculatedAt ?? new Date().toISOString(),
    byBarKey,
    morganRange: snapshot.morganRange ?? existing?.morganRange,
    pageKey: snapshot.pageKey,
    period: snapshot.period,
    rows,
    settingsHash: snapshot.settingsHash,
    settingsHashes,
    symbol: snapshot.symbol,
  }
  snapshots.set(snapshot.pageKey, next)
  writeIdentities.set(snapshot.pageKey, writeIdentity)
  while (snapshots.size > maxSnapshots) {
    const oldest = snapshots.keys().next().value
    if (oldest == null) break
    snapshots.delete(oldest)
    writeIdentities.delete(oldest)
  }
  return next
}

export function readIndicatorPageSnapshot(pageKey: string | null | undefined) {
  if (!pageKey) return null
  const snapshot = snapshots.get(pageKey) ?? null
  if (!snapshot) return null
  snapshots.delete(pageKey)
  snapshots.set(pageKey, snapshot)
  return snapshot
}

export function clearIndicatorPageSnapshot(pageKey: string | null | undefined) {
  if (!pageKey) return
  snapshots.delete(pageKey)
  writeIdentities.delete(pageKey)
}
