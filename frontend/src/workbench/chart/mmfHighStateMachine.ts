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

const highCrossMinLevel = 60
const stochConfirmDistance = 7
const crossWindowRadius = 7

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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

function resolveDeadCrossValue(
  previousK: number | undefined,
  previousD: number | undefined,
  k: number | undefined,
  d: number | undefined,
) {
  if (!finiteNumber(previousK) || !finiteNumber(previousD) || !finiteNumber(k) || !finiteNumber(d)) return null
  if (!(previousK >= previousD && k < d)) return null
  return resolveStochCrossValue(previousK, previousD, k, d)
}

function resolveGoldenCrossValue(
  previousK: number | undefined,
  previousD: number | undefined,
  k: number | undefined,
  d: number | undefined,
) {
  if (!finiteNumber(previousK) || !finiteNumber(previousD) || !finiteNumber(k) || !finiteNumber(d)) return null
  if (!(previousK <= previousD && k > d)) return null
  return resolveStochCrossValue(previousK, previousD, k, d)
}

function isHighFilterMatched(row: MmfHighInputRow, settings: MmfHighStateMachineSettings) {
  return (
    (finiteNumber(row.high) && finiteNumber(row.morganLevel) && row.high >= row.morganLevel)
    || (finiteNumber(row.dpo) && row.dpo >= settings.dpoThreshold)
  )
}

function getCenteredWindow(index: number, rowsCount: number) {
  return {
    endIndex: Math.min(rowsCount - 1, index + crossWindowRadius),
    startIndex: Math.max(0, index - crossWindowRadius),
  }
}

function hasHighFilterInWindow(inputRows: MmfHighInputRow[], settings: MmfHighStateMachineSettings, startIndex: number, endIndex: number) {
  for (let index = startIndex; index <= endIndex; index += 1) {
    if (isHighFilterMatched(inputRows[index], settings)) return true
  }
  return false
}

function findHighestHighIndex(inputRows: MmfHighInputRow[], startIndex: number, endIndex: number) {
  let highestIndex: number | null = null
  let highestHigh: number | null = null
  for (let index = startIndex; index <= endIndex; index += 1) {
    const high = inputRows[index]?.high
    if (!finiteNumber(high)) continue
    if (highestHigh == null || high > highestHigh) {
      highestHigh = high
      highestIndex = index
    }
  }
  return highestIndex
}

function hasGoldenCrossAfterIndex(inputRows: MmfHighInputRow[], crossIndex: number) {
  const endIndex = Math.min(inputRows.length - 1, crossIndex + crossWindowRadius)
  for (let index = crossIndex + 1; index <= endIndex; index += 1) {
    const previousRow = inputRows[index - 1]
    const row = inputRows[index]
    if (resolveGoldenCrossValue(previousRow?.k, previousRow?.d, row?.k, row?.d) != null) return true
  }
  return false
}

export function calculateMmfHighStateMachineRows(
  inputRows: MmfHighInputRow[],
  settings: MmfHighStateMachineSettings,
): MmfHighMarkerRow[] {
  const rows: MmfHighMarkerRow[] = inputRows.map(() => ({}))
  let activeCross: { index: number, value: number } | null = null

  for (let index = 1; index < inputRows.length; index += 1) {
    const row = inputRows[index]
    const previousRow = inputRows[index - 1]

    if (activeCross && index > activeCross.index && finiteNumber(row.k) && row.k <= activeCross.value - stochConfirmDistance) {
      const { startIndex, endIndex } = getCenteredWindow(activeCross.index, inputRows.length)
      const markerIndex = findHighestHighIndex(inputRows, startIndex, endIndex)
      if (
        markerIndex != null
        && !hasGoldenCrossAfterIndex(inputRows, activeCross.index)
        && hasHighFilterInWindow(inputRows, settings, startIndex, endIndex)
      ) {
        const markerPrice = inputRows[markerIndex]?.high
        if (finiteNumber(markerPrice)) {
          rows[markerIndex] = {
            ...rows[markerIndex],
            highMarker: markerPrice,
            highMarkerPrice: markerPrice,
            highRangeEndIndex: endIndex,
            highRangeStartIndex: startIndex,
          }
        }
      }
      activeCross = null
    }

    const deadCrossValue = resolveDeadCrossValue(previousRow.k, previousRow.d, row.k, row.d)
    if (deadCrossValue != null && deadCrossValue >= highCrossMinLevel) {
      activeCross = { index, value: deadCrossValue }
    }
  }

  return rows
}
