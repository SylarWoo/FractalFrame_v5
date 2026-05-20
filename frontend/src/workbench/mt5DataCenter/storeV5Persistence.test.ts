import { beforeEach, describe, expect, it } from 'vitest'
import { storageKeys } from '../persistence/storageKeys'
import {
  publishSharedSelection,
  readImportCenterSelectedTab,
  readPersistedRealtimeSnapshot,
  readSharedSelection,
  readStorePanelPersistenceEnabled,
  readStoreV5ListSymbols,
  readWatchlistSymbols,
  saveShortcutMenuEnabled,
  saveWatchlistSymbols,
  shortcutMenuChangedEvent,
  watchlistChangedEvent,
} from './storeV5Persistence'

function installWindow(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const events: string[] = []
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      dispatchEvent: (event: Event) => {
        events.push(event.type)
        return true
      },
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
  return { events, values }
}

describe('storeV5Persistence', () => {
  beforeEach(() => {
    installWindow()
  })

  it('uses stable fallbacks for missing and malformed storage values', () => {
    installWindow({
      [storageKeys.importCenterSelectedTab]: 'unknown',
      [storageKeys.importCenterStoreV5ListSymbols]: '{',
      [storageKeys.importCenterWatchlistRealtimeSnapshot]: JSON.stringify({
        lastTickAt: 123,
        log: ['a', 1, 'b'],
        ticks: null,
      }),
      [storageKeys.importCenterWatchlistSymbols]: JSON.stringify(['XAUUSDm', 1, 'EURUSDm']),
    })

    expect(readImportCenterSelectedTab()).toBe('details')
    expect(readStorePanelPersistenceEnabled()).toBe(true)
    expect(readStoreV5ListSymbols()).toEqual([])
    expect(readWatchlistSymbols()).toEqual(['XAUUSDm', 'EURUSDm'])
    expect(readPersistedRealtimeSnapshot()).toEqual({ lastTickAt: '', log: ['a', 'b'], ticks: {} })
  })

  it('persists list and shortcut state while dispatching public events', () => {
    const { events, values } = installWindow()

    saveWatchlistSymbols(['XAUUSDm', 'XAUUSDm', 'EURUSDm'])
    saveShortcutMenuEnabled(true)
    publishSharedSelection('XAUUSDm', 'h4')

    expect(JSON.parse(values.get(storageKeys.importCenterWatchlistSymbols) ?? '[]')).toEqual(['XAUUSDm', 'EURUSDm'])
    expect(values.get(storageKeys.importCenterShortcutMenuEnabled)).toBe('1')
    expect(readSharedSelection()).toEqual({ symbol: 'XAUUSDm', period: 'H4' })
    expect(events).toContain(watchlistChangedEvent)
    expect(events).toContain(shortcutMenuChangedEvent)
  })
})
