import type { MmfV3IndicatorMarker } from '../../../services/mt5/mmfV3IndicatorApi'
import {
  defaultMaIndicatorSettings,
  defaultStochIndicatorSettings,
  defaultVwapIndicatorSettings,
  normalizeMmfSettings,
  normalizeStochSettings,
  normalizeTsiSettings,
  normalizeVdoSettings,
  normalizeVmiSettings,
  normalizeVwapSettings,
  type MaIndicatorSettings,
  type MmfIndicatorSettings,
  type StochIndicatorSettings,
  type TsiIndicatorSettings,
  type VdoIndicatorSettings,
  type VmiIndicatorSettings,
  type VwapIndicatorSettings,
} from '../../rightDrawer/indicatorSettingsSchema'
import { createMmfV3RowsFromMarkers } from '../mmfV3MarkerMapping'
import type { MmfV3CalcContext, MmfV3IndicatorRow } from '../mmfV3Types'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import {
  clampInteger,
  finiteNumber,
  numeric,
  toMmfV3KLineDataV2,
} from './mmfV3FrontendMathV2'
import { buildMmfV3FeatureRowsV2 } from './mmfV3FeatureRowsV2'
import type { MmfV3FeatureRowV2, MmfV3NormalizedContextV2 } from './mmfV3FrontendTypesV2'
import { calculateStochStateSignalsV2, type MmfV3SignalSideV2, type StochStateSignalV2 } from './mmfV3StochStateSignalsV2'

type MmfV3SignalSide = MmfV3SignalSideV2
type MmfV3SignalType = MmfV3IndicatorMarker['type']

type ClassificationMapV2 = Map<number, { reason: string; type: MmfV3SignalType }>

export function normalizeMmfV3FrontendContextV2(input: MmfV3CalcContext): MmfV3NormalizedContextV2 {
  return {
    maSettings: {
      ...defaultMaIndicatorSettings,
      length: 120,
      source: 'hlc3',
      type: 'sma',
      ...(input.maSettings as Partial<MaIndicatorSettings> | undefined ?? {}),
    },
    morganRangeMode: input.morganRangeMode === 'D1_M30' ? 'D1_M30' : 'H4_M5',
    period: String(input.period || 'M5').trim().toUpperCase(),
    settings: normalizeMmfSettings(input.settings as Partial<MmfIndicatorSettings> | undefined),
    stochSettings: normalizeStochSettings({
      ...defaultStochIndicatorSettings,
      length: 28,
      kSmoothing: 6,
      dSmoothing: 6,
      ...(input.stochSettings as Partial<StochIndicatorSettings> | undefined ?? {}),
    }),
    symbol: typeof input.symbol === 'string' ? input.symbol : '',
    tsiSettings: normalizeTsiSettings(input.tsiSettings as Partial<TsiIndicatorSettings> | undefined),
    vdoSettings: normalizeVdoSettings(input.vdoSettings as Partial<VdoIndicatorSettings> | undefined),
    vmiSettings: normalizeVmiSettings(input.vmiSettings as Partial<VmiIndicatorSettings> | undefined),
    vwapSettings: normalizeVwapSettings(input.vwapSettings as Partial<VwapIndicatorSettings> | undefined ?? defaultVwapIndicatorSettings),
  }
}

