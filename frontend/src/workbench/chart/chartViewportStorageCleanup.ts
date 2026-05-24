import { readJson, writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { chartSettingKeys } from '../settings/chartSettingsSchema'

const legacyViewportPrefixes = [
  'fractalframe:chartViewport:v1',
  'fractalframe:chartViewport:v2',
  'fractalframe:chartViewport:v3',
]

function cookieNameForStorageKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`
}

export function clearLegacyChartViewportStorage() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (legacyViewportPrefixes.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    // Ignore private or restricted storage modes.
  }

  try {
    document.cookie
      .split(';')
      .map((part) => part.trim().split('=')[0])
      .filter(Boolean)
      .forEach((name) => {
        if (legacyViewportPrefixes.some((prefix) => name.startsWith(cookieNameForStorageKey(prefix)))) {
          deleteCookie(name)
        }
      })
  } catch {
    // Ignore cookie access failures.
  }

  clearBadRightPlaceholderSetting()
}

function clearBadRightPlaceholderSetting() {
  const state = readJson<Record<string, unknown>>(storageKeys.settingsSymbolPanel, {})
  if (!(chartSettingKeys.rightPlaceholderVisible in state)) return
  const { [chartSettingKeys.rightPlaceholderVisible]: _removed, ...nextState } = state
  void _removed
  writeJson(storageKeys.settingsSymbolPanel, nextState)
}
