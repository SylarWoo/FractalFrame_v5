const periodUiStateEndpoint = '/__fractalframe_period_ui_state'

type PeriodUiStateKind = 'drawings' | 'indicators' | 'settings'

const periodUiStateCache = new Map<string, unknown>()
const periodUiStateLoaded = new Set<string>()

function normalizePeriod(value: string | null | undefined) {
  return String(value || 'M5').trim().toUpperCase() || 'M5'
}

function storageKey(kind: PeriodUiStateKind, period: string) {
  return `fractalframe:period-ui-state:${kind}:${normalizePeriod(period)}:v1`
}

function cacheKey(kind: PeriodUiStateKind, period: string) {
  return `${kind}:${normalizePeriod(period)}`
}

function resolveEndpoint() {
  try {
    const origin = window.location?.origin
    return origin ? new URL(periodUiStateEndpoint, origin).toString() : null
  } catch {
    return null
  }
}

function shouldPreferEndpoint(kind: PeriodUiStateKind, period: string) {
  return kind === 'indicators' && normalizePeriod(period) === 'H2'
}

function readPeriodUiStateFromEndpoint<T>(kind: PeriodUiStateKind, period: string, key: string): T | null {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') return null
  try {
    if (periodUiStateLoaded.has(key)) return null
    periodUiStateLoaded.add(key)
    const params = new URLSearchParams({ kind, period })
    const xhr = new XMLHttpRequest()
    xhr.open('GET', `${periodUiStateEndpoint}?${params.toString()}`, false)
    xhr.send()
    if (xhr.status !== 200) return null
    const response = JSON.parse(xhr.responseText) as { value?: T | null }
    if (response.value == null) return null
    try {
      window.localStorage.setItem(storageKey(kind, period), JSON.stringify(response.value))
    } catch {
      // LocalStorage is a fallback only.
    }
    periodUiStateCache.set(key, response.value)
    return response.value
  } catch {
    return null
  }
}

export function readPeriodUiState<T>(kind: PeriodUiStateKind, period: string, fallback: T): T {
  const normalizedPeriod = normalizePeriod(period)
  const key = cacheKey(kind, normalizedPeriod)
  if (periodUiStateCache.has(key)) return periodUiStateCache.get(key) as T

  if (shouldPreferEndpoint(kind, normalizedPeriod)) {
    const endpointValue = readPeriodUiStateFromEndpoint<T>(kind, normalizedPeriod, key)
    if (endpointValue != null) return endpointValue
  }

  try {
    const raw = window.localStorage.getItem(storageKey(kind, normalizedPeriod))
    if (raw) {
      const value = JSON.parse(raw) as T
      periodUiStateCache.set(key, value)
      return value
    }
  } catch {
    // Continue to the dev endpoint below.
  }

  const endpointValue = readPeriodUiStateFromEndpoint<T>(kind, normalizedPeriod, key)
  if (endpointValue != null) return endpointValue

  return fallback
}

export function writePeriodUiState(kind: PeriodUiStateKind, period: string, value: unknown) {
  const normalizedPeriod = normalizePeriod(period)
  const key = cacheKey(kind, normalizedPeriod)
  periodUiStateCache.set(key, value)
  periodUiStateLoaded.add(key)
  try {
    window.localStorage.setItem(storageKey(kind, normalizedPeriod), JSON.stringify(value))
  } catch {
    // The dev endpoint below is the primary persistence path.
  }
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  const endpoint = resolveEndpoint()
  if (!endpoint) return
  try {
    void fetch(endpoint, {
      body: JSON.stringify({ kind, period: normalizedPeriod, value }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => {})
  } catch {
    // Production preview may not provide the endpoint.
  }
}

export function removePeriodUiState(kind: PeriodUiStateKind, period: string) {
  const normalizedPeriod = normalizePeriod(period)
  const key = cacheKey(kind, normalizedPeriod)
  periodUiStateCache.delete(key)
  periodUiStateLoaded.add(key)
  try {
    window.localStorage.removeItem(storageKey(kind, normalizedPeriod))
  } catch {
    // LocalStorage is a fallback only.
  }
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  const endpoint = resolveEndpoint()
  if (!endpoint) return
  try {
    void fetch(endpoint, {
      body: JSON.stringify({ kind, period: normalizedPeriod, remove: true }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => {})
  } catch {
    // Production preview may not provide the endpoint.
  }
}
