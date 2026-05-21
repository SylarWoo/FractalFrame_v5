import { readBooleanFlag, readJson, removeStorageItem, writeBooleanFlag, writeJson } from '../persistence/jsonStorage'

export type RsiSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'
export type RsiSmoothingType = 'none' | 'sma' | 'sma_bb' | 'ema' | 'smma' | 'wma' | 'vwma'
export type RsiPrecision = 'system' | '0' | '1' | '2' | '3' | '4'
export type RsiLineStyle = 'solid' | 'dashed' | 'dotted'
export type MaType = 'sma' | 'ema' | 'smma' | 'wma' | 'vwma'
export type MaSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'
export type MaMarkerMode = 'bar_down' | 'bar_up' | 'triangle_down' | 'triangle_up'
export type IndicatorSettingsTab = 'input' | 'style' | 'visibility'
export type VwapAnchorPeriod = 'session' | 'week' | 'month' | 'quarter' | 'year' | 'decade' | 'century'
export type VwapBandCalculationMode = 'standard_deviation' | 'percentage'
export type VwapSource = 'hlc3' | 'close' | 'open' | 'high' | 'low' | 'hl2' | 'ohlc4'
export type VwapTimeframe = 'chart' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'
export type MacdMaType = 'ema' | 'sma'

export type MacdIndicatorSettings = {
  source: RsiSource
  fastLength: number
  slowLength: number
  signalLength: number
  oscillatorMaType: MacdMaType
  signalMaType: MacdMaType
  timeframe: VwapTimeframe
  waitForTimeframeClose: boolean
  histogramVisible: boolean
  histogramColor0: string
  histogramColor0Opacity: number
  histogramColor1: string
  histogramColor1Opacity: number
  histogramColor2: string
  histogramColor2Opacity: number
  histogramColor3: string
  histogramColor3Opacity: number
  macdVisible: boolean
  macdColor: string
  macdLineStyle: RsiLineStyle
  macdLineWidth: number
  macdOpacity: number
  signalVisible: boolean
  signalColor: string
  signalLineStyle: RsiLineStyle
  signalLineWidth: number
  signalOpacity: number
  zeroLineVisible: boolean
  zeroLineColor: string
  zeroLineStyle: RsiLineStyle
  zeroLineWidth: number
  zeroLineOpacity: number
  precision: RsiPrecision
  priceScaleLabelsVisible: boolean
  statusLineValuesVisible: boolean
  inputStatusLineVisible: boolean
}

export type TsiIndicatorSettings = {
  longLength: number
  shortLength: number
  signalLength: number
  timeframe: VwapTimeframe
  waitForTimeframeClose: boolean
  tsiVisible: boolean
  tsiColor: string
  tsiLineStyle: RsiLineStyle
  tsiLineWidth: number
  tsiOpacity: number
  signalVisible: boolean
  signalColor: string
  signalLineStyle: RsiLineStyle
  signalLineWidth: number
  signalOpacity: number
  zeroLineVisible: boolean
  zeroLineColor: string
  zeroLineStyle: RsiLineStyle
  zeroLineWidth: number
  zeroLineOpacity: number
  precision: RsiPrecision
  priceScaleLabelsVisible: boolean
  statusLineValuesVisible: boolean
  inputStatusLineVisible: boolean
}

export type ViIndicatorSettings = {
  length: number
  timeframe: VwapTimeframe
  waitForTimeframeClose: boolean
  plusVisible: boolean
  plusColor: string
  plusLineStyle: RsiLineStyle
  plusLineWidth: number
  plusOpacity: number
  minusVisible: boolean
  minusColor: string
  minusLineStyle: RsiLineStyle
  minusLineWidth: number
  minusOpacity: number
  precision: RsiPrecision
  priceScaleLabelsVisible: boolean
  statusLineValuesVisible: boolean
  inputStatusLineVisible: boolean
}

export type StochIndicatorSettings = {
  backgroundFillColor: string
  backgroundFillOpacity: number
  backgroundFillVisible: boolean
  dColor: string
  dLineStyle: RsiLineStyle
  dLineWidth: number
  dOpacity: number
  dSmoothing: number
  dVisible: boolean
  inputStatusLineVisible: boolean
  kColor: string
  kLineStyle: RsiLineStyle
  kLineWidth: number
  kOpacity: number
  kSmoothing: number
  kVisible: boolean
  length: number
  lowerBand: number
  lowerBandColor: string
  lowerBandLineStyle: RsiLineStyle
  lowerBandLineWidth: number
  lowerBandOpacity: number
  lowerBandVisible: boolean
  middleBand: number
  middleBandColor: string
  middleBandLineStyle: RsiLineStyle
  middleBandLineWidth: number
  middleBandOpacity: number
  middleBandVisible: boolean
  precision: RsiPrecision
  priceScaleLabelsVisible: boolean
  statusLineValuesVisible: boolean
  upperBand: number
  upperBandColor: string
  upperBandLineStyle: RsiLineStyle
  upperBandLineWidth: number
  upperBandOpacity: number
  upperBandVisible: boolean
}

