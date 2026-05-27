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
  stochStarted: boolean
}

const highStochStartLevel = 65
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

function doesValueCrossAbove(previousValue: number | undefined, value: number | undefined, threshold: number) {
  if (!finiteNumber(previousValue) || !finiteNumber(value)) return false
  return previousValue < threshold && value >= threshold
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

function doStochLinesFallBackBelow(
  previousK: number | undefined,
  previousD: number | undefined,
  k: number | undefined,
  d: number | undefined,
  threshold: number,
) {
  if (!finiteNumber(previousK) || !finiteNumber(previousD) || !finiteNumber(k) || !finiteNumber(d)) return false
  return Math.max(previousK, previousD) > threshold && Math.max(k, d) <= threshold
}

function doStochLinesCrossAbove(
  previousK: number | undefined,
  previousD: number | undefined,
  k: number | undefined,
  d: number | undefined,
  threshold: number,
) {
  if (!finiteNumber(previousK) || !finiteNumber(previousD) || !finiteNumber(k) || !finiteNumber(d)) return false
  return (previousK < threshold && k >= threshold) || (previousD < threshold && d >= threshold)
}

function isHighFilterMatched(row: MmfHighInputRow, settings: MmfHighStateMachineSettings) {
  return (
    (finiteNumber(row.high) && finiteNumber(row.morganLevel) && row.high >= row.morganLevel)
    || (finiteNumber(row.dpo) && row.dpo >= settings.dpoThreshold)
  )
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
    const stochStartSignal = doStochLinesCrossAbove(previousRow.k, previousRow.d, row.k, row.d, highStochStartLevel)

    if (!active && dpoStartSignal && finiteNumber(row.high)) {
      active = {
        hasFilterMatch: true,
        highestHigh: row.high,
        highestHighIndex: index,
        reachedReversalZone: false,
        startIndex: index,
        stochStarted: false,
      }
    }

    if (!active) continue

    if (finiteNumber(row.high) && row.high > active.highestHigh) {
      active.highestHigh = row.high
      active.highestHighIndex = index
    }

    active.hasFilterMatch = active.hasFilterMatch || isHighFilterMatched(row, settings)
    active.stochStarted = active.stochStarted || stochStartSignal
    active.reachedReversalZone = active.reachedReversalZone || (
      active.stochStarted && isStochDeadCrossValueAbove(previousRow.k, previousRow.d, row.k, row.d, highStochZoneLevel)
    )

    if (active.stochStarted && active.reachedReversalZone && index > active.startIndex && doStochLinesBreakBelow(previousRow.k, previousRow.d, row.k, row.d, highStochEndLevel)) {
      if (active.hasFilterMatch) {
        const markerIndex = active.highestHighIndex
        rows[markerIndex] = {
          ...rows[markerIndex],
          highMarker: active.highestHigh,
          highMarkerPrice: active.highestHigh,
        }
      }
      active = null
    } else if (active.stochStarted && index > active.startIndex && doStochLinesFallBackBelow(previousRow.k, previousRow.d, row.k, row.d, highStochStartLevel)) {
      active.stochStarted = false
      active.reachedReversalZone = false
    }
  }

  return rows
}
