import { readBooleanFlag, readJson, removeStorageItem, writeBooleanFlag, writeJson } from '../persistence/jsonStorage'

export type RsiSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'
export type RsiSmoothingType = 'none' | 'sma' | 'sma_bb' | 'ema' | 'smma' | 'wma' | 'vwma'
export type RsiPrecision = 'system' | '0' | '1' | '2' | '3' | '4'
export type RsiLineStyle = 'solid' | 'dashed' | 'dotted'
export type MaType = 'sma' | 'ema' | 'smma' | 'wma' | 'vwma'
export type MaSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'
export type MaMarkerMode = 'bar_down' | 'bar_up' | 'triangle_down' | 'triangle_up'
export type IndicatorSettingsTab = 'input' | 'style' | 'visibility'

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
    RSI?: boolean
    Vol?: boolean
  }
  ma: MaIndicatorSettings
  rsi: RsiIndicatorSettings
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
      RSI: parsed?.loaded?.RSI === true,
      Vol: parsed?.loaded?.Vol === true,
    },
    ma: {
      ...defaultMaIndicatorSettings,
      ...(parsed?.ma ?? {}),
      colors: Array.isArray(parsed?.ma?.colors) && parsed.ma.colors.length > 0
        ? parsed.ma.colors
        : defaultMaIndicatorSettings.colors,
    },
    rsi: {
      ...defaultRsiIndicatorSettings,
      ...(parsed?.rsi ?? {}),
    },
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