function createMarker(signal: StochStateSignalV2, settings: MmfIndicatorSettings, classification?: { reason: string; type: MmfV3SignalType }): MmfV3IndicatorMarker {
  const type = classification?.type ?? (signal.type === 'high' ? 'MMF_V3_HIGH' : 'MMF_V3_LOW')
  const baseReason = signal.type === 'high'
    ? ['stoch_dead_cross', 'stoch_cross_detected', `confirm_within_${signal.confirm.maxBars}_bars`, `anchor_left_of_cross_${settings.highAnchorLookbackBars}_bars`, `stoch_down_advance_${settings.highStochKAdvance}`, 'highest_high_anchor']
    : ['stoch_golden_cross', 'stoch_cross_detected', `confirm_within_${signal.confirm.maxBars}_bars`, `anchor_left_of_cross_${settings.lowAnchorLookbackBars}_bars`, `stoch_up_advance_${settings.lowStochKAdvance}`, 'lowest_low_anchor']
  return {
    confirmBarKey: signal.confirm.barKey,
    confirmIndex: signal.confirm.index,
    confirmTime: signal.confirm.time,
    entryBarKey: signal.entryBarKey,
    entryIndex: signal.entryIndex,
    entryPrice: signal.entryPrice,
    entryTime: signal.entryTime,
    eventBarKey: signal.cross.barKey,
    eventIndex: signal.cross.index,
    eventTime: signal.cross.time,
    index: signal.anchor.index,
    markerBarKey: signal.anchor.barKey,
    markerIndex: signal.anchor.index,
    pointDistance: signal.pointDistance,
    price: signal.anchor.price,
    reason: classification ? [...baseReason, classification.reason] : baseReason,
    time: signal.anchor.time,
    type,
    windowEndBarKey: signal.anchor.windowEndBarKey,
    windowEndIndex: signal.anchor.windowEndIndex,
    windowEndTime: signal.anchor.windowEndTime,
    windowStartBarKey: signal.anchor.windowStartBarKey,
    windowStartIndex: signal.anchor.windowStartIndex,
    windowStartTime: signal.anchor.windowStartTime,
  }
}

function vmiZeroWindows(features: MmfV3FeatureRowV2[], side: 'support' | 'resistance') {
  const windows: Array<{ end: number; reason: string; start: number }> = []
  let activeStart: number | null = null
  for (let index = 1; index < features.length; index += 1) {
    const previous = features[index - 1].vmiHistogram
    const current = features[index].vmiHistogram
    if (!finiteNumber(previous) || !finiteNumber(current)) continue
    const crossUp = previous <= 0 && current > 0
    const crossDown = previous >= 0 && current < 0
    if (side === 'support') {
      if (crossDown) {
        activeStart = index
      } else if (activeStart != null && index > activeStart && crossUp) {
        windows.push({ end: index, reason: `support_vmi_cross_down_zero_${activeStart}_to_cross_up_zero_${index}`, start: activeStart })
        activeStart = null
      }
      continue
    }
    if (crossUp) {
      activeStart = index
    } else if (activeStart != null && index > activeStart && crossDown) {
      windows.push({ end: index, reason: `resistance_vmi_cross_up_zero_${activeStart}_to_cross_down_zero_${index}`, start: activeStart })
      activeStart = null
    }
  }
  return windows
}

function classifyVmiZeroLevels(features: MmfV3FeatureRowV2[], signals: StochStateSignalV2[], settings: MmfIndicatorSettings): ClassificationMapV2 {
  const classifications: ClassificationMapV2 = new Map()
  if (settings.showSupportLevel) {
    const candidates = signals.map((signal, index) => ({ index, signal })).filter((entry) => entry.signal.type === 'low')
    for (const window of vmiZeroWindows(features, 'support')) {
      const inWindow = candidates.filter((entry) => window.start <= entry.signal.anchor.index && entry.signal.anchor.index <= window.end)
      const selected = inWindow.sort((left, right) => left.signal.anchor.price - right.signal.anchor.price || left.signal.anchor.index - right.signal.anchor.index)[0]
      if (selected) classifications.set(selected.index, { reason: window.reason, type: 'MMF_V3_SUPPORT' })
    }
  }
  if (settings.showResistanceLevel) {
    const candidates = signals.map((signal, index) => ({ index, signal })).filter((entry) => entry.signal.type === 'high')
    for (const window of vmiZeroWindows(features, 'resistance')) {
      const inWindow = candidates.filter((entry) => window.start <= entry.signal.anchor.index && entry.signal.anchor.index <= window.end)
      const selected = inWindow.sort((left, right) => right.signal.anchor.price - left.signal.anchor.price || left.signal.anchor.index - right.signal.anchor.index)[0]
      if (selected) classifications.set(selected.index, { reason: window.reason, type: 'MMF_V3_RESISTANCE' })
    }
  }
  return classifications
}

