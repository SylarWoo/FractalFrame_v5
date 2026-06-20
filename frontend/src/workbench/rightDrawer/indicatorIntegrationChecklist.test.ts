import { describe, expect, it } from 'vitest'
import { buildChartIndicatorRequestsV2 } from '../chart/indicatorRequestV2/chartIndicatorRequestBuilderV2'
import {
  chartRequestIndicatorKeys,
  createLoadCommand,
  indicatorControllerDefinitions,
  indicatorRestoreOrder,
} from '../indicators/indicatorControllerModel'
import { indicatorRows } from './indicatorDefinitions'
import { readPersistedIndicatorsState } from './indicatorPersistence'

function resolveRequestPeriod(key: string) {
  if (key === 'MMF_STOCH_H2') return 'H2'
  if (key === 'MR-M30') return 'M30'
  if (key === 'MR-H2') return 'H2'
  return 'M5'
}

describe('indicator integration checklist', () => {
  it('keeps table rows, controller definitions, and restore order aligned', () => {
    const rowKeys = indicatorRows.map((row) => row.key)
    const controllerKeys = indicatorControllerDefinitions.map((definition) => definition.key)

    expect(controllerKeys).toEqual(rowKeys)
    expect(indicatorRestoreOrder).toEqual(rowKeys)
  })

  it('provides loaded flags and default settings for every supported indicator', () => {
    const state = readPersistedIndicatorsState()

    for (const definition of indicatorControllerDefinitions) {
      expect(definition.key in state.loaded, `${definition.key} is missing from loaded state`).toBe(true)
      expect(state[definition.stateField], `${definition.key} is missing default settings`).toBeTruthy()
      expect(createLoadCommand(state, definition.key).settings).toBe(state[definition.stateField])
    }
  })

  it('builds at least one chart request for every loadable indicator key', () => {
    const settings = readPersistedIndicatorsState()

    for (const key of chartRequestIndicatorKeys) {
      const requests = buildChartIndicatorRequestsV2({
        loadedIndicatorKeys: [key],
        period: resolveRequestPeriod(key),
        settings,
      })

      expect(requests.length, `${key} is missing from chartIndicatorRequestBuilderV2`).toBeGreaterThan(0)
    }
  })

  it('does not request MMF-Stoch-H2 outside H2 charts', () => {
    const settings = readPersistedIndicatorsState()
    const requests = buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MMF_STOCH_H2'],
      period: 'M5',
      settings,
    })

    expect(requests).toEqual([])
  })
})
