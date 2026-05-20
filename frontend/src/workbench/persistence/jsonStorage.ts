export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readString(key: string, fallback = '') {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeString(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStorageItem(key: string) {
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
