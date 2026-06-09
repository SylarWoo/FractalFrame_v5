import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewStochRows } from '../tradingViewStochIndicator'
import { calculateTradingViewTsiRows } from '../tradingViewTsiIndicator'
import { calculateTradingViewVdoRows } from '../tradingViewVdoIndicator'
import { calculateTradingViewVmiRows } from '../tradingViewVmiIndicator'
import { finiteNumber, numeric, toMmfV3KLineDataV2 } from './mmfV3FrontendMathV2'
import type { MmfV3FeatureRowV2, MmfV3NormalizedContextV2 } from './mmfV3FrontendTypesV2'

function applyVdoThresholdStates(features: MmfV3FeatureRowV2[]) {
  let overboughtEpoch = -1
  let oversoldEpoch = -1
  let isOverbought = false
  let isOversold = false

  for (let index = 0; index < features.length; index += 1) {
    const row = features[index]
    const previous = features[index - 1]
    const upper = Math.min(row.vdoUpLineValue, row.vdoUpLine2Value)
    const lower = Math.max(row.vdoDownLineValue, row.vdoDownLine2Value)
    const previousUpper = previous ? Math.min(previous.vdoUpLineValue, previous.vdoUpLine2Value) : Number.NaN
    const previousLower = previous ? Math.max(previous.vdoDownLineValue, previous.vdoDownLine2Value) : Number.NaN
    const enterOverbought = finiteNumber(previous?.vdo) && finiteNumber(row.vdo) && previous.vdo < previousUpper && row.vdo >= upper && !isOverbought
    const exitOverbought = finiteNumber(previous?.vdo) && finiteNumber(row.vdo) && previous.vdo > previousUpper && row.vdo <= upper && isOverbought
    const enterOversold = finiteNumber(previous?.vdo) && finiteNumber(row.vdo) && previous.vdo > previousLower && row.vdo <= lower && !isOversold
    const exitOversold = finiteNumber(previous?.vdo) && finiteNumber(row.vdo) && previous.vdo < previousLower && row.vdo >= lower && isOversold

    if (exitOverbought) isOverbought = false
    if (exitOversold) isOversold = false
    if (enterOverbought) {
      overboughtEpoch += 1
      isOverbought = true
    }
    if (enterOversold) {
      oversoldEpoch += 1
      isOversold = true
    }

    row.vdoEnterOverbought = enterOverbought
    row.vdoExitOverbought = exitOverbought
    row.vdoEnterOversold = enterOversold
    row.vdoExitOversold = exitOversold
    row.vdoOverboughtActive = isOverbought
    row.vdoOversoldActive = isOversold
    row.vdoOverboughtEpoch = isOverbought ? overboughtEpoch : null
    row.vdoOversoldEpoch = isOversold ? oversoldEpoch : null
  }
}

function applyVdoCrossColumns(features: MmfV3FeatureRowV2[]) {
  let bullActive = false
  let bearActive = false
  for (let index = 1; index < features.length; index += 1) {
    const previous = features[index - 1]
    const row = features[index]
    const crossUp = finiteNumber(previous.vdo) && finiteNumber(previous.vdoBaseMa) && finiteNumber(row.vdo) && finiteNumber(row.vdoBaseMa) &&
      previous.vdo < previous.vdoBaseMa && row.vdo >= row.vdoBaseMa
    const crossDown = finiteNumber(previous.vdo) && finiteNumber(previous.vdoBaseMa) && finiteNumber(row.vdo) && finiteNumber(row.vdoBaseMa) &&
      previous.vdo > previous.vdoBaseMa && row.vdo <= row.vdoBaseMa
    row.vdoCrossUpBaseMa = crossUp
    row.vdoCrossDownBaseMa = crossDown
    if (crossUp) {
      bullActive = true
      bearActive = false
    }
    if (crossDown) {
      bearActive = true
      bullActive = false
    }
    row.vdoBullMarketActive = bullActive
    row.vdoBearMarketActive = bearActive
  }
}

function applyTsiCrossColumns(features: MmfV3FeatureRowV2[]) {
  for (let index = 1; index < features.length; index += 1) {
    const previous = features[index - 1]
    const row = features[index]
    row.tsiCrossUpSignal = finiteNumber(previous.tsi) && finiteNumber(previous.tsiSignal) && finiteNumber(row.tsi) && finiteNumber(row.tsiSignal) &&
      previous.tsi <= previous.tsiSignal && row.tsi > row.tsiSignal
    row.tsiCrossDownSignal = finiteNumber(previous.tsi) && finiteNumber(previous.tsiSignal) && finiteNumber(row.tsi) && finiteNumber(row.tsiSignal) &&
      previous.tsi >= previous.tsiSignal && row.tsi < row.tsiSignal
  }
}

export function buildMmfV3FeatureRowsV2(rows: StoreV6WindowKLine[], context: MmfV3NormalizedContextV2): MmfV3FeatureRowV2[] {
  const kLines = rows.map(toMmfV3KLineDataV2)
  const stochRows = calculateTradingViewStochRows(kLines, context.stochSettings)
  const vdoRows = calculateTradingViewVdoRows(kLines, context.vdoSettings)
  const vmiRows = calculateTradingViewVmiRows(kLines, context.vmiSettings, context.vdoSettings)
  const tsiRows = calculateTradingViewTsiRows(kLines, context.tsiSettings)

  const features = rows.map((row, index): MmfV3FeatureRowV2 => {
    const vdo = vdoRows[index]
    const tsi = tsiRows[index]
    return {
      barKey: row.barKey,
      close: numeric(row.close),
      high: numeric(row.high),
      index,
      low: numeric(row.low),
      open: numeric(row.open),
      stochD: stochRows[index]?.d,
      stochK: stochRows[index]?.k,
      time: Math.trunc(numeric(row.time, numeric(row.timestamp, 0) / 1000)),
      tsi: tsi?.tsi,
      tsiHistogram: finiteNumber(tsi?.tsi) && finiteNumber(tsi?.signal) ? tsi.tsi - tsi.signal : undefined,
      tsiSignal: tsi?.signal,
      vdo: vdo?.vdo,
      vdoBase2Ma: vdo?.vdoMa2,
      vdoBaseMa: vdo?.vdoMa,
      vdoDownLine2Value: context.vdoSettings.downLine2Value,
      vdoDownLineValue: context.vdoSettings.downLineValue,
      vdoUpLine2Value: context.vdoSettings.upLine2Value,
      vdoUpLineValue: context.vdoSettings.upLineValue,
      vmiHistogram: vmiRows[index]?.histogram,
    }
  })

  applyVdoThresholdStates(features)
  applyVdoCrossColumns(features)
  applyTsiCrossColumns(features)
  return features
}
