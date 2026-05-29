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
      method: 'POST',
    }).catch(() => {})
  } catch {
    // The dev endpoint is not available in production builds; localStorage remains the fallback.
  }
}

function writeDevStateObjectPatch(key: string, propertyKey: string, value: unknown) {
  const current = devStateCache.get(key)
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    devStateCache.set(key, { ...(current as Record<string, unknown>), [propertyKey]: value })
  }
  devStateLoadedKeys.add(key)
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  const endpoint = resolvePersistentStateEndpoint()
  if (!endpoint) return
  try {
    void fetch(endpoint, {
      body: JSON.stringify({ key, merge: { [propertyKey]: value } }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => {})
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
      method: 'POST',
    }).catch(() => {})
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
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    return fallback
  }

  const devValue = readDevState(key)
  if (devValue !== undefined && typeof devValue !== 'string') {
    try {
      window.localStorage.setItem(key, JSON.stringify(devValue))
    } catch {
      // Ignore restricted storage modes.
    }
    return devValue as T
  }

  return fallback
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

export function writeJsonObjectValue(key: string, propertyKey: string, value: unknown) {
  let nextValue: Record<string, unknown>
  try {
    const raw = window.localStorage.getItem(key)
    const current = raw ? JSON.parse(raw) as unknown : {}
    nextValue = {
      ...(current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>) : {}),
      [propertyKey]: value,
    }
    window.localStorage.setItem(key, JSON.stringify(nextValue))
  } catch {
    // Dev-state patch below keeps persistence working when localStorage is unavailable.
  }
  writeDevStateObjectPatch(key, propertyKey, value)
  return true
}

export function readString(key: string, fallback = '') {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw != null) return raw
  } catch {
    return fallback
  }

  const devValue = readDevState(key)
  if (typeof devValue === 'string') {
    try {
      window.localStorage.setItem(key, devValue)
    } catch {
      // Ignore restricted storage modes.
    }
    return devValue
  }

  return fallback
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