function applyVmiDivergenceClassifications(features: MmfV3FeatureRowV2[], signals: StochStateSignalV2[], settings: MmfIndicatorSettings, classifications: ClassificationMapV2) {
  if (settings.showTopDivergencePoint) {
    applySideDivergence(features, signals, classifications, 'high', 'MMF_V3_RESISTANCE', 'MMF_V3_TOP_DIVERGENCE', 'vdoOverboughtEpoch', 'vdoOverboughtActive', (current, base) => current > base, (current, base) => current < base, 'top_divergence')
  }
  if (settings.showBottomDivergencePoint) {
    applySideDivergence(features, signals, classifications, 'low', 'MMF_V3_SUPPORT', 'MMF_V3_BOTTOM_DIVERGENCE', 'vdoOversoldEpoch', 'vdoOversoldActive', (current, base) => current < base, (current, base) => current > base, 'bottom_divergence')
  }
}

function applySideDivergence(
  features: MmfV3FeatureRowV2[],
  signals: StochStateSignalV2[],
  classifications: ClassificationMapV2,
  side: MmfV3SignalSide,
  baseType: MmfV3SignalType,
  divergenceType: MmfV3SignalType,
  epochColumn: 'vdoOverboughtEpoch' | 'vdoOversoldEpoch',
  activeColumn: 'vdoOverboughtActive' | 'vdoOversoldActive',
  priceDiverges: (current: number, base: number) => boolean,
  vmiDiverges: (current: number, base: number) => boolean,
  reasonPrefix: string,
) {
  const baseByEpoch = new Map<number, { price: number; signal: StochStateSignalV2; vmi: number }>()
  signals.forEach((signal, signalIndex) => {
    if (signal.type !== side) return
    const row = features[signal.anchor.index]
    if (!row?.[activeColumn]) return
    const epoch = row[epochColumn]
    const vmi = row.vmiHistogram
    if (!finiteNumber(epoch) || !finiteNumber(vmi)) return
    const markerType = classifications.get(signalIndex)?.type ?? (side === 'high' ? 'MMF_V3_HIGH' : 'MMF_V3_LOW')
    const base = baseByEpoch.get(epoch)
    if (base && priceDiverges(signal.anchor.price, base.price) && vmiDiverges(vmi, base.vmi)) {
      classifications.set(signalIndex, {
        reason: `${reasonPrefix}_epoch_${epoch}_compare_base_${base.signal.anchor.index}_candidate_${signal.anchor.index}_price_${signal.anchor.price}_vs_${base.price}_vmi_${vmi}_vs_${base.vmi}`,
        type: divergenceType,
      })
    }
    if (markerType === baseType) {
      baseByEpoch.set(epoch, { price: signal.anchor.price, signal, vmi })
    }
  })
}

function createTrendRetraceMarkers(features: MmfV3FeatureRowV2[], signals: StochStateSignalV2[], settings: MmfIndicatorSettings, classifications: ClassificationMapV2) {
  const markers: MmfV3IndicatorMarker[] = []
  signals.forEach((signal, signalIndex) => {
    const markerType = classifications.get(signalIndex)?.type ?? (signal.type === 'high' ? 'MMF_V3_HIGH' : 'MMF_V3_LOW')
    const row = features[signal.anchor.index]
    if (
      settings.showTrendDownReboundPoint &&
      signal.type === 'high' &&
      (markerType === 'MMF_V3_HIGH' || markerType === 'MMF_V3_RESISTANCE') &&
      row?.vdoBearMarketActive === true &&
      row.vdoOversoldActive === true &&
      numeric(row.vmiHistogram, 0) > 0
    ) {
      markers.push(createMarker(signal, settings, { reason: 'trend_down_rebound_oversold_active_high_or_resistance_positive_vmi', type: 'MMF_V3_TREND_DOWN_REBOUND' }))
    }
    if (
      settings.showTrendUpPullbackPoint &&
      signal.type === 'low' &&
      (markerType === 'MMF_V3_LOW' || markerType === 'MMF_V3_SUPPORT') &&
      row?.vdoBullMarketActive === true &&
      row.vdoOverboughtActive === true &&
      numeric(row.vmiHistogram, 0) < 0
    ) {
      markers.push(createMarker(signal, settings, { reason: 'trend_up_pullback_overbought_active_low_or_support_negative_vmi', type: 'MMF_V3_TREND_UP_PULLBACK' }))
    }
  })
  return markers
}

