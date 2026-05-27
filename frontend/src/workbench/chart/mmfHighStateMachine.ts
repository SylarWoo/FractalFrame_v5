export type MmfHighInputRow = {
  d?: number
  dpo?: number
  high?: number
  k?: number
  morganLevel?: number
}

export type MmfHighMarkerRow = {
  highMarker?: number
  highMarkerPrice?: number
  highRangeEndIndex?: number
  highRangeStartIndex?: number
}

export type MmfHighStateMachineSettings = {
  dpoThreshold: number
}

type MmfHighActiveState = {
  hasFilterMatch: boolean
  highestHigh: number
  highestHighIndex: number
  reachedReversalZone: boolean
  startIndex: number
}

const highStochZoneLevel = 70
const highStochEndLevel = 65

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function doStochLinesBreakBelow(
  previousK: number | undefined,
  previousD: number | undefined,
  k: number | undefined,
  d: number | undefined,
  threshold: number,
) {
  if (!finiteNumber(previousK) || !finiteNumber(previousD) || !finiteNumber(k) || !finiteNumber(d)) return false
  return Math.max(previousK, previousD) > threshold && Math.max(k, d) <= threshold
}

function resolveStochCrossValue(
  previousK: number | undefined,
  previousD: number | undefined,
  k: number | undefined,
  d: number | undefined,
) {
  if (!finiteNumber(previousK) || !finiteNumber(previousD) || !finiteNumber(k) || !finiteNumber(d)) return null
  const denominator = (k - previousK) - (d - previousD)
  if (denominator === 0) return null
  const ratio = (previousD - previousK) / denominator
  if (ratio < 0 || ratio > 1) return null
  return previousK + (k - previousK) * ratio
}

function isStochDeadCrossValueAbove(
  previousK: number | undefined,
  previousD: number | undefined,
  k: number | undefined,
  d: number | undefined,
  threshold: number,
) {
  if (!finiteNumber(previousK) || !finiteNumber(previousD) || !finiteNumber(k) || !finiteNumber(d)) return false
  if (!(previousK >= previousD && k < d)) return false
  const crossValue = resolveStochCrossValue(previousK, previousD, k, d)
  return crossValue != null && crossValue > threshold
}

function isHighFilterMatched(row: MmfHighInputRow, settings: MmfHighStateMachineSettings) {
  return (
    (finiteNumber(row.high) && finiteNumber(row.morganLevel) && row.high >= row.morganLevel)
    || (finiteNumber(row.dpo) && row.dpo >= settings.dpoThreshold)
  )
}

function doesValueCrossAbove(previousValue: number | undefined, value: number | undefined, threshold: number) {
  if (!finiteNumber(previousValue) || !finiteNumber(value)) return false
  return previousValue < threshold && value >= threshold
}

function doesPriceCrossAboveLevel(
  previousPrice: number | undefined,
  price: number | undefined,
  previousLevel: number | undefined,
  level: number | undefined,
) {
  if (!finiteNumber(previousPrice) || !finiteNumber(price) || !finiteNumber(previousLevel) || !finiteNumber(level)) return false
  return previousPrice < previousLevel && price >= level
}

export function calculateMmfHighStateMachineRows(
  inputRows: MmfHighInputRow[],
  settings: MmfHighStateMachineSettings,
): MmfHighMarkerRow[] {
  const rows: MmfHighMarkerRow[] = inputRows.map(() => ({}))
  let active: MmfHighActiveState | null = null

  for (let index = 1; index < inputRows.length; index += 1) {
    const row = inputRows[index]
    const previousRow = inputRows[index - 1]
    const dpoStartSignal = doesValueCrossAbove(previousRow.dpo, row.dpo, settings.dpoThreshold)
    const morganStartSignal = doesPriceCrossAboveLevel(previousRow.high, row.high, previousRow.morganLevel, row.morganLevel)
    const startSignal = dpoStartSignal || morganStartSignal

    if (!active && startSignal && finiteNumber(row.high)) {
      active = {
        hasFilterMatch: true,
        highestHigh: row.high,
        highestHighIndex: index,
        reachedReversalZone: false,
        startIndex: index,
      }
    }

    if (!active) continue

    if (finiteNumber(row.high) && row.high > active.highestHigh) {
      active.highestHigh = row.high
      active.highestHighIndex = index
    }

    active.hasFilterMatch = active.hasFilterMatch || isHighFilterMatched(row, settings)
    active.reachedReversalZone = active.reachedReversalZone || (
      isStochDeadCrossValueAbove(previousRow.k, previousRow.d, row.k, row.d, highStochZoneLevel)
    )

    if (active.reachedReversalZone && index > active.startIndex && doStochLinesBreakBelow(previousRow.k, previousRow.d, row.k, row.d, highStochEndLevel)) {
      if (active.hasFilterMatch) {
        const markerIndex = active.highestHighIndex
        rows[markerIndex] = {
          ...rows[markerIndex],
          highMarker: active.highestHigh,
          highMarkerPrice: active.highestHigh,
          highRangeEndIndex: index,
          highRangeStartIndex: active.startIndex,
        }
      }
      active = null
    }
  }

  return rows
}
