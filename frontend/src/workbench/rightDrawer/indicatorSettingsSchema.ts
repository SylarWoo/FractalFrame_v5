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

export type DpoIndicatorSettings = {
  backgroundColor: string
  backgroundOpacity: number
  backgroundVisible: boolean
  centered: boolean
  dpoColor: string
  dpoLineStyle: RsiLineStyle
  dpoLineWidth: number
  dpoOpacity: number
  dpoVisible: boolean
  downLineColor: string
  downLine2Color: string
  downLine2Style: RsiLineStyle
  downLine2Width: number
  downLine2Opacity: number
  downLine2Value: number
  downLine2Visible: boolean
  downLineStyle: RsiLineStyle
  downLineWidth: number
  downLineOpacity: number
  downLineValue: number
  downLineVisible: boolean
  inputsInStatusLine: boolean
  labelsOnPriceScale: boolean
  length: number
  precision: RsiPrecision
  timeframe: VwapTimeframe
  upLineColor: string
  upLine2Color: string
  upLine2Style: RsiLineStyle
  upLine2Width: number
  upLine2Opacity: number
  upLine2Value: number
  upLine2Visible: boolean
  upLineStyle: RsiLineStyle
  upLineWidth: number
  upLineOpacity: number
  upLineValue: number
  upLineVisible: boolean
  valuesInStatusLine: boolean
  waitForTimeframeClose: boolean
  zeroLineColor: string
  zeroLineStyle: RsiLineStyle
  zeroLineWidth: number
  zeroLineOpacity: number
  zeroLineValue: number
  zeroLineVisible: boolean
}

export type VdoIndicatorSettings = DpoIndicatorSettings & {
  emaSmoothing: number
}

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
  backgroundFillLowerColor: string
  backgroundFillLowerOpacity: number
  backgroundFillLowerVisible: boolean
  backgroundFillOpacity: number
  backgroundFillUpperColor: string
  backgroundFillUpperOpacity: number
  backgroundFillUpperVisible: boolean
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
  lowerBand2: number
  lowerBand2Color: string
  lowerBand2LineStyle: RsiLineStyle
  lowerBand2LineWidth: number
  lowerBand2Opacity: number
  lowerBand2Visible: boolean
  lowerBand3: number
  lowerBand3Color: string
  lowerBand3LineStyle: RsiLineStyle
  lowerBand3LineWidth: number
  lowerBand3Opacity: number
  lowerBand3Visible: boolean
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
  upperBand2: number
  upperBand2Color: string
  upperBand2LineStyle: RsiLineStyle
  upperBand2LineWidth: number
  upperBand2Opacity: number
  upperBand2Visible: boolean
  upperBand3: number
  upperBand3Color: string
  upperBand3LineStyle: RsiLineStyle
  upperBand3LineWidth: number
  upperBand3Opacity: number
  upperBand3Visible: boolean
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

export type MrIndicatorSettings = {
  backgroundColor: string
  backgroundOpacity: number
  backgroundVisible: boolean
  inputsInStatusLine: boolean
  labelsOnPriceScale: boolean
  lowerLineColor: string
  lowerLineOpacity: number
  lowerLineStyle: RsiLineStyle
  lowerLineVisible: boolean
  lowerLineWidth: number
  precision: RsiPrecision
  upperLineColor: string
  upperLineOpacity: number
  upperLineStyle: RsiLineStyle
  upperLineVisible: boolean
  upperLineWidth: number
  valuesInStatusLine: boolean
}

export type MmfMorganRatio = number

export type MmfIndicatorSettings = {
  dpoValue: number
  highColor: string
  highMorganRatio: MmfMorganRatio
  highOffsetPercent: number
  highSize: number
  highSymbol: string
  lowColor: string
  lowDpoValue: number
  lowMorganRatio: MmfMorganRatio
  lowOffsetPercent: number
  lowSize: number
  lowSymbol: string
  pullbackColor: string
  pullbackSize: number
  pullbackSymbol: string
  pullbackVdoThreshold: number
  reboundColor: string
  reboundSize: number
  reboundSymbol: string
  reboundVdoThreshold: number
  resistanceColor: string
  resistanceSize: number
  resistanceSymbol: string
  resistanceVdoLower: number
  resistanceVdoUpper: number
  downBreakVdoLower: number
  downBreakVdoUpper: number
  downBreakColor: string
  downBreakSize: number
  downBreakSymbol: string
  showResistanceLevel: boolean
  showHigh: boolean
  showLow: boolean
  showPullbackPoint: boolean
  showReboundPoint: boolean
  showDownBreakPoint: boolean
  showSupportLevel: boolean
  showTrendDownPoint: boolean
  showTrendUpPoint: boolean
  showUpBreakPoint: boolean
  supportColor: string
  supportSize: number
  supportSymbol: string
  supportVdoLower: number
  supportVdoUpper: number
  trendDownColor: string
  trendDownSize: number
  trendDownSymbol: string
  trendDownVdoLower: number
  trendDownVdoUpper: number
  trendUpColor: string
  trendUpSize: number
  trendUpSymbol: string
  trendUpVdoLower: number
  trendUpVdoUpper: number
  upBreakColor: string
  upBreakSize: number
  upBreakSymbol: string
  upBreakVdoLower: number
  upBreakVdoUpper: number
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
    DPO?: boolean
    MA?: boolean
    MACD?: boolean
    MMF?: boolean
    MR?: boolean
    RSI?: boolean
    Stoch?: boolean
    TSI?: boolean
    VDO?: boolean
    VI?: boolean
    VWAP?: boolean
    Vol?: boolean
  }
  dpo: DpoIndicatorSettings
  ma: MaIndicatorSettings
  macd: MacdIndicatorSettings
  mmf: MmfIndicatorSettings
  mr: MrIndicatorSettings
  rsi: RsiIndicatorSettings
  stoch: StochIndicatorSettings
  tsi: TsiIndicatorSettings
  vdo: VdoIndicatorSettings
  vi: ViIndicatorSettings
  vwap: VwapIndicatorSettings
  vol: VolIndicatorSettings
  ui: {
    activeTab: IndicatorSettingsTab
    selectedKey: string
  }
}

