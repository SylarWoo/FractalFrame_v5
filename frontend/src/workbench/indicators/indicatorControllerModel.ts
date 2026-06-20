import type { ChartIndicatorCommand } from '../chart/chartRuntimeTypes'
import type { SupportedChartIndicator } from '../rightDrawer/indicatorDefinitions'
import type {
  DpoIndicatorSettings,
  MacdIndicatorSettings,
  MaIndicatorSettings,
  MmfIndicatorSettings,
  MmfStochH2IndicatorSettings,
  MrIndicatorSettings,
  PersistedIndicatorsState,
  RsiIndicatorSettings,
  SqzmomIndicatorSettings,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  AoIndicatorSettings,
  VmiIndicatorSettings,
  MmadIndicatorSettings,
  VolIndicatorSettings,
  VwapIndicatorSettings,
} from '../rightDrawer/indicatorPersistence'

export type IndicatorSettings =
  | DpoIndicatorSettings
  | MacdIndicatorSettings
  | MaIndicatorSettings
  | MmfIndicatorSettings
  | MmfStochH2IndicatorSettings
  | MrIndicatorSettings
  | RsiIndicatorSettings
  | SqzmomIndicatorSettings
  | StochIndicatorSettings
  | TsiIndicatorSettings
  | VdoIndicatorSettings
  | ViIndicatorSettings
  | AoIndicatorSettings
  | VmiIndicatorSettings
  | MmadIndicatorSettings
  | VolIndicatorSettings
  | VwapIndicatorSettings

type IndicatorStateField = Exclude<keyof PersistedIndicatorsState, 'loaded' | 'ui'>

type IndicatorControllerDefinition = {
  key: SupportedChartIndicator
  stateField: IndicatorStateField
  chartCommand?: boolean
  chartRequest?: boolean
}

export const indicatorControllerDefinitions: readonly IndicatorControllerDefinition[] = [
  { key: 'RSI', stateField: 'rsi' },
  { key: 'Stoch', stateField: 'stoch' },
  { key: 'SQZMOM', stateField: 'sqzmom' },
  { key: 'MACD', stateField: 'macd' },
  { key: 'DPO', stateField: 'dpo' },
  { key: 'VDO', stateField: 'vdo' },
  { key: 'AO', stateField: 'ao' },
  { key: 'VMI', stateField: 'vmi' },
  { key: 'MMAD', stateField: 'mmad' },
  { key: 'TSI', stateField: 'tsi' },
  { key: 'VI', stateField: 'vi' },
  { key: 'MA', stateField: 'ma' },
  { key: 'MR-M5', stateField: 'mr' },
  { key: 'MR-M30', stateField: 'mrM30' },
  { key: 'MR-H2', stateField: 'mrH2' },
  { key: 'MMF_V3', stateField: 'mmfV3' },
  { key: 'MMF_STOCH_H2', stateField: 'mmfStochH2', chartCommand: false, chartRequest: true },
  { key: 'VWAP', stateField: 'vwap' },
  { key: 'Vol', stateField: 'vol' },
]

const indicatorDefinitionByKey = Object.fromEntries(
  indicatorControllerDefinitions.map((definition) => [definition.key, definition]),
) as Record<SupportedChartIndicator, IndicatorControllerDefinition>

export const indicatorRestoreOrder = indicatorControllerDefinitions.map((definition) => definition.key)

export function loadedKeysFromState(state: PersistedIndicatorsState) {
  return indicatorRestoreOrder.filter((key) => state.loaded[key])
}

export function shouldDispatchIndicatorCommand(name: SupportedChartIndicator) {
  return indicatorDefinitionByKey[name].chartCommand !== false
}

export const chartRequestIndicatorKeys = indicatorControllerDefinitions
  .filter((definition) => definition.chartRequest !== false)
  .map((definition) => definition.key)

export function loadedRecordFromKeys(keys: string[]) {
  const keySet = new Set(keys)
  return Object.fromEntries(
    indicatorControllerDefinitions.map((definition) => [definition.key, keySet.has(definition.key)]),
  ) as PersistedIndicatorsState['loaded']
}

export function getIndicatorSettings(state: PersistedIndicatorsState, name: SupportedChartIndicator): IndicatorSettings {
  return state[indicatorDefinitionByKey[name].stateField] as IndicatorSettings
}

export function withIndicatorSettings(state: PersistedIndicatorsState, name: SupportedChartIndicator, settings: IndicatorSettings): PersistedIndicatorsState {
  return {
    ...state,
    [indicatorDefinitionByKey[name].stateField]: settings,
  }
}

export function createLoadCommand(state: PersistedIndicatorsState, name: SupportedChartIndicator, options: { resetAxisOnCreate?: boolean } = {}): ChartIndicatorCommand {
  return {
    action: 'load',
    id: 0,
    name,
    resetAxisOnCreate: options.resetAxisOnCreate,
    settings: getIndicatorSettings(state, name),
  } as ChartIndicatorCommand
}

export function createLoadedIndicatorCommands(state: PersistedIndicatorsState, targetKey?: string) {
  return loadedKeysFromState(state)
    .filter((key) => !targetKey || key === targetKey)
    .filter(shouldDispatchIndicatorCommand)
    .map((key) => createLoadCommand(state, key))
}
