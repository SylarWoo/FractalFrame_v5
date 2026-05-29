import type { ChartIndicatorCommand } from '../chart/ChartCoreHost'
import type { SupportedChartIndicator } from '../rightDrawer/indicatorDefinitions'
import type {
  DpoIndicatorSettings,
  MacdIndicatorSettings,
  MaIndicatorSettings,
  MmfIndicatorSettings,
  MrIndicatorSettings,
  PersistedIndicatorsState,
  RsiIndicatorSettings,
  SqzmomIndicatorSettings,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  VolIndicatorSettings,
  VwapIndicatorSettings,
} from '../rightDrawer/indicatorPersistence'

export type IndicatorSettings =
  | DpoIndicatorSettings
  | MacdIndicatorSettings
  | MaIndicatorSettings
  | MmfIndicatorSettings
  | MrIndicatorSettings
  | RsiIndicatorSettings
  | SqzmomIndicatorSettings
  | StochIndicatorSettings
  | TsiIndicatorSettings
  | VdoIndicatorSettings
  | ViIndicatorSettings
  | VolIndicatorSettings
  | VwapIndicatorSettings

type IndicatorStateField = Exclude<keyof PersistedIndicatorsState, 'loaded' | 'ui'>

type IndicatorControllerDefinition = {
  key: SupportedChartIndicator
  stateField: IndicatorStateField
}

export const indicatorControllerDefinitions = [
  { key: 'RSI', stateField: 'rsi' },
  { key: 'Stoch', stateField: 'stoch' },
  { key: 'SQZMOM', stateField: 'sqzmom' },
  { key: 'MACD', stateField: 'macd' },
  { key: 'DPO', stateField: 'dpo' },
  { key: 'VDO', stateField: 'vdo' },
  { key: 'TSI', stateField: 'tsi' },
  { key: 'VI', stateField: 'vi' },
  { key: 'MA', stateField: 'ma' },
  { key: 'MR', stateField: 'mr' },
  { key: 'MMF', stateField: 'mmf' },
  { key: 'MMF_V2', stateField: 'mmf' },
  { key: 'VWAP', stateField: 'vwap' },
  { key: 'Vol', stateField: 'vol' },
] as const satisfies readonly IndicatorControllerDefinition[]

const indicatorDefinitionByKey = Object.fromEntries(
  indicatorControllerDefinitions.map((definition) => [definition.key, definition]),
) as Record<SupportedChartIndicator, IndicatorControllerDefinition>

export const indicatorRestoreOrder = indicatorControllerDefinitions.map((definition) => definition.key)

export function loadedKeysFromState(state: PersistedIndicatorsState) {
  return indicatorRestoreOrder.filter((key) => state.loaded[key])
}

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

export function createLoadCommand(state: PersistedIndicatorsState, name: SupportedChartIndicator): ChartIndicatorCommand {
  return {
    action: 'load',
    id: 0,
    name,
    settings: getIndicatorSettings(state, name),
  } as ChartIndicatorCommand
}

export function createLoadedIndicatorCommands(state: PersistedIndicatorsState, targetKey?: string) {
  return loadedKeysFromState(state)
    .filter((key) => !targetKey || key === targetKey)
    .map((key) => createLoadCommand(state, key))
}