function createSingleRowMarker(features: MmfV3FeatureRowV2[], index: number, type: MmfV3SignalType, priceKey: 'high' | 'low', reason: string): MmfV3IndicatorMarker | null {
  const row = features[index]
  const price = row?.[priceKey]
  if (!row || !finiteNumber(price)) return null
  return {
    confirmBarKey: row.barKey,
    confirmIndex: index,
    confirmTime: row.time,
    entryBarKey: row.barKey,
    entryIndex: index,
    entryPrice: price,
    entryTime: row.time,
    eventBarKey: row.barKey,
    eventIndex: index,
    eventTime: row.time,
    index,
    markerBarKey: row.barKey,
    markerIndex: index,
    pointDistance: 0,
    price,
    reason: [reason],
    time: row.time,
    type,
    windowEndBarKey: row.barKey,
    windowEndIndex: index,
    windowEndTime: row.time,
    windowStartBarKey: row.barKey,
    windowStartIndex: index,
    windowStartTime: row.time,
  }
}

function createVdoMarkers(features: MmfV3FeatureRowV2[], settings: MmfIndicatorSettings) {
  const specs: Array<[boolean, keyof MmfV3FeatureRowV2, MmfV3SignalType, 'high' | 'low', string]> = [
    [settings.showBullMarketPoint, 'vdoCrossUpBaseMa', 'MMF_V3_BULL_MARKET', 'low', 'vdo_cross_up_base_ma'],
    [settings.showBearMarketPoint, 'vdoCrossDownBaseMa', 'MMF_V3_BEAR_MARKET', 'high', 'vdo_cross_down_base_ma'],
    [settings.showOverboughtPoint, 'vdoEnterOverbought', 'MMF_V3_OVERBOUGHT', 'low', 'vdo_cross_up_upper_overbought_open'],
    [settings.showOverboughtClosePoint, 'vdoExitOverbought', 'MMF_V3_OVERBOUGHT_CLOSE', 'high', 'vdo_cross_down_upper_overbought_close'],
    [settings.showOversoldPoint, 'vdoEnterOversold', 'MMF_V3_OVERSOLD', 'high', 'vdo_cross_down_lower_oversold_open'],
    [settings.showOversoldClosePoint, 'vdoExitOversold', 'MMF_V3_OVERSOLD_CLOSE', 'low', 'vdo_cross_up_lower_oversold_close'],
  ]
  return specs.flatMap(([enabled, key, type, priceKey, reason]) => {
    if (!enabled) return []
    return features.flatMap((row, index) => row[key] === true ? [createSingleRowMarker(features, index, type, priceKey, reason)].filter((marker): marker is MmfV3IndicatorMarker => marker != null) : [])
  })
}

function createTsiMarkers(features: MmfV3FeatureRowV2[], settings: MmfIndicatorSettings) {
  return [
    ...createTsiSideMarkers(features, settings.showTsiDeadCrossPoint, settings.showTsiDeadCrossConfirmPoint, 'tsiCrossDownSignal', 'tsiCrossUpSignal', 'MMF_V3_TSI_DEAD_CROSS', 'MMF_V3_TSI_DEAD_CROSS_CONFIRM', 'high', 'tsi_dead_cross', -1, numeric(settings.tsiDeadCrossConfirmDistance, 5)),
    ...createTsiSideMarkers(features, settings.showTsiGoldenCrossPoint, settings.showTsiGoldenCrossConfirmPoint, 'tsiCrossUpSignal', 'tsiCrossDownSignal', 'MMF_V3_TSI_GOLDEN_CROSS', 'MMF_V3_TSI_GOLDEN_CROSS_CONFIRM', 'low', 'tsi_golden_cross', 1, numeric(settings.tsiGoldenCrossConfirmDistance, 5)),
  ]
}

