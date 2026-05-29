import { describe, expect, it } from 'vitest'
import {
  createLoadCommand,
  createLoadedIndicatorCommands,
  getIndicatorSettings,
  indicatorRestoreOrder,
  loadedKeysFromState,
  loadedRecordFromKeys,
  withIndicatorSettings,
} from './indicatorControllerModel'
import { readPersistedIndicatorsState } from '../rightDrawer/indicatorPersistence'

describe('indicatorControllerModel', () => {
  it('keeps restore order stable and derives loaded records from keys', () => {
    const loaded = loadedRecordFromKeys(['Vol', 'RSI', 'MR'])

    expect(loaded).toMatchObject({ MR: true, RSI: true, Vol: true, MACD: false })
    expect(loadedKeysFromState({ ...readPersistedIndicatorsState(), loaded })).toEqual(['RSI', 'MR', 'Vol'])
    expect(indicatorRestoreOrder).toEqual(['RSI', 'Stoch', 'SQZMOM', 'MACD', 'DPO', 'VDO', 'TSI', 'VI', 'MA', 'MR', 'MMF', 'MMF_V2', 'VWAP', 'Vol'])
  })

  it('reads and writes settings through the indicator registry', () => {
    const state = readPersistedIndicatorsState()
    const next = withIndicatorSettings(state, 'MR', { ...state.mr, labelsOnPriceScale: false })

    expect(getIndicatorSettings(next, 'MR')).toMatchObject({ labelsOnPriceScale: false })
    expect(next.rsi).toBe(state.rsi)
  })

  it('creates typed load commands with the matching settings block', () => {
    const state = readPersistedIndicatorsState()

    expect(createLoadCommand(state, 'RSI')).toMatchObject({ action: 'load', id: 0, name: 'RSI', settings: state.rsi })
    expect(createLoadCommand(state, 'VWAP')).toMatchObject({ action: 'load', id: 0, name: 'VWAP', settings: state.vwap })
  })

  it('creates restore commands only for loaded indicators in stable order', () => {
    const state = {
      ...readPersistedIndicatorsState(),
      loaded: loadedRecordFromKeys(['Vol', 'MR', 'RSI']),
    }

    expect(createLoadedIndicatorCommands(state).map((command) => command.name)).toEqual(['RSI', 'MR', 'Vol'])
    expect(createLoadedIndicatorCommands(state, 'MR').map((command) => command.name)).toEqual(['MR'])
    expect(createLoadedIndicatorCommands(state, 'MACD')).toEqual([])
  })
})
