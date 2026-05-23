const legacyViewportPrefixes = [
  'fractalframe:chartViewport:v1',
  'fractalframe:chartViewport:v2',
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
}