export type VwapIndicatorSettings = {
  anchorPeriod: VwapAnchorPeriod
  bandCalculationMode: VwapBandCalculationMode
  band1Multiplier: number
  band1Visible: boolean
  band1FillColor: string
  band1FillOpacity: number
  band1FillVisible: boolean
  band1LowerColor: string
  band1LowerLineStyle: RsiLineStyle
  band1LowerLineWidth: number
  band1LowerOpacity: number
  band1LowerVisible: boolean
  band1UpperColor: string
  band1UpperLineStyle: RsiLineStyle
  band1UpperLineWidth: number
  band1UpperOpacity: number
  band1UpperVisible: boolean
  band2Multiplier: number
  band2Visible: boolean
  band3Multiplier: number
  band3Visible: boolean
  hideOnDailyOrAbove: boolean
  inputsInStatusLine: boolean
  offset: number
  precision: RsiPrecision
  priceScaleLabelsVisible: boolean
  source: VwapSource
  statusLineValuesVisible: boolean
  timeframe: VwapTimeframe
  vwapColor: string
  vwapLineStyle: RsiLineStyle
  vwapLineWidth: number
  vwapOpacity: number
  vwapVisible: boolean
  waitForTimeframeClose: boolean
}

export type VolIndicatorSettings = {
  colorBasedOnPreviousClose: boolean
  inputsInStatusLine: boolean
  labelsOnPriceScale: boolean
  maChecked: boolean
  maColor: string
  maLineStyle: RsiLineStyle
  maLineWidth: number
  maOpacity: number
  maLength: number
  precision: RsiPrecision
  valuesInStatusLine: boolean
  volumeChecked: boolean
  volumeDownColor: string
  volumeDownOpacity: number
  volumeUpColor: string
  volumeUpOpacity: number
}

export type MaIndicatorSettings = {
  colors: string[]
  dnColor: string
  dnMarkerMode: MaMarkerMode
  dnVisible: boolean
  inputStatusLineVisible: boolean
  length: number
  maFadedColor: string
  maFadedLineStyle: RsiLineStyle
  maFadedLineWidth: number
  maFadedOpacity: number
  maFadedVisible: boolean
  maLineColor: string
  maLineStyle: RsiLineStyle
  maLineWidth: number
  maLineOpacity: number
  maLineVisible: boolean
  precision: RsiPrecision
  priceScaleLabelsVisible: boolean
  shiftLength: number
  shiftMultiplier: number
  shiftOscillatorVisible: boolean
  source: MaSource
  statusLineValuesVisible: boolean
  type: MaType
  upColor: string
  upMarkerMode: MaMarkerMode
  upVisible: boolean
}

export type RsiIndicatorSettings = {
  backgroundFillColor: string
  backgroundFillOpacity: number
  backgroundFillVisible: boolean
  calculateDivergence: boolean
  crosshairMarkers: boolean
  lowerBand: number
  lowerBandColor: string
  lowerBandLineStyle: RsiLineStyle
  lowerBandLineWidth: number
  lowerBandOpacity: number
  lowerBandVisible: boolean
  middleBand: number
  middleBandColor: string
  middleBandLineStyle: RsiLineStyle
  middleBandLineWidth: number
  middleBandOpacity: number
  middleBandVisible: boolean
  inputStatusLineVisible: boolean
  precision: RsiPrecision
  priceScaleLabelsVisible: boolean
  rsiColor: string
  rsiLineStyle: RsiLineStyle
  rsiLineWidth: number
  rsiOpacity: number
  rsiMaColor: string
  rsiMaLineStyle: RsiLineStyle
  rsiMaLineWidth: number
  rsiMaOpacity: number
  rsiMaVisible: boolean
  rsiVisible: boolean
  smoothingLength: number
  smoothingType: RsiSmoothingType
  source: RsiSource
  statusLineValuesVisible: boolean
  upperBand: number
  upperBandColor: string
  upperBandLineStyle: RsiLineStyle
  upperBandLineWidth: number
  upperBandOpacity: number
  upperBandVisible: boolean
  length: number
}

export type PersistedIndicatorsState = {
  loaded: {
    MA?: boolean
    MACD?: boolean
    RSI?: boolean
    Stoch?: boolean
    TSI?: boolean
    VI?: boolean
    VWAP?: boolean
    Vol?: boolean
  }
  ma: MaIndicatorSettings
  macd: MacdIndicatorSettings
  rsi: RsiIndicatorSettings
  stoch: StochIndicatorSettings
  tsi: TsiIndicatorSettings
  vi: ViIndicatorSettings
  vwap: VwapIndicatorSettings
  vol: VolIndicatorSettings
  ui: {
    activeTab: IndicatorSettingsTab
    selectedKey: string
  }
}

const persistEnabledKey = 'fractalframe:v5:indicators:persistEnabled:v1'
const persistedStateKey = 'fractalframe:v5:indicators:state:v1'
const indicatorSettingsTabs = new Set<IndicatorSettingsTab>(['input', 'style', 'visibility'])

function normalizeIndicatorSettingsTab(value: unknown): IndicatorSettingsTab {
  return indicatorSettingsTabs.has(value as IndicatorSettingsTab) ? value as IndicatorSettingsTab : 'input'
}

export const defaultRsiIndicatorSettings: RsiIndicatorSettings = {
  backgroundFillColor: '#d1d4dc',
  backgroundFillOpacity: 0.18,
  backgroundFillVisible: true,
  calculateDivergence: false,
  crosshairMarkers: true,
  lowerBand: 30,
  lowerBandColor: '#787b86',
  lowerBandLineStyle: 'dashed',
  lowerBandLineWidth: 1,
  lowerBandOpacity: 1,
  lowerBandVisible: true,
  middleBand: 50,
  middleBandColor: '#94a3b8',
  middleBandLineStyle: 'dashed',
  middleBandLineWidth: 1,
  middleBandOpacity: 1,
  middleBandVisible: true,
  inputStatusLineVisible: true,
  precision: 'system',
  priceScaleLabelsVisible: true,
  rsiColor: '#2962ff',
  rsiLineStyle: 'solid',
  rsiLineWidth: 1,
  rsiOpacity: 1,
  rsiMaColor: '#f5b800',
  rsiMaLineStyle: 'solid',
  rsiMaLineWidth: 1,
  rsiMaOpacity: 1,
  rsiMaVisible: true,
  rsiVisible: true,
  smoothingLength: 14,
  smoothingType: 'sma',
  source: 'close',
  statusLineValuesVisible: true,
  upperBand: 70,
  upperBandColor: '#787b86',
  upperBandLineStyle: 'dashed',
  upperBandLineWidth: 1,
  upperBandOpacity: 1,
  upperBandVisible: true,
  length: 14,
}

