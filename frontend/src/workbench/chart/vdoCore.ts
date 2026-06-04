import type { KLineData } from 'klinecharts'
import { defaultVdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { VdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'

export type VdoCoreRow = {
  vdo?: number
  vdoMa?: number
  vdoMa2?: number
}

function normalizeVdoCoreSettings(input?: Partial<VdoIndicatorSettings>): VdoIndicatorSettings {
  return { ...defaultVdoIndicatorSettings, ...(input ?? {}) }
}

function clampPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(500, next)) : fallback
}

function clampSmoothingPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(0, Math.min(500, next)) : fallback
}

function calculateEmaSeries(values: Array<number | undefined>, period: number) {
  const output: Array<number | undefined> = values.map(() => undefined)
  if (period <= 1) return values
  const alpha = 2 / (period + 1)
  let previous: number | undefined

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) continue
    previous = previous == null ? value : alpha * (value as number) + (1 - alpha) * previous
    output[index] = previous
  }

  return output
}

export function calculateVdoSmaSeries(values: Array<number | undefined>, period: number) {
  const output: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  let finiteCount = 0

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (Number.isFinite(value)) {
      sum += value as number
      finiteCount += 1
    }

    if (index >= period) {
      const removed = values[index - period]
      if (Number.isFinite(removed)) {
        sum -= removed as number
        finiteCount -= 1
      }
    }

    if (index >= period - 1 && finiteCount === period) output[index] = sum / period
  }

  return output
}

function calculateRollingSum(values: number[], period: number) {
  const output: Array<number | undefined> = values.map(() => undefined)
  let sum = 0

  for (let index = 0; index < values.length; index += 1) {
    sum += values[index] ?? 0
    if (index >= period) sum -= values[index - period] ?? 0
    if (index >= period) output[index] = sum
  }

  return output
}

export function calculateVdoSourceRows(
  dataList: KLineData[],
  inputSettings: Partial<VdoIndicatorSettings> = defaultVdoIndicatorSettings,
): VdoCoreRow[] {
  const settings = normalizeVdoCoreSettings(inputSettings)
  const length = clampPeriod(settings.length, defaultVdoIndicatorSettings.length)
  const emaSmoothing = clampSmoothingPeriod(settings.emaSmoothing, defaultVdoIndicatorSettings.emaSmoothing)
  const plusMovement: number[] = dataList.map(() => 0)
  const minusMovement: number[] = dataList.map(() => 0)
  const trueRange: number[] = dataList.map(() => 0)

  for (let index = 1; index < dataList.length; index += 1) {
    const current = dataList[index]
    const previous = dataList[index - 1]
    const high = Number(current.high)
    const low = Number(current.low)
    const previousHigh = Number(previous.high)
    const previousLow = Number(previous.low)
    const previousClose = Number(previous.close)
    plusMovement[index] = Math.abs(high - previousLow)
    minusMovement[index] = Math.abs(low - previousHigh)
    trueRange[index] = Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose))
  }

  const plusSums = calculateRollingSum(plusMovement, length)
  const minusSums = calculateRollingSum(minusMovement, length)
  const trueRangeSums = calculateRollingSum(trueRange, length)

  const rawValues = dataList.map((_, index) => {
    const plusSum = plusSums[index]
    const minusSum = minusSums[index]
    const trueRangeSum = trueRangeSums[index]
    if (!Number.isFinite(plusSum) || !Number.isFinite(minusSum) || !Number.isFinite(trueRangeSum)) return {}
    if (trueRangeSum === 0) return {}
    return { vdo: (plusSum as number) / (trueRangeSum as number) - (minusSum as number) / (trueRangeSum as number) }
  })

  const smoothedValues = emaSmoothing > 1 ? calculateEmaSeries(rawValues.map((row) => row.vdo), emaSmoothing) : []
  return emaSmoothing <= 1
    ? rawValues
    : rawValues.map((row, index) => {
      const value = smoothedValues[index]
      return Number.isFinite(value) ? { vdo: value } : row
    })
}

export function calculateVdoIndicatorRows(
  dataList: KLineData[],
  inputSettings: Partial<VdoIndicatorSettings> = defaultVdoIndicatorSettings,
  options: { includeMovingAverages?: boolean } = {},
): VdoCoreRow[] {
  const settings = normalizeVdoCoreSettings(inputSettings)
  const rows = calculateVdoSourceRows(dataList, settings)
  if (options.includeMovingAverages === false) return rows

  const maLength = clampPeriod(settings.vdoMaLength, defaultVdoIndicatorSettings.vdoMaLength)
  const ma2Length = clampPeriod(settings.vdoMa2Length, defaultVdoIndicatorSettings.vdoMa2Length)
  const vdoMaValues = calculateVdoSmaSeries(rows.map((row) => row.vdo), maLength)
  const vdoMa2Values = calculateVdoSmaSeries(rows.map((row) => row.vdo), ma2Length)
  return rows.map((row, index) => ({
    ...row,
    ...(Number.isFinite(vdoMaValues[index]) ? { vdoMa: vdoMaValues[index] } : {}),
    ...(Number.isFinite(vdoMa2Values[index]) ? { vdoMa2: vdoMa2Values[index] } : {}),
  }))
}
