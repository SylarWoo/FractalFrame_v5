import { readBooleanFlag, readJson, removeStorageItem, writeBooleanFlag, writeJson } from '../persistence/jsonStorage'
import {
  defaultMaIndicatorSettings,
  defaultRsiIndicatorSettings,
  normalizeIndicatorSettingsTab,
  normalizeMacdSettings,
  normalizeMrSettings,
  normalizeStochSettings,
  normalizeTsiSettings,
  normalizeViSettings,
  normalizeVolSettings,
  normalizeVwapSettings,
} from './indicatorSettingsSchema'
import type { PersistedIndicatorsState } from './indicatorSettingsSchema'

export type {
  IndicatorSettingsTab,
  MacdIndicatorSettings,
  MacdMaType,
  MaIndicatorSettings,
  MaMarkerMode,
  MaSource,
  MaType,
  MrIndicatorSettings,
  PersistedIndicatorsState,
  RsiIndicatorSettings,
  RsiLineStyle,
  RsiPrecision,
  RsiSmoothingType,
  RsiSource,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  ViIndicatorSettings,
  VolIndicatorSettings,
  VwapAnchorPeriod,
  VwapBandCalculationMode,
  VwapIndicatorSettings,
  VwapSource,
  VwapTimeframe,
} from './indicatorSettingsSchema'

export {
  defaultMacdIndicatorSettings,
  defaultMaIndicatorSettings,
  defaultMrIndicatorSettings,
  defaultRsiIndicatorSettings,
  defaultStochIndicatorSettings,
  defaultTsiIndicatorSettings,
  defaultViIndicatorSettings,
  defaultVolIndicatorSettings,
  defaultVwapIndicatorSettings,
} from './indicatorSettingsSchema'

const persistEnabledKey = 'fractalframe:v5:indicators:persistEnabled:v1'
const persistedStateKey = 'fractalframe:v5:indicators:state:v1'

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
      MR: parsed?.loaded?.MR === true,
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
    mr: normalizeMrSettings(parsed?.mr),
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