export const defaultStochIndicatorSettings: StochIndicatorSettings = {
  backgroundFillColor: '#2196f3',
  backgroundFillOpacity: 0.08,
  backgroundFillVisible: true,
  dColor: '#ff6d00',
  dLineStyle: 'solid',
  dLineWidth: 1,
  dOpacity: 1,
  dSmoothing: 3,
  dVisible: true,
  inputStatusLineVisible: true,
  kColor: '#2962ff',
  kLineStyle: 'solid',
  kLineWidth: 1,
  kOpacity: 1,
  kSmoothing: 3,
  kVisible: true,
  length: 14,
  lowerBand: 20,
  lowerBandColor: '#787b86',
  lowerBandLineStyle: 'dashed',
  lowerBandLineWidth: 1,
  lowerBandOpacity: 1,
  lowerBandVisible: true,
  middleBand: 50,
  middleBandColor: '#94a3b8',
  middleBandLineStyle: 'dashed',
  middleBandLineWidth: 1,
  middleBandOpacity: 1,
  middleBandVisible: false,
  precision: 'system',
  priceScaleLabelsVisible: true,
  statusLineValuesVisible: true,
  upperBand: 80,
  upperBandColor: '#787b86',
  upperBandLineStyle: 'dashed',
  upperBandLineWidth: 1,
  upperBandOpacity: 1,
  upperBandVisible: true,
}

export const defaultMacdIndicatorSettings: MacdIndicatorSettings = {
  source: 'close',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscillatorMaType: 'ema',
  signalMaType: 'ema',
  timeframe: 'chart',
  waitForTimeframeClose: true,
  histogramVisible: true,
  histogramColor0: '#26a69a',
  histogramColor0Opacity: 1,
  histogramColor1: '#b2dfdb',
  histogramColor1Opacity: 1,
  histogramColor2: '#ffcdd2',
  histogramColor2Opacity: 1,
  histogramColor3: '#ff5252',
  histogramColor3Opacity: 1,
  macdVisible: true,
  macdColor: '#2962ff',
  macdLineStyle: 'solid',
  macdLineWidth: 1,
  macdOpacity: 1,
  signalVisible: true,
  signalColor: '#ff6d00',
  signalLineStyle: 'solid',
  signalLineWidth: 1,
  signalOpacity: 1,
  zeroLineVisible: true,
  zeroLineColor: '#787b86',
  zeroLineStyle: 'dashed',
  zeroLineWidth: 1,
  zeroLineOpacity: 1,
  precision: 'system',
  priceScaleLabelsVisible: true,
  statusLineValuesVisible: true,
  inputStatusLineVisible: true,
}

export const defaultTsiIndicatorSettings: TsiIndicatorSettings = {
  longLength: 25,
  shortLength: 13,
  signalLength: 13,
  timeframe: 'chart',
  waitForTimeframeClose: true,
  tsiVisible: true,
  tsiColor: '#2962ff',
  tsiLineStyle: 'solid',
  tsiLineWidth: 1,
  tsiOpacity: 1,
  signalVisible: true,
  signalColor: '#e91e63',
  signalLineStyle: 'solid',
  signalLineWidth: 1,
  signalOpacity: 1,
  zeroLineVisible: true,
  zeroLineColor: '#787b86',
  zeroLineStyle: 'dashed',
  zeroLineWidth: 1,
  zeroLineOpacity: 1,
  precision: 'system',
  priceScaleLabelsVisible: true,
  statusLineValuesVisible: true,
  inputStatusLineVisible: true,
}

export const defaultViIndicatorSettings: ViIndicatorSettings = {
  length: 14,
  timeframe: 'chart',
  waitForTimeframeClose: true,
  plusVisible: true,
  plusColor: '#2962ff',
  plusLineStyle: 'solid',
  plusLineWidth: 1,
  plusOpacity: 1,
  minusVisible: true,
  minusColor: '#e91e63',
  minusLineStyle: 'solid',
  minusLineWidth: 1,
  minusOpacity: 1,
  precision: 'system',
  priceScaleLabelsVisible: true,
  statusLineValuesVisible: true,
  inputStatusLineVisible: true,
}

export const defaultMaIndicatorSettings: MaIndicatorSettings = {
  colors: ['#22c7b8', '#159e9a', '#f6c33b', '#ff8a12'],
  dnColor: '#787b86',
  dnMarkerMode: 'bar_up',
  dnVisible: true,
  inputStatusLineVisible: true,
  length: 40,
  maFadedColor: '#131722',
  maFadedLineStyle: 'solid',
  maFadedLineWidth: 2,
  maFadedOpacity: 0.1,
  maFadedVisible: true,
  maLineColor: '#131722',
  maLineStyle: 'solid',
  maLineWidth: 1,
  maLineOpacity: 1,
  maLineVisible: true,
  precision: 'system',
  priceScaleLabelsVisible: true,
  shiftLength: 15,
  shiftMultiplier: 0.5,
  shiftOscillatorVisible: true,
  source: 'hl2',
  statusLineValuesVisible: true,
  type: 'sma',
  upColor: '#787b86',
  upMarkerMode: 'bar_down',
  upVisible: true,
}

