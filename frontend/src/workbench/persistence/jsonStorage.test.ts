import { beforeEach, describe, expect, it } from 'vitest'
import {
  readBooleanFlag,
  readJson,
  readString,
  removeStorageItem,
  writeBooleanFlag,
  writeJson,
  writeString,
} from './jsonStorage'

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

describe('jsonStorage', () => {
  beforeEach(() => {
    installStorage()
  })

  it('falls back for missing and corrupted JSON', () => {
    expect(readJson('missing', { ok: true })).toEqual({ ok: true })
    writeString('broken', '{')

    expect(readJson('broken', ['fallback'])).toEqual(['fallback'])
  })

  it('writes JSON, strings, boolean flags, and removes values', () => {
    expect(writeJson('json', { symbol: 'XAUUSDm' })).toBe(true)
    expect(readJson('json', { symbol: '' })).toEqual({ symbol: 'XAUUSDm' })

    expect(writeString('text', 'M1')).toBe(true)
    expect(readString('text')).toBe('M1')

    expect(readBooleanFlag('flag', true)).toBe(true)
    expect(writeBooleanFlag('flag', false)).toBe(true)
    expect(readBooleanFlag('flag', true)).toBe(false)

    expect(removeStorageItem('text')).toBe(true)
    expect(readString('text', 'fallback')).toBe('fallback')
  })
})
