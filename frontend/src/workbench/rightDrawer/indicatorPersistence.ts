import { readBooleanFlag, readJson, removeStorageItem, writeBooleanFlag, writeJson } from '../persistence/jsonStorage'
import {
  defaultMaIndicatorSettings,
  defaultRsiIndicatorSettings,
  normalizeDpoSettings,
  normalizeIndicatorSettingsTab,
  normalizeMacdSettings,
  normalizeMmfSettings,
  normalizeMrSettings,
  normalizeStochSettings,
  normalizeTsiSettings,
  normalizeVdoSettings,
  normalizeViSettings,
  normalizeVolSettings,
  normalizeVwapSettings,
} from './indicatorSettingsSchema'
import type { PersistedIndicatorsState } from './indicatorSettingsSchema'

export type {
  DpoIndicatorSettings,
  IndicatorSettingsTab,
  MacdIndicatorSettings,
  MacdMaType,
  MaIndicatorSettings,
  MaMarkerMode,
  MaSource,
  MaType,
  MmfIndicatorSettings,
  MmfMorganRatio,
  MrIndicatorSettings,
  PersistedIndicatorsState,
  RsiIndicatorSettings,
  RsiLineStyle,
  RsiPrecision,
  RsiSmoothingType,
  RsiSource,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  VolIndicatorSettings,
  VwapAnchorPeriod,
  VwapBandCalculationMode,
  VwapIndicatorSettings,
  VwapSource,
  VwapTimeframe,
} from './indicatorSettingsSchema'

export {
  defaultDpoIndicatorSettings,
  defaultMacdIndicatorSettings,
  defaultMaIndicatorSettings,
  defaultMmfIndicatorSettings,
  defaultMrIndicatorSettings,
  defaultRsiIndicatorSettings,
  defaultStochIndicatorSettings,
  defaultTsiIndicatorSettings,
  defaultVdoIndicatorSettings,
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
      DPO: parsed?.loaded?.DPO === true,
      MA: parsed?.loaded?.MA === true,
      MACD: parsed?.loaded?.MACD === true,
      MMF: parsed?.loaded?.MMF === true,
      MMF_V2: parsed?.loaded?.MMF_V2 === true,
      MR: parsed?.loaded?.MR === true,
      RSI: parsed?.loaded?.RSI === true,
      Stoch: parsed?.loaded?.Stoch === true,
      TSI: parsed?.loaded?.TSI === true,
      VDO: parsed?.loaded?.VDO === true,
      VI: parsed?.loaded?.VI === true,
      VWAP: parsed?.loaded?.VWAP === true,
      Vol: parsed?.loaded?.Vol === true,
    },
    dpo: normalizeDpoSettings(parsed?.dpo),
    ma: {
      ...defaultMaIndicatorSettings,
      ...(parsed?.ma ?? {}),
      colors: Array.isArray(parsed?.ma?.colors) && parsed.ma.colors.length > 0
        ? parsed.ma.colors
        : defaultMaIndicatorSettings.colors,
    },
    macd: normalizeMacdSettings(parsed?.macd),
    mmf: normalizeMmfSettings(parsed?.mmf),
    mr: normalizeMrSettings(parsed?.mr),
    rsi: {
      ...defaultRsiIndicatorSettings,
      ...(parsed?.rsi ?? {}),
    },
    stoch: normalizeStochSettings(parsed?.stoch),
    tsi: normalizeTsiSettings(parsed?.tsi),
    vdo: normalizeVdoSettings(parsed?.vdo),
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