export const defaultVolIndicatorSettings: VolIndicatorSettings = {
  colorBasedOnPreviousClose: false,
  inputsInStatusLine: true,
  labelsOnPriceScale: true,
  maChecked: false,
  maColor: '#91a7ff',
  maLineStyle: 'solid',
  maLineWidth: 2,
  maOpacity: 1,
  maLength: 20,
  precision: 'system',
  valuesInStatusLine: true,
  volumeChecked: true,
  volumeDownColor: '#ef5350',
  volumeDownOpacity: 0.55,
  volumeUpColor: '#26a69a',
  volumeUpOpacity: 0.55,
}

export const defaultVwapIndicatorSettings: VwapIndicatorSettings = {
  anchorPeriod: 'session',
  bandCalculationMode: 'standard_deviation',
  band1Multiplier: 1,
  band1Visible: true,
  band1FillColor: '#4caf50',
  band1FillOpacity: 0.08,
  band1FillVisible: true,
  band1LowerColor: '#4caf50',
  band1LowerLineStyle: 'solid',
  band1LowerLineWidth: 1,
  band1LowerOpacity: 1,
  band1LowerVisible: true,
  band1UpperColor: '#4caf50',
  band1UpperLineStyle: 'solid',
  band1UpperLineWidth: 1,
  band1UpperOpacity: 1,
  band1UpperVisible: true,
  band2Multiplier: 2,
  band2Visible: false,
  band3Multiplier: 3,
  band3Visible: false,
  hideOnDailyOrAbove: false,
  inputsInStatusLine: true,
  offset: 0,
  precision: 'system',
  priceScaleLabelsVisible: true,
  source: 'hlc3',
  statusLineValuesVisible: true,
  timeframe: 'chart',
  vwapColor: '#2962ff',
  vwapLineStyle: 'solid',
  vwapLineWidth: 1,
  vwapOpacity: 1,
  vwapVisible: true,
  waitForTimeframeClose: true,
}

