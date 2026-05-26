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
}

const highStochStartLevel = 50
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

function areStochLinesAbove(k: number | undefined, d: number | undefined, threshold: number) {
  if (!finiteNumber(k) || !finiteNumber(d)) return false
  return Math.min(k, d) >= threshold
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
  return Math.min(previousK, previousD) < threshold && Math.min(k, d) >= threshold
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
    const startSignal = doStochLinesCrossAbove(previousRow.k, previousRow.d, row.k, row.d, highStochStartLevel)

    if (!active && startSignal && finiteNumber(row.high)) {
      active = {
        hasFilterMatch: isHighFilterMatched(row, settings),
        highestHigh: row.high,
        highestHighIndex: index,
        reachedReversalZone: areStochLinesAbove(row.k, row.d, highStochZoneLevel),
        startIndex: index,
      }
    }

    if (!active) continue

    if (finiteNumber(row.high) && row.high > active.highestHigh) {
      active.highestHigh = row.high
      active.highestHighIndex = index
    }

    active.hasFilterMatch = active.hasFilterMatch || isHighFilterMatched(row, settings)
    active.reachedReversalZone = active.reachedReversalZone || areStochLinesAbove(row.k, row.d, highStochZoneLevel)

    if (active.reachedReversalZone && index > active.startIndex && doStochLinesBreakBelow(previousRow.k, previousRow.d, row.k, row.d, highStochEndLevel)) {
      if (active.hasFilterMatch) {
        const markerIndex = active.highestHighIndex
        rows[markerIndex] = {
          ...rows[markerIndex],
          highMarker: active.highestHigh,
          highMarkerPrice: active.highestHigh,
        }
      }
      active = null
    } else if (index > active.startIndex && doStochLinesFallBackBelow(previousRow.k, previousRow.d, row.k, row.d, highStochStartLevel)) {
      active = null
    }
  }

  return rows
}
