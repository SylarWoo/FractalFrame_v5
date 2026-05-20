export const settingsSymbolStorageKey = 'fractalframe:settingsSymbolPanel:v1'
export const settingsSymbolChangedEvent = 'fractalframe:settingsSymbolPanelChanged'

export function readSettingsSymbolState(): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(settingsSymbolStorageKey)
    return raw ? JSON.parse(raw) as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function writeSettingsSymbolStateValue(key: string, value: unknown) {
  try {
    const current = readSettingsSymbolState()
    window.localStorage.setItem(settingsSymbolStorageKey, JSON.stringify({ ...current, [key]: value }))
    window.dispatchEvent(new Event(settingsSymbolChangedEvent))
  } catch {
    // Settings persistence is best-effort only.
  }
}

export function readSettingsStringValue(storageKey: string, fallback: string) {
  const saved = readSettingsSymbolState()[storageKey]
  return typeof saved === 'string' ? saved : fallback
}