function createTsiSideMarkers(
  features: MmfV3FeatureRowV2[],
  showCross: boolean,
  showConfirm: boolean,
  crossColumn: 'tsiCrossDownSignal' | 'tsiCrossUpSignal',
  oppositeColumn: 'tsiCrossDownSignal' | 'tsiCrossUpSignal',
  crossType: MmfV3SignalType,
  confirmType: MmfV3SignalType,
  priceKey: 'high' | 'low',
  reasonPrefix: string,
  sign: -1 | 1,
  confirmDistance: number,
) {
  if (!showCross && !showConfirm) return []
  const markers: MmfV3IndicatorMarker[] = []
  features.forEach((row, crossIndex) => {
    if (row[crossColumn] !== true) return
    let confirmIndex: number | null = null
    for (let index = crossIndex; index < features.length; index += 1) {
      if (index > crossIndex && features[index][oppositeColumn] === true) break
      const hist = features[index].tsiHistogram
      if (finiteNumber(hist) && hist * sign >= confirmDistance) {
        confirmIndex = index
        break
      }
    }
    if (confirmIndex == null) return
    if (showCross) {
      const marker = createSingleRowMarker(features, crossIndex, crossType, priceKey, `${reasonPrefix}_cross`)
      if (marker) markers.push(marker)
    }
    if (showConfirm) {
      const marker = createSingleRowMarker(features, confirmIndex, confirmType, priceKey, `${reasonPrefix}_confirm_distance_${confirmDistance}`)
      if (marker) {
        marker.eventIndex = crossIndex
        marker.eventBarKey = features[crossIndex].barKey
        marker.eventTime = features[crossIndex].time
        marker.windowStartIndex = crossIndex
        marker.windowStartBarKey = features[crossIndex].barKey
        marker.windowStartTime = features[crossIndex].time
        markers.push(marker)
      }
    }
  })
  return markers
}

export function calculateMmfV3FrontendRowsForDisplayPageV2(options: {
  calculationRows: StoreV6WindowKLine[]
  displayRows: StoreV6WindowKLine[]
  inputContext: MmfV3CalcContext
}): MmfV3IndicatorRow[] {
  const context = normalizeMmfV3FrontendContextV2(options.inputContext)
  const features = buildMmfV3FeatureRowsV2(options.calculationRows, context)
  const signals = calculateStochStateSignalsV2(features, context.settings)
  const classifications = classifyVmiZeroLevels(features, signals, context.settings)
  applyVmiDivergenceClassifications(features, signals, context.settings, classifications)
  const markers = [
    ...signals.map((signal, index) => createMarker(signal, context.settings, classifications.get(index))),
    ...createTrendRetraceMarkers(features, signals, context.settings, classifications),
    ...createTsiMarkers(features, context.settings),
    ...createVdoMarkers(features, context.settings),
  ].sort((left, right) => left.markerIndex - right.markerIndex || left.type.localeCompare(right.type))

  const calculationKLines = options.calculationRows.map(toMmfV3KLineDataV2)
  const rows = createMmfV3RowsFromMarkers(calculationKLines, markers)
  const byBarKey = new Map<string, MmfV3IndicatorRow>()
  options.calculationRows.forEach((row, index) => {
    byBarKey.set(row.barKey, rows[index] ?? {})
  })
  return options.displayRows.map((row) => byBarKey.get(row.barKey) ?? {})
}

export function requiredMmfV3FrontendWarmupRowsV2(input: MmfV3CalcContext) {
  const context = normalizeMmfV3FrontendContextV2(input)
  return Math.max(
    context.stochSettings.length + context.stochSettings.kSmoothing + context.stochSettings.dSmoothing + Math.max(context.settings.highAnchorLookbackBars, context.settings.lowAnchorLookbackBars),
    context.vdoSettings.length + context.vdoSettings.emaSmoothing + context.vdoSettings.vdoMaLength + context.vdoSettings.vdoMa2Length,
    Math.max(context.vmiSettings.fastLength, context.vmiSettings.slowLength) + context.vdoSettings.length + context.vdoSettings.emaSmoothing,
    context.tsiSettings.longLength + context.tsiSettings.shortLength + context.tsiSettings.signalLength,
    clampInteger(context.maSettings.length, 120, 1, 5000),
    600,
  )
}
