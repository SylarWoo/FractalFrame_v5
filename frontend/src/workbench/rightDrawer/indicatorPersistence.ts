import { readBooleanFlag, readJson, removeStorageItem, writeBooleanFlag } from '../persistence/jsonStorage'
import { readPeriodUiState, removePeriodUiState, writePeriodUiState } from '../persistence/periodUiStateStorage'
import {
  defaultRsiIndicatorSettings,
  normalizeIndicatorSettingsTab,
  normalizeMacdSettings,
  normalizeMmadSettings,
  normalizeMmfStochH2Settings,
  normalizeMrSettings,
  normalizeSqzmomSettings,
  normalizeStochSettings,
  normalizeTsiSettings,
  normalizeViSettings,
  normalizeAoSettings,
  normalizeVmiSettings,
  normalizeVolSettings,
  normalizeVwapSettings,
} from './indicatorSettingsSchema'
import type { PersistedIndicatorsState } from './indicatorSettingsSchema'
import {
  defaultMaIndicatorSettings,
  normalizeDpoSettings,
  normalizeMmfSettings,
  normalizeVdoSettings,
} from './settings'

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
  MmfStochH2IndicatorSettings,
  MmadTimeframe,
  MrIndicatorSettings,
  PersistedIndicatorsState,
  RsiIndicatorSettings,
  RsiLineStyle,
  RsiPrecision,
  RsiSmoothingType,
  RsiSource,
  SqzmomIndicatorSettings,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  AoIndicatorSettings,
  VmiIndicatorSettings,
  MmadIndicatorSettings,
  VolIndicatorSettings,
  VwapAnchorPeriod,
  VwapBandCalculationMode,
  VwapIndicatorSettings,
  VwapSource,
  VwapTimeframe,
} from './indicatorSettingsSchema'

export {
  defaultMacdIndicatorSettings,
  defaultMrIndicatorSettings,
  defaultRsiIndicatorSettings,
  defaultSqzmomIndicatorSettings,
  defaultStochIndicatorSettings,
  defaultTsiIndicatorSettings,
  defaultViIndicatorSettings,
  defaultAoIndicatorSettings,
  defaultVmiIndicatorSettings,
  defaultMmadIndicatorSettings,
  defaultMmfStochH2IndicatorSettings,
  defaultVolIndicatorSettings,
  defaultVwapIndicatorSettings,
} from './indicatorSettingsSchema'
export {
  defaultDpoIndicatorSettings,
  defaultMaIndicatorSettings,
  defaultMmfIndicatorSettings,
  defaultMmfV2IndicatorSettings,
  defaultVdoIndicatorSettings,
  normalizeMmfV2Settings,
} from './settings'

const persistEnabledKey = 'fractalframe:v5:indicators:persistEnabled:v1'
const persistedStateKey = 'fractalframe:v5:indicators:state:v1'

export function readIndicatorPersistenceEnabled() {
  return readBooleanFlag(persistEnabledKey, true)
}

export function writeIndicatorPersistenceEnabled(enabled: boolean) {
  writeBooleanFlag(persistEnabledKey, enabled)
}

export function readPersistedIndicatorsState(period = 'M5'): PersistedIndicatorsState {
  const parsed = readPeriodUiState<Partial<PersistedIndicatorsState> | null>('indicators', period, null)
    ?? readJson<Partial<PersistedIndicatorsState> | null>(persistedStateKey, null)
  const legacyMmfLoaded = parsed?.loaded?.MMF === true || parsed?.loaded?.MMF_V2 === true
  const legacyMmfSettings = parsed?.mmfV3 ?? parsed?.mmf
  const selectedKey = typeof parsed?.ui?.selectedKey === 'string' && parsed.ui.selectedKey ? parsed.ui.selectedKey : 'RSI'
  return {
    loaded: {
      DPO: parsed?.loaded?.DPO === true,
      MA: parsed?.loaded?.MA === true,
      MACD: parsed?.loaded?.MACD === true,
      MMF: false,
      MMF_V2: false,
      MMF_V3: parsed?.loaded?.MMF_V3 === true || legacyMmfLoaded,
      MMF_STOCH_H2: parsed?.loaded?.MMF_STOCH_H2 === true,
      'MR-M5': parsed?.loaded?.['MR-M5'] === true || parsed?.loaded?.MR === true,
      'MR-M30': parsed?.loaded?.['MR-M30'] === true,
      'MR-H2': parsed?.loaded?.['MR-H2'] === true,
      RSI: parsed?.loaded?.RSI === true,
      SQZMOM: parsed?.loaded?.SQZMOM === true,
      Stoch: parsed?.loaded?.Stoch === true,
      TSI: parsed?.loaded?.TSI === true,
      VDO: parsed?.loaded?.VDO === true,
      VI: parsed?.loaded?.VI === true,
      AO: parsed?.loaded?.AO === true,
      VMI: parsed?.loaded?.VMI === true,
      MMAD: parsed?.loaded?.MMAD === true,
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
    mmfV3: normalizeMmfSettings(legacyMmfSettings),
    mmfStochH2: normalizeMmfStochH2Settings(parsed?.mmfStochH2),
    mr: normalizeMrSettings(parsed?.mr),
    mrM30: normalizeMrSettings(parsed?.mrM30 ?? parsed?.mr),
    mrH2: normalizeMrSettings(parsed?.mrH2),
    rsi: {
      ...defaultRsiIndicatorSettings,
      ...(parsed?.rsi ?? {}),
    },
    sqzmom: normalizeSqzmomSettings(parsed?.sqzmom),
    stoch: normalizeStochSettings(parsed?.stoch),
    tsi: normalizeTsiSettings(parsed?.tsi),
    vdo: normalizeVdoSettings(parsed?.vdo),
    vi: normalizeViSettings(parsed?.vi),
    ao: normalizeAoSettings(parsed?.ao),
    vmi: normalizeVmiSettings(parsed?.vmi),
    mmad: normalizeMmadSettings(parsed?.mmad),
    vwap: normalizeVwapSettings(parsed?.vwap),
    vol: normalizeVolSettings(parsed?.vol),
    ui: {
      activeTab: normalizeIndicatorSettingsTab(parsed?.ui?.activeTab),
      selectedKey: selectedKey === 'MMF' || selectedKey === 'MMF_V2' ? 'MMF_V3' : selectedKey,
    },
  }
}

export function writePersistedIndicatorsState(state: PersistedIndicatorsState, period = 'M5') {
  writePeriodUiState('indicators', period, state)
}

export function clearPersistedIndicatorsState(period = 'M5') {
  removePeriodUiState('indicators', period)
  removeStorageItem(persistedStateKey)
}
