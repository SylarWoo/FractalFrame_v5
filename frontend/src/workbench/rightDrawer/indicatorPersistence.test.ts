import { beforeEach, describe, expect, it } from 'vitest'
import { writeJson } from '../persistence/jsonStorage'
import { readPersistedIndicatorsState } from './indicatorPersistence'

const persistedStateKey = 'fractalframe:v5:indicators:state:v1'

function installStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => {
          values.delete(key)
        },
        setItem: (key: string, value: string) => {
          values.set(key, value)
        },
      },
    },
  })
}

describe('indicatorPersistence', () => {
  beforeEach(() => {
    installStorage()
  })

  it('retires legacy MMF loaded state into MMF_V3', () => {
    writeJson(persistedStateKey, {
      loaded: { MMF: true, MMF_V2: true },
      mmf: { showLow: true },
      ui: { selectedKey: 'MMF_V2' },
    })

    const state = readPersistedIndicatorsState()

    expect(state.loaded.MMF).toBe(false)
    expect(state.loaded.MMF_V2).toBe(false)
    expect(state.loaded.MMF_V3).toBe(true)
    expect(state.mmfV3.showLow).toBe(true)
    expect(state.ui.selectedKey).toBe('MMF_V3')
  })
})
