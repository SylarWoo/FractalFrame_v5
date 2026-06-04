import type { KLineData } from 'klinecharts'
import { readJson, writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { workbenchEvents } from '../persistence/workbenchEvents'
import { normalizeRealtimeBars } from './realtimeBarIdentity'

const realtimePageBuffers = new Map<string, KLineData[]>()
export const realtimePageBufferMaxRows = 2_500

type PersistedRealtimePageBuffer = {
  savedAt: string
  rows: KLineData[]
}

type PersistedRealtimePageBuffers = Record<string, PersistedRealtimePageBuffer>

function bufferKey(symbol: string, period: string) {
  return `${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}`
}

function normalizeRows(symbol: string, period: string, rows: KLineData[]) {
  return normalizeRealtimeBars(rows, {
    period,
    source: 'realtimeCache',
    symbol,
  })
    .slice(-realtimePageBufferMaxRows)
}

export function readRealtimePageBuffer(symbol: string, period: string) {
  const key = bufferKey(symbol, period)
  const memoryRows = realtimePageBuffers.get(key)
  if (memoryRows) return memoryRows
  const persisted = readJson<PersistedRealtimePageBuffers>(storageKeys.realtimePageBuffer, {})
  const rows = normalizeRows(symbol, period, persisted[key]?.rows ?? [])
  if (rows.length) realtimePageBuffers.set(key, rows)
  return rows
}

export function writeRealtimePageBuffer(symbol: string, period: string, rows: KLineData[]) {
  const key = bufferKey(symbol, period)
  const nextRows = normalizeRows(symbol, period, rows)
  realtimePageBuffers.set(key, nextRows)
  const persisted = readJson<PersistedRealtimePageBuffers>(storageKeys.realtimePageBuffer, {})
  writeJson(storageKeys.realtimePageBuffer, {
    ...persisted,
    [key]: {
      savedAt: new Date().toISOString(),
      rows: nextRows,
    },
  })
  const first = nextRows[0]
  const last = nextRows[nextRows.length - 1]
  window.dispatchEvent(new CustomEvent(workbenchEvents.realtimePageBufferChanged, {
    detail: {
      period,
      rows: nextRows.length,
      symbol,
      timeFrom: typeof first?.timestamp === 'number' ? Math.floor(first.timestamp / 1000) : null,
      timeTo: typeof last?.timestamp === 'number' ? Math.floor(last.timestamp / 1000) : null,
    },
  }))
  return nextRows
}

export function upsertRealtimePageBufferRow(symbol: string, period: string, row: KLineData, options?: { persist?: boolean }) {
  if (options?.persist !== false) {
    return writeRealtimePageBuffer(symbol, period, [...readRealtimePageBuffer(symbol, period), row])
  }
  const key = bufferKey(symbol, period)
  const nextRows = normalizeRows(symbol, period, [...readRealtimePageBuffer(symbol, period), row])
  realtimePageBuffers.set(key, nextRows)
  const first = nextRows[0]
  const last = nextRows[nextRows.length - 1]
  window.dispatchEvent(new CustomEvent(workbenchEvents.realtimePageBufferChanged, {
    detail: {
      period,
      rows: nextRows.length,
      symbol,
      timeFrom: typeof first?.timestamp === 'number' ? Math.floor(first.timestamp / 1000) : null,
      timeTo: typeof last?.timestamp === 'number' ? Math.floor(last.timestamp / 1000) : null,
    },
  }))
  return nextRows
}
