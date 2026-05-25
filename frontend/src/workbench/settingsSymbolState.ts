import { readJson, writeJsonObjectValue } from './persistence/jsonStorage'
import { storageKeys } from './persistence/storageKeys'
import { dispatchWorkbenchEvent, workbenchEvents } from './persistence/workbenchEvents'

export const settingsSymbolStorageKey = storageKeys.settingsSymbolPanel
export const settingsSymbolChangedEvent = workbenchEvents.settingsSymbolChanged

export function readSettingsSymbolState(): Record<string, unknown> {
  return readJson<Record<string, unknown>>(settingsSymbolStorageKey, {})
}

export function writeSettingsSymbolStateValue(key: string, value: unknown) {
  writeJsonObjectValue(settingsSymbolStorageKey, key, value)
  dispatchWorkbenchEvent(settingsSymbolChangedEvent)
}

export function readSettingsStringValue(storageKey: string, fallback: string) {
  const saved = readSettingsSymbolState()[storageKey]
  return typeof saved === 'string' ? saved : fallback
}

export function readSettingsBooleanValue(storageKey: string, fallback: boolean) {
  const saved = readSettingsSymbolState()[storageKey]
  return typeof saved === 'boolean' ? saved : fallback
}

export function readSettingsNumberStringValue(storageKey: string, fallback: string) {
  const saved = readSettingsSymbolState()[storageKey]
  if (typeof saved !== 'string') return fallback
  if (saved === 'system') return saved
  const parsed = Number(saved)
  return Number.isFinite(parsed) ? saved : fallback
}
