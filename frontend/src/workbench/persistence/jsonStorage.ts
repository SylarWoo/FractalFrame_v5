const persistentStateEndpoint = '/__fractalframe_persistent_state'
const devStateCache = new Map<string, unknown>()
const devStateLoadedKeys = new Set<string>()

function readDevState(key: string): unknown {
  if (devStateCache.has(key)) return devStateCache.get(key)
  if (devStateLoadedKeys.has(key)) return undefined
  devStateLoadedKeys.add(key)
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') return undefined
  try {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', `${persistentStateEndpoint}?key=${encodeURIComponent(key)}`, false)
    xhr.send()
    if (xhr.status !== 200) return undefined
    const response = JSON.parse(xhr.responseText) as { value?: unknown | null }
    const value = response.value ?? undefined
    if (value !== undefined) devStateCache.set(key, value)
    return value
  } catch {
    return undefined
  }
}

function writeDevState(key: string, value: unknown) {
  devStateCache.set(key, value)
  devStateLoadedKeys.add(key)
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  const endpoint = resolvePersistentStateEndpoint()
  if (!endpoint) return
  try {
    void fetch(endpoint, {
      body: JSON.stringify({ key, value }),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      method: 'POST',
    })
  } catch {
    // The dev endpoint is not available in production builds; localStorage remains the fallback.
  }
}

function removeDevState(key: string) {
  devStateCache.delete(key)
  devStateLoadedKeys.add(key)
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  const endpoint = resolvePersistentStateEndpoint()
  if (!endpoint) return
  try {
    void fetch(endpoint, {
      body: JSON.stringify({ key, remove: true }),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      method: 'POST',
    })
  } catch {
    // The dev endpoint is not available in production builds; localStorage remains the fallback.
  }
}

function resolvePersistentStateEndpoint() {
  try {
    const origin = window.location?.origin
    return origin ? new URL(persistentStateEndpoint, origin).toString() : null
  } catch {
    return null
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const devValue = readDevState(key)
  if (devValue !== undefined && typeof devValue !== 'string') {
    try {
      window.localStorage.setItem(key, JSON.stringify(devValue))
    } catch {
      // Ignore restricted storage modes.
    }
    return devValue as T
  }

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown) {
  writeDevState(key, value)
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readString(key: string, fallback = '') {
  const devValue = readDevState(key)
  if (typeof devValue === 'string') {
    try {
      window.localStorage.setItem(key, devValue)
    } catch {
      // Ignore restricted storage modes.
    }
    return devValue
  }

  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeString(key: string, value: string) {
  writeDevState(key, value)
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStorageItem(key: string) {
  removeDevState(key)
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function readBooleanFlag(key: string, fallback = false) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : raw === '1'
  } catch {
    return fallback
  }
}

export function writeBooleanFlag(key: string, value: boolean) {
  return writeString(key, value ? '1' : '0')
}