function normalizeVwapSettings(input?: Partial<VwapIndicatorSettings>): VwapIndicatorSettings {
  const merged = { ...defaultVwapIndicatorSettings, ...(input ?? {}) }
  const offset = Math.round(Number(merged.offset))
  const band1Multiplier = Number(merged.band1Multiplier)
  const band2Multiplier = Number(merged.band2Multiplier)
  const band3Multiplier = Number(merged.band3Multiplier)
  const vwapLineWidth = Math.round(Number(merged.vwapLineWidth))
  const band1UpperLineWidth = Math.round(Number(merged.band1UpperLineWidth))
  const band1LowerLineWidth = Math.round(Number(merged.band1LowerLineWidth))
  const vwapOpacity = Number(merged.vwapOpacity)
  const band1UpperOpacity = Number(merged.band1UpperOpacity)
  const band1LowerOpacity = Number(merged.band1LowerOpacity)
  const band1FillOpacity = Number(merged.band1FillOpacity)
  return {
    ...merged,
    anchorPeriod: ['session', 'week', 'month', 'quarter', 'year', 'decade', 'century'].includes(merged.anchorPeriod) ? merged.anchorPeriod : 'session',
    bandCalculationMode: merged.bandCalculationMode === 'percentage' ? 'percentage' : 'standard_deviation',
    band1FillOpacity: Number.isFinite(band1FillOpacity) ? Math.max(0, Math.min(band1FillOpacity, 1)) : defaultVwapIndicatorSettings.band1FillOpacity,
    band1FillVisible: merged.band1FillVisible !== false,
    band1LowerLineStyle: merged.band1LowerLineStyle === 'dashed' || merged.band1LowerLineStyle === 'dotted' ? merged.band1LowerLineStyle : 'solid',
    band1LowerLineWidth: Number.isFinite(band1LowerLineWidth) ? Math.max(1, Math.min(band1LowerLineWidth, 4)) : defaultVwapIndicatorSettings.band1LowerLineWidth,
    band1LowerOpacity: Number.isFinite(band1LowerOpacity) ? Math.max(0, Math.min(band1LowerOpacity, 1)) : defaultVwapIndicatorSettings.band1LowerOpacity,
    band1LowerVisible: merged.band1LowerVisible !== false,
    band1Multiplier: Number.isFinite(band1Multiplier) ? band1Multiplier : defaultVwapIndicatorSettings.band1Multiplier,
    band1UpperLineStyle: merged.band1UpperLineStyle === 'dashed' || merged.band1UpperLineStyle === 'dotted' ? merged.band1UpperLineStyle : 'solid',
    band1UpperLineWidth: Number.isFinite(band1UpperLineWidth) ? Math.max(1, Math.min(band1UpperLineWidth, 4)) : defaultVwapIndicatorSettings.band1UpperLineWidth,
    band1UpperOpacity: Number.isFinite(band1UpperOpacity) ? Math.max(0, Math.min(band1UpperOpacity, 1)) : defaultVwapIndicatorSettings.band1UpperOpacity,
    band1UpperVisible: merged.band1UpperVisible !== false,
    band1Visible: merged.band1Visible !== false,
    band2Multiplier: Number.isFinite(band2Multiplier) ? band2Multiplier : defaultVwapIndicatorSettings.band2Multiplier,
    band2Visible: merged.band2Visible === true,
    band3Multiplier: Number.isFinite(band3Multiplier) ? band3Multiplier : defaultVwapIndicatorSettings.band3Multiplier,
    band3Visible: merged.band3Visible === true,
    hideOnDailyOrAbove: merged.hideOnDailyOrAbove === true,
    inputsInStatusLine: merged.inputsInStatusLine !== false,
    offset: Number.isFinite(offset) ? Math.max(-500, Math.min(offset, 500)) : defaultVwapIndicatorSettings.offset,
    precision: ['0', '1', '2', '3', '4', 'system'].includes(merged.precision) ? merged.precision : 'system',
    priceScaleLabelsVisible: merged.priceScaleLabelsVisible !== false,
    source: ['hlc3', 'close', 'open', 'high', 'low', 'hl2', 'ohlc4'].includes(merged.source) ? merged.source : 'hlc3',
    statusLineValuesVisible: merged.statusLineValuesVisible !== false,
    timeframe: ['chart', '1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(merged.timeframe) ? merged.timeframe : 'chart',
    vwapLineStyle: merged.vwapLineStyle === 'dashed' || merged.vwapLineStyle === 'dotted' ? merged.vwapLineStyle : 'solid',
    vwapLineWidth: Number.isFinite(vwapLineWidth) ? Math.max(1, Math.min(vwapLineWidth, 4)) : defaultVwapIndicatorSettings.vwapLineWidth,
    vwapOpacity: Number.isFinite(vwapOpacity) ? Math.max(0, Math.min(vwapOpacity, 1)) : defaultVwapIndicatorSettings.vwapOpacity,
    vwapVisible: merged.vwapVisible !== false,
    waitForTimeframeClose: merged.waitForTimeframeClose !== false,
  }
}

function normalizeStochSettings(input?: Partial<StochIndicatorSettings>): StochIndicatorSettings {
  const merged = { ...defaultStochIndicatorSettings, ...(input ?? {}) }
  const length = Math.round(Number(merged.length))
  const kSmoothing = Math.round(Number(merged.kSmoothing))
  const dSmoothing = Math.round(Number(merged.dSmoothing))
  const kLineWidth = Math.round(Number(merged.kLineWidth))
  const dLineWidth = Math.round(Number(merged.dLineWidth))
  const upperBandLineWidth = Math.round(Number(merged.upperBandLineWidth))
  const middleBandLineWidth = Math.round(Number(merged.middleBandLineWidth))
  const lowerBandLineWidth = Math.round(Number(merged.lowerBandLineWidth))
  const kOpacity = Number(merged.kOpacity)
  const dOpacity = Number(merged.dOpacity)
  const upperBandOpacity = Number(merged.upperBandOpacity)
  const middleBandOpacity = Number(merged.middleBandOpacity)
  const lowerBandOpacity = Number(merged.lowerBandOpacity)
  const backgroundFillOpacity = Number(merged.backgroundFillOpacity)
  return {
    ...merged,
    backgroundFillOpacity: Number.isFinite(backgroundFillOpacity) ? Math.max(0, Math.min(backgroundFillOpacity, 1)) : defaultStochIndicatorSettings.backgroundFillOpacity,
    backgroundFillVisible: merged.backgroundFillVisible !== false,
    dLineStyle: merged.dLineStyle === 'dashed' || merged.dLineStyle === 'dotted' ? merged.dLineStyle : 'solid',
    dLineWidth: Number.isFinite(dLineWidth) ? Math.max(1, Math.min(dLineWidth, 4)) : defaultStochIndicatorSettings.dLineWidth,
    dOpacity: Number.isFinite(dOpacity) ? Math.max(0, Math.min(dOpacity, 1)) : defaultStochIndicatorSettings.dOpacity,
    dSmoothing: Number.isFinite(dSmoothing) ? Math.max(1, Math.min(dSmoothing, 500)) : defaultStochIndicatorSettings.dSmoothing,
    dVisible: merged.dVisible !== false,
    inputStatusLineVisible: merged.inputStatusLineVisible !== false,
    kLineStyle: merged.kLineStyle === 'dashed' || merged.kLineStyle === 'dotted' ? merged.kLineStyle : 'solid',
    kLineWidth: Number.isFinite(kLineWidth) ? Math.max(1, Math.min(kLineWidth, 4)) : defaultStochIndicatorSettings.kLineWidth,
    kOpacity: Number.isFinite(kOpacity) ? Math.max(0, Math.min(kOpacity, 1)) : defaultStochIndicatorSettings.kOpacity,
    kSmoothing: Number.isFinite(kSmoothing) ? Math.max(1, Math.min(kSmoothing, 500)) : defaultStochIndicatorSettings.kSmoothing,
    kVisible: merged.kVisible !== false,
    length: Number.isFinite(length) ? Math.max(1, Math.min(length, 500)) : defaultStochIndicatorSettings.length,
    lowerBandLineStyle: merged.lowerBandLineStyle === 'dashed' || merged.lowerBandLineStyle === 'dotted' ? merged.lowerBandLineStyle : 'solid',
    lowerBandLineWidth: Number.isFinite(lowerBandLineWidth) ? Math.max(1, Math.min(lowerBandLineWidth, 4)) : defaultStochIndicatorSettings.lowerBandLineWidth,
    lowerBandOpacity: Number.isFinite(lowerBandOpacity) ? Math.max(0, Math.min(lowerBandOpacity, 1)) : defaultStochIndicatorSettings.lowerBandOpacity,
    lowerBandVisible: merged.lowerBandVisible !== false,
    middleBandLineStyle: merged.middleBandLineStyle === 'dashed' || merged.middleBandLineStyle === 'dotted' ? merged.middleBandLineStyle : 'solid',
    middleBandLineWidth: Number.isFinite(middleBandLineWidth) ? Math.max(1, Math.min(middleBandLineWidth, 4)) : defaultStochIndicatorSettings.middleBandLineWidth,
    middleBandOpacity: Number.isFinite(middleBandOpacity) ? Math.max(0, Math.min(middleBandOpacity, 1)) : defaultStochIndicatorSettings.middleBandOpacity,
    precision: ['0', '1', '2', '3', '4', 'system'].includes(merged.precision) ? merged.precision : 'system',
    priceScaleLabelsVisible: merged.priceScaleLabelsVisible !== false,
    statusLineValuesVisible: merged.statusLineValuesVisible !== false,
    upperBandLineStyle: merged.upperBandLineStyle === 'dashed' || merged.upperBandLineStyle === 'dotted' ? merged.upperBandLineStyle : 'solid',
    upperBandLineWidth: Number.isFinite(upperBandLineWidth) ? Math.max(1, Math.min(upperBandLineWidth, 4)) : defaultStochIndicatorSettings.upperBandLineWidth,
    upperBandOpacity: Number.isFinite(upperBandOpacity) ? Math.max(0, Math.min(upperBandOpacity, 1)) : defaultStochIndicatorSettings.upperBandOpacity,
    upperBandVisible: merged.upperBandVisible !== false,
  }
}

function normalizeMacdSettings(input?: Partial<MacdIndicatorSettings>): MacdIndicatorSettings {
  const merged = { ...defaultMacdIndicatorSettings, ...(input ?? {}) }
  const fastLength = Math.round(Number(merged.fastLength))
  const slowLength = Math.round(Number(merged.slowLength))
  const signalLength = Math.round(Number(merged.signalLength))
  const macdLineWidth = Math.round(Number(merged.macdLineWidth))
  const signalLineWidth = Math.round(Number(merged.signalLineWidth))
  const zeroLineWidth = Math.round(Number(merged.zeroLineWidth))
  const macdOpacity = Number(merged.macdOpacity)
  const signalOpacity = Number(merged.signalOpacity)
  const zeroLineOpacity = Number(merged.zeroLineOpacity)
  const histogramColor0Opacity = Number(merged.histogramColor0Opacity)
  const histogramColor1Opacity = Number(merged.histogramColor1Opacity)
  const histogramColor2Opacity = Number(merged.histogramColor2Opacity)
  const histogramColor3Opacity = Number(merged.histogramColor3Opacity)
  return {
    ...merged,
    fastLength: Number.isFinite(fastLength) ? Math.max(1, Math.min(fastLength, 500)) : defaultMacdIndicatorSettings.fastLength,
    histogramColor0Opacity: Number.isFinite(histogramColor0Opacity) ? Math.max(0, Math.min(histogramColor0Opacity, 1)) : defaultMacdIndicatorSettings.histogramColor0Opacity,
    histogramColor1Opacity: Number.isFinite(histogramColor1Opacity) ? Math.max(0, Math.min(histogramColor1Opacity, 1)) : defaultMacdIndicatorSettings.histogramColor1Opacity,
    histogramColor2Opacity: Number.isFinite(histogramColor2Opacity) ? Math.max(0, Math.min(histogramColor2Opacity, 1)) : defaultMacdIndicatorSettings.histogramColor2Opacity,
    histogramColor3Opacity: Number.isFinite(histogramColor3Opacity) ? Math.max(0, Math.min(histogramColor3Opacity, 1)) : defaultMacdIndicatorSettings.histogramColor3Opacity,
    histogramVisible: merged.histogramVisible !== false,
    inputStatusLineVisible: merged.inputStatusLineVisible !== false,
    macdLineStyle: merged.macdLineStyle === 'dashed' || merged.macdLineStyle === 'dotted' ? merged.macdLineStyle : 'solid',
    macdLineWidth: Number.isFinite(macdLineWidth) ? Math.max(1, Math.min(macdLineWidth, 4)) : defaultMacdIndicatorSettings.macdLineWidth,
    macdOpacity: Number.isFinite(macdOpacity) ? Math.max(0, Math.min(macdOpacity, 1)) : defaultMacdIndicatorSettings.macdOpacity,
    macdVisible: merged.macdVisible !== false,
    oscillatorMaType: merged.oscillatorMaType === 'sma' ? 'sma' : 'ema',
    precision: ['0', '1', '2', '3', '4', 'system'].includes(merged.precision) ? merged.precision : 'system',
    priceScaleLabelsVisible: merged.priceScaleLabelsVisible !== false,
    signalLength: Number.isFinite(signalLength) ? Math.max(1, Math.min(signalLength, 500)) : defaultMacdIndicatorSettings.signalLength,
    signalLineStyle: merged.signalLineStyle === 'dashed' || merged.signalLineStyle === 'dotted' ? merged.signalLineStyle : 'solid',
    signalLineWidth: Number.isFinite(signalLineWidth) ? Math.max(1, Math.min(signalLineWidth, 4)) : defaultMacdIndicatorSettings.signalLineWidth,
    signalMaType: merged.signalMaType === 'sma' ? 'sma' : 'ema',
    signalOpacity: Number.isFinite(signalOpacity) ? Math.max(0, Math.min(signalOpacity, 1)) : defaultMacdIndicatorSettings.signalOpacity,
    signalVisible: merged.signalVisible !== false,
    slowLength: Number.isFinite(slowLength) ? Math.max(1, Math.min(slowLength, 500)) : defaultMacdIndicatorSettings.slowLength,
    source: ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'].includes(merged.source) ? merged.source : 'close',
    statusLineValuesVisible: merged.statusLineValuesVisible !== false,
    timeframe: ['chart', '1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(merged.timeframe) ? merged.timeframe : 'chart',
    waitForTimeframeClose: merged.waitForTimeframeClose !== false,
    zeroLineOpacity: Number.isFinite(zeroLineOpacity) ? Math.max(0, Math.min(zeroLineOpacity, 1)) : defaultMacdIndicatorSettings.zeroLineOpacity,
    zeroLineStyle: merged.zeroLineStyle === 'solid' || merged.zeroLineStyle === 'dotted' ? merged.zeroLineStyle : 'dashed',
    zeroLineVisible: merged.zeroLineVisible !== false,
    zeroLineWidth: Number.isFinite(zeroLineWidth) ? Math.max(1, Math.min(zeroLineWidth, 4)) : defaultMacdIndicatorSettings.zeroLineWidth,
  }
}

function normalizeTsiSettings(input?: Partial<TsiIndicatorSettings>): TsiIndicatorSettings {
  const merged = { ...defaultTsiIndicatorSettings, ...(input ?? {}) }
  const longLength = Math.round(Number(merged.longLength))
  const shortLength = Math.round(Number(merged.shortLength))
  const signalLength = Math.round(Number(merged.signalLength))
  const tsiLineWidth = Math.round(Number(merged.tsiLineWidth))
  const signalLineWidth = Math.round(Number(merged.signalLineWidth))
  const zeroLineWidth = Math.round(Number(merged.zeroLineWidth))
  const tsiOpacity = Number(merged.tsiOpacity)
  const signalOpacity = Number(merged.signalOpacity)
  const zeroLineOpacity = Number(merged.zeroLineOpacity)
  return {
    ...merged,
    inputStatusLineVisible: merged.inputStatusLineVisible !== false,
    longLength: Number.isFinite(longLength) ? Math.max(1, Math.min(longLength, 500)) : defaultTsiIndicatorSettings.longLength,
    precision: ['0', '1', '2', '3', '4', 'system'].includes(merged.precision) ? merged.precision : 'system',
    priceScaleLabelsVisible: merged.priceScaleLabelsVisible !== false,
    shortLength: Number.isFinite(shortLength) ? Math.max(1, Math.min(shortLength, 500)) : defaultTsiIndicatorSettings.shortLength,
    signalLength: Number.isFinite(signalLength) ? Math.max(1, Math.min(signalLength, 500)) : defaultTsiIndicatorSettings.signalLength,
    signalLineStyle: merged.signalLineStyle === 'dashed' || merged.signalLineStyle === 'dotted' ? merged.signalLineStyle : 'solid',
    signalLineWidth: Number.isFinite(signalLineWidth) ? Math.max(1, Math.min(signalLineWidth, 4)) : defaultTsiIndicatorSettings.signalLineWidth,
    signalOpacity: Number.isFinite(signalOpacity) ? Math.max(0, Math.min(signalOpacity, 1)) : defaultTsiIndicatorSettings.signalOpacity,
    signalVisible: merged.signalVisible !== false,
    statusLineValuesVisible: merged.statusLineValuesVisible !== false,
    timeframe: ['chart', '1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(merged.timeframe) ? merged.timeframe : 'chart',
    tsiLineStyle: merged.tsiLineStyle === 'dashed' || merged.tsiLineStyle === 'dotted' ? merged.tsiLineStyle : 'solid',
    tsiLineWidth: Number.isFinite(tsiLineWidth) ? Math.max(1, Math.min(tsiLineWidth, 4)) : defaultTsiIndicatorSettings.tsiLineWidth,
    tsiOpacity: Number.isFinite(tsiOpacity) ? Math.max(0, Math.min(tsiOpacity, 1)) : defaultTsiIndicatorSettings.tsiOpacity,
    tsiVisible: merged.tsiVisible !== false,
    waitForTimeframeClose: merged.waitForTimeframeClose !== false,
    zeroLineOpacity: Number.isFinite(zeroLineOpacity) ? Math.max(0, Math.min(zeroLineOpacity, 1)) : defaultTsiIndicatorSettings.zeroLineOpacity,
    zeroLineStyle: merged.zeroLineStyle === 'solid' || merged.zeroLineStyle === 'dotted' ? merged.zeroLineStyle : 'dashed',
    zeroLineVisible: merged.zeroLineVisible !== false,
    zeroLineWidth: Number.isFinite(zeroLineWidth) ? Math.max(1, Math.min(zeroLineWidth, 4)) : defaultTsiIndicatorSettings.zeroLineWidth,
  }
}

function normalizeViSettings(input?: Partial<ViIndicatorSettings>): ViIndicatorSettings {
  const merged = { ...defaultViIndicatorSettings, ...(input ?? {}) }
  const length = Math.round(Number(merged.length))
  const plusLineWidth = Math.round(Number(merged.plusLineWidth))
  const minusLineWidth = Math.round(Number(merged.minusLineWidth))
  const plusOpacity = Number(merged.plusOpacity)
  const minusOpacity = Number(merged.minusOpacity)
  return {
    ...merged,
    inputStatusLineVisible: merged.inputStatusLineVisible !== false,
    length: Number.isFinite(length) ? Math.max(1, Math.min(length, 500)) : defaultViIndicatorSettings.length,
    minusLineStyle: merged.minusLineStyle === 'dashed' || merged.minusLineStyle === 'dotted' ? merged.minusLineStyle : 'solid',
    minusLineWidth: Number.isFinite(minusLineWidth) ? Math.max(1, Math.min(minusLineWidth, 4)) : defaultViIndicatorSettings.minusLineWidth,
    minusOpacity: Number.isFinite(minusOpacity) ? Math.max(0, Math.min(minusOpacity, 1)) : defaultViIndicatorSettings.minusOpacity,
    minusVisible: merged.minusVisible !== false,
    plusLineStyle: merged.plusLineStyle === 'dashed' || merged.plusLineStyle === 'dotted' ? merged.plusLineStyle : 'solid',
    plusLineWidth: Number.isFinite(plusLineWidth) ? Math.max(1, Math.min(plusLineWidth, 4)) : defaultViIndicatorSettings.plusLineWidth,
    plusOpacity: Number.isFinite(plusOpacity) ? Math.max(0, Math.min(plusOpacity, 1)) : defaultViIndicatorSettings.plusOpacity,
    plusVisible: merged.plusVisible !== false,
    precision: ['0', '1', '2', '3', '4', 'system'].includes(merged.precision) ? merged.precision : 'system',
    priceScaleLabelsVisible: merged.priceScaleLabelsVisible !== false,
    statusLineValuesVisible: merged.statusLineValuesVisible !== false,
    timeframe: ['chart', '1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(merged.timeframe) ? merged.timeframe : 'chart',
    waitForTimeframeClose: merged.waitForTimeframeClose !== false,
  }
}

function normalizeVolSettings(input?: Partial<VolIndicatorSettings>): VolIndicatorSettings {
  const merged = { ...defaultVolIndicatorSettings, ...(input ?? {}) }
  const maLength = Math.round(Number(merged.maLength))
  const maLineWidth = Math.round(Number(merged.maLineWidth))
  const volumeUpOpacity = Number(merged.volumeUpOpacity)
  const volumeDownOpacity = Number(merged.volumeDownOpacity)
  const maOpacity = Number(merged.maOpacity)
  return {
    ...merged,
    colorBasedOnPreviousClose: merged.colorBasedOnPreviousClose === true,
    inputsInStatusLine: merged.inputsInStatusLine !== false,
    labelsOnPriceScale: merged.labelsOnPriceScale !== false,
    maChecked: merged.maChecked === true,
    maLineStyle: merged.maLineStyle === 'dashed' || merged.maLineStyle === 'dotted' ? merged.maLineStyle : 'solid',
    maLineWidth: Number.isFinite(maLineWidth) ? Math.max(1, Math.min(maLineWidth, 4)) : defaultVolIndicatorSettings.maLineWidth,
    maLength: Number.isFinite(maLength) ? Math.max(1, Math.min(maLength, 500)) : defaultVolIndicatorSettings.maLength,
    maOpacity: Number.isFinite(maOpacity) ? Math.max(0, Math.min(maOpacity, 1)) : defaultVolIndicatorSettings.maOpacity,
    precision: ['0', '1', '2', '3', '4', 'system'].includes(merged.precision) ? merged.precision : 'system',
    valuesInStatusLine: merged.valuesInStatusLine !== false,
    volumeChecked: merged.volumeChecked !== false,
    volumeDownOpacity: Number.isFinite(volumeDownOpacity) ? Math.max(0, Math.min(volumeDownOpacity, 1)) : defaultVolIndicatorSettings.volumeDownOpacity,
    volumeUpOpacity: Number.isFinite(volumeUpOpacity) ? Math.max(0, Math.min(volumeUpOpacity, 1)) : defaultVolIndicatorSettings.volumeUpOpacity,
  }
}

export function readIndicatorPersistenceEnabled() {
  return readBooleanFlag(persistEnabledKey, true)
}

export function writeIndicatorPersistenceEnabled(enabled: boolean) {
  writeBooleanFlag(persistEnabledKey, enabled)
}

export function readPersistedIndicatorsState(): PersistedIndicatorsState {
  const parsed = readJson<Partial<PersistedIndicatorsState> | null>(persistedStateKey, null)
  return {
    loaded: {
      MA: parsed?.loaded?.MA === true,
      MACD: parsed?.loaded?.MACD === true,
      RSI: parsed?.loaded?.RSI === true,
      Stoch: parsed?.loaded?.Stoch === true,
      TSI: parsed?.loaded?.TSI === true,
      VI: parsed?.loaded?.VI === true,
      VWAP: parsed?.loaded?.VWAP === true,
      Vol: parsed?.loaded?.Vol === true,
    },
    ma: {
      ...defaultMaIndicatorSettings,
      ...(parsed?.ma ?? {}),
      colors: Array.isArray(parsed?.ma?.colors) && parsed.ma.colors.length > 0
        ? parsed.ma.colors
        : defaultMaIndicatorSettings.colors,
    },
    macd: normalizeMacdSettings(parsed?.macd),
    rsi: {
      ...defaultRsiIndicatorSettings,
      ...(parsed?.rsi ?? {}),
    },
    stoch: normalizeStochSettings(parsed?.stoch),
    tsi: normalizeTsiSettings(parsed?.tsi),
    vi: normalizeViSettings(parsed?.vi),
    vwap: normalizeVwapSettings(parsed?.vwap),
    vol: normalizeVolSettings(parsed?.vol),
    ui: {
      activeTab: normalizeIndicatorSettingsTab(parsed?.ui?.activeTab),
      selectedKey: typeof parsed?.ui?.selectedKey === 'string' && parsed.ui.selectedKey ? parsed.ui.selectedKey : 'RSI',
    },
  }
}

export function writePersistedIndicatorsState(state: PersistedIndicatorsState) {
  writeJson(persistedStateKey, state)
}

export function clearPersistedIndicatorsState() {
  removeStorageItem(persistedStateKey)
}
