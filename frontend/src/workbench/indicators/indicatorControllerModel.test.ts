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
    const loaded = loadedRecordFromKeys(['Vol', 'RSI', 'MR-M5'])

    expect(loaded).toMatchObject({ 'MR-M5': true, RSI: true, Vol: true, MACD: false })
    expect(loadedKeysFromState({ ...readPersistedIndicatorsState(), loaded })).toEqual(['RSI', 'MR-M5', 'Vol'])
    expect(indicatorRestoreOrder).toEqual(['RSI', 'Stoch', 'SQZMOM', 'MACD', 'DPO', 'VDO', 'AO', 'VMI', 'MMAD', 'TSI', 'VI', 'MA', 'MR-M5', 'MR-M30', 'MR-H2', 'MMF_V3', 'MMF_STOCH_H2', 'VWAP', 'Vol'])
  })

  it('reads and writes settings through the indicator registry', () => {
    const state = readPersistedIndicatorsState()
    const next = withIndicatorSettings(state, 'MR-M5', { ...state.mr, labelsOnPriceScale: false })

    expect(getIndicatorSettings(next, 'MR-M5')).toMatchObject({ labelsOnPriceScale: false })
    expect(getIndicatorSettings(next, 'MR-M30')).toMatchObject({ labelsOnPriceScale: true })
    expect(next.rsi).toBe(state.rsi)
  })

  it('creates typed load commands with the matching settings block', () => {
    const state = readPersistedIndicatorsState()

    expect(createLoadCommand(state, 'RSI')).toMatchObject({ action: 'load', id: 0, name: 'RSI', settings: state.rsi })
    expect(createLoadCommand(state, 'VWAP')).toMatchObject({ action: 'load', id: 0, name: 'VWAP', settings: state.vwap })
    expect(createLoadCommand(state, 'RSI').resetAxisOnCreate).toBeUndefined()
    expect(createLoadCommand(state, 'RSI', { resetAxisOnCreate: true })).toMatchObject({ resetAxisOnCreate: true })
  })

  it('creates restore commands only for loaded indicators in stable order', () => {
    const state = {
      ...readPersistedIndicatorsState(),
      loaded: loadedRecordFromKeys(['Vol', 'MR-M30', 'RSI']),
    }

    expect(createLoadedIndicatorCommands(state).map((command) => command.name)).toEqual(['RSI', 'MR-M30', 'Vol'])
    expect(createLoadedIndicatorCommands(state).map((command) => command.resetAxisOnCreate)).toEqual([undefined, undefined, undefined])
    expect(createLoadedIndicatorCommands(state, 'MR-M30').map((command) => command.name)).toEqual(['MR-M30'])
    expect(createLoadedIndicatorCommands(state, 'MACD')).toEqual([])
  })
})