const indicatorSettingsTabs = new Set<IndicatorSettingsTab>(['input', 'style', 'visibility'])

export function normalizeIndicatorSettingsTab(value: unknown): IndicatorSettingsTab {
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
  backgroundFillLowerColor: '#2196f3',
  backgroundFillLowerOpacity: 0.08,
  backgroundFillLowerVisible: true,
  backgroundFillOpacity: 0.08,
  backgroundFillUpperColor: '#2196f3',
  backgroundFillUpperOpacity: 0.08,
  backgroundFillUpperVisible: true,
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
  lowerBand2: 10,
  lowerBand2Color: '#787b86',
  lowerBand2LineStyle: 'dashed',
  lowerBand2LineWidth: 1,
  lowerBand2Opacity: 1,
  lowerBand2Visible: true,
  lowerBand3: 40,
  lowerBand3Color: '#787b86',
  lowerBand3LineStyle: 'dashed',
  lowerBand3LineWidth: 1,
  lowerBand3Opacity: 1,
  lowerBand3Visible: true,
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
  upperBand2: 90,
  upperBand2Color: '#787b86',
  upperBand2LineStyle: 'dashed',
  upperBand2LineWidth: 1,
  upperBand2Opacity: 1,
  upperBand2Visible: true,
  upperBand3: 60,
  upperBand3Color: '#787b86',
  upperBand3LineStyle: 'dashed',
  upperBand3LineWidth: 1,
  upperBand3Opacity: 1,
  upperBand3Visible: true,
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

export const defaultMrIndicatorSettings: MrIndicatorSettings = {
  backgroundColor: '#787b86',
  backgroundOpacity: 0.12,
  backgroundVisible: true,
  inputsInStatusLine: true,
  labelsOnPriceScale: true,
  lowerLineColor: '#787b86',
  lowerLineOpacity: 1,
  lowerLineStyle: 'solid',
  lowerLineVisible: true,
  lowerLineWidth: 1,
  precision: 'system',
  upperLineColor: '#787b86',
  upperLineOpacity: 1,
  upperLineStyle: 'solid',
  upperLineVisible: true,
  upperLineWidth: 1,
  valuesInStatusLine: true,
}

export const defaultMmfIndicatorSettings: MmfIndicatorSettings = {
  dpoValue: 11,
  highColor: '#ef5350',
  highMorganRatio: 0.118,
  highOffsetPercent: 0,
  highSize: 24,
  highSymbol: '\u25c6',
  lowColor: '#26a69a',
  lowDpoValue: -11,
  lowMorganRatio: -0.118,
  lowOffsetPercent: 0,
  lowSize: 24,
  lowSymbol: '\u25c6',
  pullbackColor: '#ef5350',
  pullbackSize: 24,
  pullbackSymbol: '\u25c6',
  pullbackVdoThreshold: -0.1,
  reboundColor: '#26a69a',
  reboundSize: 24,
  reboundSymbol: '\u25c6',
  reboundVdoThreshold: 0.1,
  resistanceColor: '#ef5350',
  resistanceSize: 24,
  resistanceSymbol: '\u25c6',
  resistanceVdoLower: 0.05,
  resistanceVdoUpper: 0.1,
  downBreakVdoLower: -0.05,
  downBreakVdoUpper: 0.05,
  downBreakColor: '#ef5350',
  downBreakSize: 24,
  downBreakSymbol: '\u25c6',
  showResistanceLevel: false,
  showHigh: true,
  showLow: false,
  showPullbackPoint: false,
  showReboundPoint: false,
  showDownBreakPoint: false,
  showSupportLevel: false,
  showTrendDownPoint: false,
  showTrendUpPoint: false,
  showUpBreakPoint: false,
  supportColor: '#26a69a',
  supportSize: 24,
  supportSymbol: '\u25c6',
  supportVdoLower: -0.1,
  supportVdoUpper: -0.05,
  trendDownColor: '#ef5350',
  trendDownSize: 24,
  trendDownSymbol: '\u25c6',
  trendDownVdoLower: -0.05,
  trendDownVdoUpper: -0.1,
  trendUpColor: '#26a69a',
  trendUpSize: 24,
  trendUpSymbol: '\u25c6',
  trendUpVdoLower: -0.05,
  trendUpVdoUpper: 0.1,
  upBreakColor: '#26a69a',
  upBreakSize: 24,
  upBreakSymbol: '\u25c6',
  upBreakVdoLower: -0.05,
  upBreakVdoUpper: 0.05,
}

export const defaultDpoIndicatorSettings: DpoIndicatorSettings = {
  backgroundColor: '#26a69a',
  backgroundOpacity: 0.08,
  backgroundVisible: false,
  centered: false,
  dpoColor: '#43a047',
  dpoLineStyle: 'solid',
  dpoLineWidth: 1,
  dpoOpacity: 1,
  dpoVisible: true,
  downLineColor: '#ef5350',
  downLine2Color: '#787b86',
  downLine2Style: 'dashed',
  downLine2Width: 1,
  downLine2Opacity: 1,
  downLine2Value: -11,
  downLine2Visible: true,
  downLineStyle: 'dashed',
  downLineWidth: 1,
  downLineOpacity: 1,
  downLineValue: 0,
  downLineVisible: false,
  inputsInStatusLine: true,
  labelsOnPriceScale: true,
  length: 21,
  precision: 'system',
  timeframe: 'chart',
  upLineColor: '#26a69a',
  upLine2Color: '#787b86',
  upLine2Style: 'dashed',
  upLine2Width: 1,
  upLine2Opacity: 1,
  upLine2Value: 11,
  upLine2Visible: true,
  upLineStyle: 'dashed',
  upLineWidth: 1,
  upLineOpacity: 1,
  upLineValue: 0,
  upLineVisible: false,
  valuesInStatusLine: true,
  waitForTimeframeClose: true,
  zeroLineColor: '#787b86',
  zeroLineStyle: 'dashed',
  zeroLineWidth: 1,
  zeroLineOpacity: 1,
  zeroLineValue: 0,
  zeroLineVisible: true,
}

export const defaultVdoIndicatorSettings: VdoIndicatorSettings = {
  ...defaultDpoIndicatorSettings,
  backgroundVisible: true,
  downLine2Value: -0.05,
  downLine2Visible: true,
  downLineValue: -0.236,
  downLineVisible: true,
  dpoColor: '#2962ff',
  emaSmoothing: 0,
  length: 120,
  upLine2Value: 0.05,
  upLine2Visible: true,
  upLineValue: 0.236,
  upLineVisible: true,
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

export function normalizeVwapSettings(input?: Partial<VwapIndicatorSettings>): VwapIndicatorSettings {
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

export function normalizeStochSettings(input?: Partial<StochIndicatorSettings>): StochIndicatorSettings {
  const merged = { ...defaultStochIndicatorSettings, ...(input ?? {}) }
  const length = Math.round(Number(merged.length))
  const kSmoothing = Math.round(Number(merged.kSmoothing))
  const dSmoothing = Math.round(Number(merged.dSmoothing))
  const kLineWidth = Math.round(Number(merged.kLineWidth))
  const dLineWidth = Math.round(Number(merged.dLineWidth))
  const upperBandLineWidth = Math.round(Number(merged.upperBandLineWidth))
  const upperBand2LineWidth = Math.round(Number(merged.upperBand2LineWidth))
  const upperBand3LineWidth = Math.round(Number(merged.upperBand3LineWidth))
  const middleBandLineWidth = Math.round(Number(merged.middleBandLineWidth))
  const lowerBandLineWidth = Math.round(Number(merged.lowerBandLineWidth))
  const lowerBand2LineWidth = Math.round(Number(merged.lowerBand2LineWidth))
  const lowerBand3LineWidth = Math.round(Number(merged.lowerBand3LineWidth))
  const kOpacity = Number(merged.kOpacity)
  const dOpacity = Number(merged.dOpacity)
  const upperBandOpacity = Number(merged.upperBandOpacity)
  const upperBand2Opacity = Number(merged.upperBand2Opacity)
  const upperBand3Opacity = Number(merged.upperBand3Opacity)
  const middleBandOpacity = Number(merged.middleBandOpacity)
  const lowerBandOpacity = Number(merged.lowerBandOpacity)
  const lowerBand2Opacity = Number(merged.lowerBand2Opacity)
  const lowerBand3Opacity = Number(merged.lowerBand3Opacity)
  const backgroundFillOpacity = Number(merged.backgroundFillOpacity)
  const backgroundFillUpperOpacity = Number(merged.backgroundFillUpperOpacity)
  const backgroundFillLowerOpacity = Number(merged.backgroundFillLowerOpacity)
  return {
    ...merged,
    backgroundFillLowerOpacity: Number.isFinite(backgroundFillLowerOpacity) ? Math.max(0, Math.min(backgroundFillLowerOpacity, 1)) : defaultStochIndicatorSettings.backgroundFillLowerOpacity,
    backgroundFillLowerVisible: merged.backgroundFillLowerVisible !== false,
    backgroundFillOpacity: Number.isFinite(backgroundFillOpacity) ? Math.max(0, Math.min(backgroundFillOpacity, 1)) : defaultStochIndicatorSettings.backgroundFillOpacity,
    backgroundFillUpperOpacity: Number.isFinite(backgroundFillUpperOpacity) ? Math.max(0, Math.min(backgroundFillUpperOpacity, 1)) : defaultStochIndicatorSettings.backgroundFillUpperOpacity,
    backgroundFillUpperVisible: merged.backgroundFillUpperVisible !== false,
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
    lowerBand2LineStyle: merged.lowerBand2LineStyle === 'dashed' || merged.lowerBand2LineStyle === 'dotted' ? merged.lowerBand2LineStyle : 'solid',
    lowerBand2LineWidth: Number.isFinite(lowerBand2LineWidth) ? Math.max(1, Math.min(lowerBand2LineWidth, 4)) : defaultStochIndicatorSettings.lowerBand2LineWidth,
    lowerBand2Opacity: Number.isFinite(lowerBand2Opacity) ? Math.max(0, Math.min(lowerBand2Opacity, 1)) : defaultStochIndicatorSettings.lowerBand2Opacity,
    lowerBand2Visible: merged.lowerBand2Visible !== false,
    lowerBand3LineStyle: merged.lowerBand3LineStyle === 'dashed' || merged.lowerBand3LineStyle === 'dotted' ? merged.lowerBand3LineStyle : 'solid',
    lowerBand3LineWidth: Number.isFinite(lowerBand3LineWidth) ? Math.max(1, Math.min(lowerBand3LineWidth, 4)) : defaultStochIndicatorSettings.lowerBand3LineWidth,
    lowerBand3Opacity: Number.isFinite(lowerBand3Opacity) ? Math.max(0, Math.min(lowerBand3Opacity, 1)) : defaultStochIndicatorSettings.lowerBand3Opacity,
    lowerBand3Visible: merged.lowerBand3Visible !== false,
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
    upperBand2LineStyle: merged.upperBand2LineStyle === 'dashed' || merged.upperBand2LineStyle === 'dotted' ? merged.upperBand2LineStyle : 'solid',
    upperBand2LineWidth: Number.isFinite(upperBand2LineWidth) ? Math.max(1, Math.min(upperBand2LineWidth, 4)) : defaultStochIndicatorSettings.upperBand2LineWidth,
    upperBand2Opacity: Number.isFinite(upperBand2Opacity) ? Math.max(0, Math.min(upperBand2Opacity, 1)) : defaultStochIndicatorSettings.upperBand2Opacity,
    upperBand2Visible: merged.upperBand2Visible !== false,
    upperBand3LineStyle: merged.upperBand3LineStyle === 'dashed' || merged.upperBand3LineStyle === 'dotted' ? merged.upperBand3LineStyle : 'solid',
    upperBand3LineWidth: Number.isFinite(upperBand3LineWidth) ? Math.max(1, Math.min(upperBand3LineWidth, 4)) : defaultStochIndicatorSettings.upperBand3LineWidth,
    upperBand3Opacity: Number.isFinite(upperBand3Opacity) ? Math.max(0, Math.min(upperBand3Opacity, 1)) : defaultStochIndicatorSettings.upperBand3Opacity,
    upperBand3Visible: merged.upperBand3Visible !== false,
    upperBandLineStyle: merged.upperBandLineStyle === 'dashed' || merged.upperBandLineStyle === 'dotted' ? merged.upperBandLineStyle : 'solid',
    upperBandLineWidth: Number.isFinite(upperBandLineWidth) ? Math.max(1, Math.min(upperBandLineWidth, 4)) : defaultStochIndicatorSettings.upperBandLineWidth,
    upperBandOpacity: Number.isFinite(upperBandOpacity) ? Math.max(0, Math.min(upperBandOpacity, 1)) : defaultStochIndicatorSettings.upperBandOpacity,
    upperBandVisible: merged.upperBandVisible !== false,
  }
}

export function normalizeMacdSettings(input?: Partial<MacdIndicatorSettings>): MacdIndicatorSettings {
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

export function normalizeTsiSettings(input?: Partial<TsiIndicatorSettings>): TsiIndicatorSettings {
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

export function normalizeViSettings(input?: Partial<ViIndicatorSettings>): ViIndicatorSettings {
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

export function normalizeVolSettings(input?: Partial<VolIndicatorSettings>): VolIndicatorSettings {
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

export function normalizeMrSettings(input?: Partial<MrIndicatorSettings>): MrIndicatorSettings {
  const merged = { ...defaultMrIndicatorSettings, ...(input ?? {}) }
  const upperLineWidth = Math.round(Number(merged.upperLineWidth))
  const lowerLineWidth = Math.round(Number(merged.lowerLineWidth))
  const upperLineOpacity = Number(merged.upperLineOpacity)
  const lowerLineOpacity = Number(merged.lowerLineOpacity)
  const backgroundOpacity = Number(merged.backgroundOpacity)
  return {
    ...merged,
    backgroundOpacity: Number.isFinite(backgroundOpacity) ? Math.max(0, Math.min(backgroundOpacity, 1)) : defaultMrIndicatorSettings.backgroundOpacity,
    backgroundVisible: merged.backgroundVisible !== false,
    inputsInStatusLine: merged.inputsInStatusLine !== false,
    labelsOnPriceScale: merged.labelsOnPriceScale !== false,
    lowerLineOpacity: Number.isFinite(lowerLineOpacity) ? Math.max(0, Math.min(lowerLineOpacity, 1)) : defaultMrIndicatorSettings.lowerLineOpacity,
    lowerLineStyle: ['solid', 'dashed', 'dotted'].includes(merged.lowerLineStyle) ? merged.lowerLineStyle : defaultMrIndicatorSettings.lowerLineStyle,
    lowerLineVisible: merged.lowerLineVisible !== false,
    lowerLineWidth: Number.isFinite(lowerLineWidth) ? Math.max(1, Math.min(lowerLineWidth, 4)) : defaultMrIndicatorSettings.lowerLineWidth,
    precision: ['0', '1', '2', '3', '4', 'system'].includes(merged.precision) ? merged.precision : 'system',
    upperLineOpacity: Number.isFinite(upperLineOpacity) ? Math.max(0, Math.min(upperLineOpacity, 1)) : defaultMrIndicatorSettings.upperLineOpacity,
    upperLineStyle: ['solid', 'dashed', 'dotted'].includes(merged.upperLineStyle) ? merged.upperLineStyle : defaultMrIndicatorSettings.upperLineStyle,
    upperLineVisible: merged.upperLineVisible !== false,
    upperLineWidth: Number.isFinite(upperLineWidth) ? Math.max(1, Math.min(upperLineWidth, 4)) : defaultMrIndicatorSettings.upperLineWidth,
    valuesInStatusLine: merged.valuesInStatusLine !== false,
  }
}

export function normalizeMmfSettings(input?: Partial<MmfIndicatorSettings>): MmfIndicatorSettings {
  const merged = { ...defaultMmfIndicatorSettings, ...(input ?? {}) }
  const highOffsetPercent = Number(merged.highOffsetPercent)
  const lowOffsetPercent = Number(merged.lowOffsetPercent)
  const highSize = Math.round(Number(merged.highSize))
  const lowSize = Math.round(Number(merged.lowSize))
  const highColor = typeof merged.highColor === 'string' && merged.highColor.trim() ? merged.highColor : defaultMmfIndicatorSettings.highColor
  const highSymbol = typeof merged.highSymbol === 'string' && merged.highSymbol.trim() ? merged.highSymbol : defaultMmfIndicatorSettings.highSymbol
  const lowColor = typeof merged.lowColor === 'string' && merged.lowColor.trim() ? merged.lowColor : defaultMmfIndicatorSettings.lowColor
  const lowSymbol = typeof merged.lowSymbol === 'string' && merged.lowSymbol.trim() ? merged.lowSymbol : defaultMmfIndicatorSettings.lowSymbol
  const pullbackColor = typeof merged.pullbackColor === 'string' && merged.pullbackColor.trim() ? merged.pullbackColor : defaultMmfIndicatorSettings.pullbackColor
  const pullbackSymbol = typeof merged.pullbackSymbol === 'string' && merged.pullbackSymbol.trim() ? merged.pullbackSymbol : defaultMmfIndicatorSettings.pullbackSymbol
  const reboundColor = typeof merged.reboundColor === 'string' && merged.reboundColor.trim() ? merged.reboundColor : defaultMmfIndicatorSettings.reboundColor
  const reboundSymbol = typeof merged.reboundSymbol === 'string' && merged.reboundSymbol.trim() ? merged.reboundSymbol : defaultMmfIndicatorSettings.reboundSymbol
  const upBreakColor = typeof merged.upBreakColor === 'string' && merged.upBreakColor.trim() ? merged.upBreakColor : defaultMmfIndicatorSettings.upBreakColor
  const upBreakSymbol = typeof merged.upBreakSymbol === 'string' && merged.upBreakSymbol.trim() ? merged.upBreakSymbol : defaultMmfIndicatorSettings.upBreakSymbol
  const downBreakColor = typeof merged.downBreakColor === 'string' && merged.downBreakColor.trim() ? merged.downBreakColor : defaultMmfIndicatorSettings.downBreakColor
  const downBreakSymbol = typeof merged.downBreakSymbol === 'string' && merged.downBreakSymbol.trim() ? merged.downBreakSymbol : defaultMmfIndicatorSettings.downBreakSymbol
  const resistanceColor = typeof merged.resistanceColor === 'string' && merged.resistanceColor.trim() ? merged.resistanceColor : defaultMmfIndicatorSettings.resistanceColor
  const resistanceSymbol = typeof merged.resistanceSymbol === 'string' && merged.resistanceSymbol.trim() ? merged.resistanceSymbol : defaultMmfIndicatorSettings.resistanceSymbol
  const supportColor = typeof merged.supportColor === 'string' && merged.supportColor.trim() ? merged.supportColor : defaultMmfIndicatorSettings.supportColor
  const supportSymbol = typeof merged.supportSymbol === 'string' && merged.supportSymbol.trim() ? merged.supportSymbol : defaultMmfIndicatorSettings.supportSymbol
  const trendDownColor = typeof merged.trendDownColor === 'string' && merged.trendDownColor.trim() ? merged.trendDownColor : defaultMmfIndicatorSettings.trendDownColor
  const trendDownSymbol = typeof merged.trendDownSymbol === 'string' && merged.trendDownSymbol.trim() ? merged.trendDownSymbol : defaultMmfIndicatorSettings.trendDownSymbol
  const trendUpColor = typeof merged.trendUpColor === 'string' && merged.trendUpColor.trim() ? merged.trendUpColor : defaultMmfIndicatorSettings.trendUpColor
  const trendUpSymbol = typeof merged.trendUpSymbol === 'string' && merged.trendUpSymbol.trim() ? merged.trendUpSymbol : defaultMmfIndicatorSettings.trendUpSymbol
  const highMorganRatio = Number(merged.highMorganRatio)
  const lowMorganRatio = Number(merged.lowMorganRatio)
  const pullbackSize = Math.round(Number(merged.pullbackSize))
  const reboundSize = Math.round(Number(merged.reboundSize))
  const upBreakSize = Math.round(Number(merged.upBreakSize))
  const downBreakSize = Math.round(Number(merged.downBreakSize))
  const resistanceSize = Math.round(Number(merged.resistanceSize))
  const supportSize = Math.round(Number(merged.supportSize))
  const trendDownSize = Math.round(Number(merged.trendDownSize))
  const trendUpSize = Math.round(Number(merged.trendUpSize))
  const upBreakVdoLower = Number(merged.upBreakVdoLower)
  const upBreakVdoUpper = Number(merged.upBreakVdoUpper)
  const downBreakVdoLower = Number(merged.downBreakVdoLower)
  const downBreakVdoUpper = Number(merged.downBreakVdoUpper)
  const pullbackVdoThreshold = Number(merged.pullbackVdoThreshold)
  const reboundVdoThreshold = Number(merged.reboundVdoThreshold)
  const resistanceVdoLower = Number(merged.resistanceVdoLower)
  const resistanceVdoUpper = Number(merged.resistanceVdoUpper)
  const supportVdoLower = Number(merged.supportVdoLower)
  const supportVdoUpper = Number(merged.supportVdoUpper)
  const trendDownVdoLower = Number(merged.trendDownVdoLower)
  const trendDownVdoUpper = Number(merged.trendDownVdoUpper)
  const trendUpVdoLower = Number(merged.trendUpVdoLower)
  const trendUpVdoUpper = Number(merged.trendUpVdoUpper)
  return {
    highColor,
    highMorganRatio: Number.isFinite(highMorganRatio) ? Math.max(0.118, Math.min(highMorganRatio, 0.236)) : defaultMmfIndicatorSettings.highMorganRatio,
    highOffsetPercent: Number.isFinite(highOffsetPercent) ? Math.max(-99, Math.min(Math.round(highOffsetPercent), 99)) : defaultMmfIndicatorSettings.highOffsetPercent,
    highSize: Number.isFinite(highSize) ? Math.max(8, Math.min(highSize, 96)) : defaultMmfIndicatorSettings.highSize,
    highSymbol,
    dpoValue: Number.isFinite(Number(merged.dpoValue)) ? Math.max(0, Math.min(Math.round(Number(merged.dpoValue)), 40)) : defaultMmfIndicatorSettings.dpoValue,
    lowColor,
    lowDpoValue: Number.isFinite(Number(merged.lowDpoValue)) ? Math.max(-40, Math.min(Math.round(Number(merged.lowDpoValue)), 0)) : defaultMmfIndicatorSettings.lowDpoValue,
    lowMorganRatio: Number.isFinite(lowMorganRatio) ? Math.max(-0.236, Math.min(lowMorganRatio, -0.118)) : defaultMmfIndicatorSettings.lowMorganRatio,
    lowOffsetPercent: Number.isFinite(lowOffsetPercent) ? Math.max(-99, Math.min(Math.round(lowOffsetPercent), 99)) : defaultMmfIndicatorSettings.lowOffsetPercent,
    lowSize: Number.isFinite(lowSize) ? Math.max(8, Math.min(lowSize, 96)) : defaultMmfIndicatorSettings.lowSize,
    lowSymbol,
    pullbackColor,
    pullbackSize: Number.isFinite(pullbackSize) ? Math.max(8, Math.min(pullbackSize, 96)) : defaultMmfIndicatorSettings.pullbackSize,
    pullbackSymbol,
    pullbackVdoThreshold: Number.isFinite(pullbackVdoThreshold) ? pullbackVdoThreshold : defaultMmfIndicatorSettings.pullbackVdoThreshold,
    reboundColor,
    reboundSize: Number.isFinite(reboundSize) ? Math.max(8, Math.min(reboundSize, 96)) : defaultMmfIndicatorSettings.reboundSize,
    reboundSymbol,
    reboundVdoThreshold: Number.isFinite(reboundVdoThreshold) ? reboundVdoThreshold : defaultMmfIndicatorSettings.reboundVdoThreshold,
    resistanceColor,
    resistanceSize: Number.isFinite(resistanceSize) ? Math.max(8, Math.min(resistanceSize, 96)) : defaultMmfIndicatorSettings.resistanceSize,
    resistanceSymbol,
    resistanceVdoLower: Number.isFinite(resistanceVdoLower) ? resistanceVdoLower : defaultMmfIndicatorSettings.resistanceVdoLower,
    resistanceVdoUpper: Number.isFinite(resistanceVdoUpper) ? resistanceVdoUpper : defaultMmfIndicatorSettings.resistanceVdoUpper,
    downBreakVdoLower: Number.isFinite(downBreakVdoLower) ? downBreakVdoLower : defaultMmfIndicatorSettings.downBreakVdoLower,
    downBreakVdoUpper: Number.isFinite(downBreakVdoUpper) ? downBreakVdoUpper : defaultMmfIndicatorSettings.downBreakVdoUpper,
    downBreakColor,
    downBreakSize: Number.isFinite(downBreakSize) ? Math.max(8, Math.min(downBreakSize, 96)) : defaultMmfIndicatorSettings.downBreakSize,
    downBreakSymbol,
    showResistanceLevel: merged.showResistanceLevel === true,
    showHigh: merged.showHigh === true,
    showLow: merged.showLow === true,
    showPullbackPoint: merged.showPullbackPoint === true,
    showReboundPoint: merged.showReboundPoint === true,
    showDownBreakPoint: merged.showDownBreakPoint === true,
    showSupportLevel: merged.showSupportLevel === true,
    showTrendDownPoint: merged.showTrendDownPoint === true,
    showTrendUpPoint: merged.showTrendUpPoint === true,
    showUpBreakPoint: merged.showUpBreakPoint === true,
    supportColor,
    supportSize: Number.isFinite(supportSize) ? Math.max(8, Math.min(supportSize, 96)) : defaultMmfIndicatorSettings.supportSize,
    supportSymbol,
    supportVdoLower: Number.isFinite(supportVdoLower) ? supportVdoLower : defaultMmfIndicatorSettings.supportVdoLower,
    supportVdoUpper: Number.isFinite(supportVdoUpper) ? supportVdoUpper : defaultMmfIndicatorSettings.supportVdoUpper,
    trendDownColor,
    trendDownSize: Number.isFinite(trendDownSize) ? Math.max(8, Math.min(trendDownSize, 96)) : defaultMmfIndicatorSettings.trendDownSize,
    trendDownSymbol,
    trendDownVdoLower: Number.isFinite(trendDownVdoLower) ? trendDownVdoLower : defaultMmfIndicatorSettings.trendDownVdoLower,
    trendDownVdoUpper: Number.isFinite(trendDownVdoUpper) ? trendDownVdoUpper : defaultMmfIndicatorSettings.trendDownVdoUpper,
    trendUpColor,
    trendUpSize: Number.isFinite(trendUpSize) ? Math.max(8, Math.min(trendUpSize, 96)) : defaultMmfIndicatorSettings.trendUpSize,
    trendUpSymbol,
    trendUpVdoLower: Number.isFinite(trendUpVdoLower) ? trendUpVdoLower : defaultMmfIndicatorSettings.trendUpVdoLower,
    trendUpVdoUpper: Number.isFinite(trendUpVdoUpper) ? trendUpVdoUpper : defaultMmfIndicatorSettings.trendUpVdoUpper,
    upBreakColor,
    upBreakSize: Number.isFinite(upBreakSize) ? Math.max(8, Math.min(upBreakSize, 96)) : defaultMmfIndicatorSettings.upBreakSize,
    upBreakSymbol,
    upBreakVdoLower: Number.isFinite(upBreakVdoLower) ? upBreakVdoLower : defaultMmfIndicatorSettings.upBreakVdoLower,
    upBreakVdoUpper: Number.isFinite(upBreakVdoUpper) ? upBreakVdoUpper : defaultMmfIndicatorSettings.upBreakVdoUpper,
  }
}

export function normalizeVdoSettings(input?: Partial<VdoIndicatorSettings>): VdoIndicatorSettings {
  const merged = { ...defaultVdoIndicatorSettings, ...(input ?? {}) }
  const emaSmoothing = Math.round(Number(merged.emaSmoothing))
  return {
    ...normalizeDpoSettings(merged),
    emaSmoothing: Number.isFinite(emaSmoothing) ? Math.max(0, Math.min(emaSmoothing, 500)) : defaultVdoIndicatorSettings.emaSmoothing,
  }
}

export function normalizeDpoSettings(input?: Partial<DpoIndicatorSettings>): DpoIndicatorSettings {
  const merged = { ...defaultDpoIndicatorSettings, ...(input ?? {}) }
  const backgroundOpacity = Number(merged.backgroundOpacity)
  const length = Math.round(Number(merged.length))
  const dpoLineWidth = Math.round(Number(merged.dpoLineWidth))
  const dpoOpacity = Number(merged.dpoOpacity)
  const downLine2Width = Math.round(Number(merged.downLine2Width))
  const downLine2Opacity = Number(merged.downLine2Opacity)
  const downLine2Value = Number(merged.downLine2Value)
  const downLineWidth = Math.round(Number(merged.downLineWidth))
  const downLineOpacity = Number(merged.downLineOpacity)
  const downLineValue = Number(merged.downLineValue)
  const upLine2Width = Math.round(Number(merged.upLine2Width))
  const upLine2Opacity = Number(merged.upLine2Opacity)
  const upLine2Value = Number(merged.upLine2Value)
  const upLineWidth = Math.round(Number(merged.upLineWidth))
  const upLineOpacity = Number(merged.upLineOpacity)
  const upLineValue = Number(merged.upLineValue)
  const zeroLineWidth = Math.round(Number(merged.zeroLineWidth))
  const zeroLineOpacity = Number(merged.zeroLineOpacity)
  const zeroLineValue = Number(merged.zeroLineValue)
  return {
    ...merged,
    backgroundOpacity: Number.isFinite(backgroundOpacity) ? Math.max(0, Math.min(backgroundOpacity, 1)) : defaultDpoIndicatorSettings.backgroundOpacity,
    backgroundVisible: merged.backgroundVisible === true,
    centered: merged.centered === true,
    dpoLineStyle: merged.dpoLineStyle === 'dashed' || merged.dpoLineStyle === 'dotted' ? merged.dpoLineStyle : 'solid',
    dpoLineWidth: Number.isFinite(dpoLineWidth) ? Math.max(1, Math.min(dpoLineWidth, 4)) : defaultDpoIndicatorSettings.dpoLineWidth,
    dpoOpacity: Number.isFinite(dpoOpacity) ? Math.max(0, Math.min(dpoOpacity, 1)) : defaultDpoIndicatorSettings.dpoOpacity,
    dpoVisible: merged.dpoVisible !== false,
    downLine2Style: merged.downLine2Style === 'solid' || merged.downLine2Style === 'dotted' ? merged.downLine2Style : 'dashed',
    downLine2Width: Number.isFinite(downLine2Width) ? Math.max(1, Math.min(downLine2Width, 4)) : defaultDpoIndicatorSettings.downLine2Width,
    downLine2Opacity: Number.isFinite(downLine2Opacity) ? Math.max(0, Math.min(downLine2Opacity, 1)) : defaultDpoIndicatorSettings.downLine2Opacity,
    downLine2Value: Number.isFinite(downLine2Value) ? downLine2Value : defaultDpoIndicatorSettings.downLine2Value,
    downLine2Visible: merged.downLine2Visible !== false,
    downLineStyle: merged.downLineStyle === 'solid' || merged.downLineStyle === 'dotted' ? merged.downLineStyle : 'dashed',
    downLineWidth: Number.isFinite(downLineWidth) ? Math.max(1, Math.min(downLineWidth, 4)) : defaultDpoIndicatorSettings.downLineWidth,
    downLineOpacity: Number.isFinite(downLineOpacity) ? Math.max(0, Math.min(downLineOpacity, 1)) : defaultDpoIndicatorSettings.downLineOpacity,
    downLineValue: Number.isFinite(downLineValue) ? downLineValue : defaultDpoIndicatorSettings.downLineValue,
    downLineVisible: merged.downLineVisible === true,
    inputsInStatusLine: merged.inputsInStatusLine !== false,
    labelsOnPriceScale: merged.labelsOnPriceScale !== false,
    length: Number.isFinite(length) ? Math.max(1, Math.min(length, 500)) : defaultDpoIndicatorSettings.length,
    precision: ['0', '1', '2', '3', '4', 'system'].includes(merged.precision) ? merged.precision : 'system',
    timeframe: ['chart', '1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(merged.timeframe) ? merged.timeframe : 'chart',
    upLine2Style: merged.upLine2Style === 'solid' || merged.upLine2Style === 'dotted' ? merged.upLine2Style : 'dashed',
    upLine2Width: Number.isFinite(upLine2Width) ? Math.max(1, Math.min(upLine2Width, 4)) : defaultDpoIndicatorSettings.upLine2Width,
    upLine2Opacity: Number.isFinite(upLine2Opacity) ? Math.max(0, Math.min(upLine2Opacity, 1)) : defaultDpoIndicatorSettings.upLine2Opacity,
    upLine2Value: Number.isFinite(upLine2Value) ? upLine2Value : defaultDpoIndicatorSettings.upLine2Value,
    upLine2Visible: merged.upLine2Visible !== false,
    upLineStyle: merged.upLineStyle === 'solid' || merged.upLineStyle === 'dotted' ? merged.upLineStyle : 'dashed',
    upLineWidth: Number.isFinite(upLineWidth) ? Math.max(1, Math.min(upLineWidth, 4)) : defaultDpoIndicatorSettings.upLineWidth,
    upLineOpacity: Number.isFinite(upLineOpacity) ? Math.max(0, Math.min(upLineOpacity, 1)) : defaultDpoIndicatorSettings.upLineOpacity,
    upLineValue: Number.isFinite(upLineValue) ? upLineValue : defaultDpoIndicatorSettings.upLineValue,
    upLineVisible: merged.upLineVisible === true,
    valuesInStatusLine: merged.valuesInStatusLine !== false,
    waitForTimeframeClose: merged.waitForTimeframeClose !== false,
    zeroLineStyle: merged.zeroLineStyle === 'solid' || merged.zeroLineStyle === 'dotted' ? merged.zeroLineStyle : 'dashed',
    zeroLineWidth: Number.isFinite(zeroLineWidth) ? Math.max(1, Math.min(zeroLineWidth, 4)) : defaultDpoIndicatorSettings.zeroLineWidth,
    zeroLineOpacity: Number.isFinite(zeroLineOpacity) ? Math.max(0, Math.min(zeroLineOpacity, 1)) : defaultDpoIndicatorSettings.zeroLineOpacity,
    zeroLineValue: Number.isFinite(zeroLineValue) ? zeroLineValue : defaultDpoIndicatorSettings.zeroLineValue,
    zeroLineVisible: merged.zeroLineVisible !== false,
  }
}
