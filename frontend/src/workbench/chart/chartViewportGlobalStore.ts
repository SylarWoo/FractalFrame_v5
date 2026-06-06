import type { AxisRangeSnapshot } from './chartViewportAxisRange'
import { minCompressedBarSpace } from './chartBarSpaceCompression'

const viewportStoragePrefix = 'fractalframe:chartViewport:v4'
const latestViewportStorageKey = `${viewportStoragePrefix}:latest`
const cookieMaxAgeSeconds = 60 * 60 * 24 * 365
const devViewportStateEndpoint = '/__fractalframe_chart_viewport_state'
const devViewportStateCache = new Map<string, unknown>()

export type ChartViewportSnapshot = {
  barSpace: number
  dataLength: number
  offsetRightDistance: number | null
  period?: string
  rightTimestamp: number | null
  savedAt: string
  scope?: string
  symbol?: string
  visibleTo: number
  yAxisRange: AxisRangeSnapshot | null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function viewportStorageKey(period: string, scope = 'default') {
  return `${viewportStoragePrefix}:global:${period.toUpperCase()}:${scope}`
}

function cookieNameForStorageKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function readCookieJson<T>(key: string): T | null {
  if (typeof document === 'undefined') return null
  const cookieName = `${cookieNameForStorageKey(key)}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName))
  if (!cookie) return null
  try {
    return JSON.parse(decodeURIComponent(cookie.slice(cookieName.length))) as T
  } catch {
    return null
  }
}

function writeCookieJson(key: string, value: unknown) {
  if (typeof document === 'undefined') return
  const payload = encodeURIComponent(JSON.stringify(value))
  document.cookie = `${cookieNameForStorageKey(key)}=${payload}; max-age=${cookieMaxAgeSeconds}; path=/; SameSite=Lax`
}

function readLocalViewportJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

function writeLocalViewportJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore restricted storage modes.
  }
}

function readDevServerJson<T>(key: string): T | null {
  if (devViewportStateCache.has(key)) return devViewportStateCache.get(key) as T
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') return null
  try {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', `${devViewportStateEndpoint}?key=${encodeURIComponent(key)}`, false)
    xhr.send()
    if (xhr.status !== 200) return null
    const response = JSON.parse(xhr.responseText) as { value?: T | null }
    const value = response.value ?? null
    if (value !== null) devViewportStateCache.set(key, value)
    return value
  } catch {
    return null
  }
}

function writeDevServerJson(key: string, value: unknown) {
  devViewportStateCache.set(key, value)
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  try {
    void fetch(devViewportStateEndpoint, {
      body: JSON.stringify({ key, value }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => {})
  } catch {
    // Production preview does not provide the dev endpoint; localStorage still handles it.
  }
}

function readViewportJson(key: string) {
  const snapshot = readCookieJson<Partial<ChartViewportSnapshot>>(key)
    ?? readLocalViewportJson<Partial<ChartViewportSnapshot>>(key)
  if (snapshot) return snapshot

  const serverSnapshot = readDevServerJson<Partial<ChartViewportSnapshot>>(key)
  if (serverSnapshot) {
    writeLocalViewportJson(key, serverSnapshot)
    writeCookieJson(key, serverSnapshot)
    return serverSnapshot
  }
  return snapshot
}

function writeViewportJson(key: string, snapshot: ChartViewportSnapshot) {
  writeLocalViewportJson(key, snapshot)
  writeCookieJson(key, snapshot)
  writeDevServerJson(key, snapshot)
}

function normalizeAxisRange(range: Partial<AxisRangeSnapshot> | null | undefined): AxisRangeSnapshot | null {
  if (!range) return null
  if (!finiteNumber(range.from) || !finiteNumber(range.to) || !finiteNumber(range.range)) return null
  if (!finiteNumber(range.realFrom) || !finiteNumber(range.realTo) || !finiteNumber(range.realRange)) return null
  if (range.range <= 0 || range.realRange <= 0) return null
  return {
    from: range.from,
    range: range.range,
    realFrom: range.realFrom,
    realRange: range.realRange,
    realTo: range.realTo,
    to: range.to,
  }
}

export function readGlobalChartViewportSnapshot(period: string, scope = 'default'): ChartViewportSnapshot | null {
  const snapshot = readViewportJson(viewportStorageKey(period, scope))
  return normalizeChartViewportSnapshot(snapshot)
}

export function readLatestChartViewportSnapshot(): ChartViewportSnapshot | null {
  const snapshot = readViewportJson(latestViewportStorageKey)
  return normalizeChartViewportSnapshot(snapshot)
}

function normalizeChartViewportSnapshot(snapshot: Partial<ChartViewportSnapshot> | null) {
  if (!snapshot || !finiteNumber(snapshot.barSpace) || !finiteNumber(snapshot.visibleTo)) return null
  return {
    barSpace: Math.max(minCompressedBarSpace, Math.min(snapshot.barSpace, 80)),
    dataLength: finiteNumber(snapshot.dataLength) ? snapshot.dataLength : 0,
    offsetRightDistance: finiteNumber(snapshot.offsetRightDistance) ? snapshot.offsetRightDistance : null,
    period: typeof snapshot.period === 'string' ? snapshot.period : undefined,
    rightTimestamp: finiteNumber(snapshot.rightTimestamp) ? snapshot.rightTimestamp : null,
    savedAt: typeof snapshot.savedAt === 'string' ? snapshot.savedAt : '',
    scope: typeof snapshot.scope === 'string' ? snapshot.scope : undefined,
    symbol: typeof snapshot.symbol === 'string' ? snapshot.symbol : undefined,
    visibleTo: snapshot.visibleTo,
    yAxisRange: normalizeAxisRange(snapshot.yAxisRange),
  }
}

export function writeGlobalChartViewportSnapshot(period: string, snapshot: ChartViewportSnapshot, scope = 'default') {
  const nextSnapshot = { ...snapshot, period: period.toUpperCase(), scope }
  writeViewportJson(viewportStorageKey(period, scope), nextSnapshot)
  writeViewportJson(latestViewportStorageKey, nextSnapshot)
}
