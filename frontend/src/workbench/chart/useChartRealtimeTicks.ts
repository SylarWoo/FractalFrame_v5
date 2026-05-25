import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { Chart, KLineData } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { queryMt5Rates } from '../../services/mt5/mt5SymbolsApi'
import type { StoreV5QueryRow } from '../../services/mt5/mt5SymbolsApi'
import { readWatchlistRealtimeEnabled, realtimeEnabledChangedEvent } from '../mt5DataCenter/storeV5Persistence'
import { writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { dispatchWorkbenchEvent, workbenchEvents } from '../persistence/workbenchEvents'
import { applyPriceVolumePrecision } from './chartStyleAppliers'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { applyNewDataWithFuturePlaceholders } from './chartFuturePlaceholders'
import { mergeKLineData } from './chartCoreDataUtils'

type UseChartRealtimeTicksOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  dataReady?: boolean
  period: string
  symbol: string
  totalRows?: number | null
}

type Mt5RealtimeTickEventDetail = {
  ask?: number | null
  bid?: number | null
  last?: number | null
  symbol: string
  time?: number | null
  timeMsc?: number | null
  volume?: number | null
}

export const chartRealtimeDataChangedEvent = 'ff:chart-realtime-data-changed'
const mt5RealtimeInitialBarsLimit = 5000
const realtimeLocalBackfillLimit = 20000
const realtimePageMaxRows = mt5RealtimeInitialBarsLimit + realtimeLocalBackfillLimit

function dispatchChartRealtimeDataChanged() {
  window.dispatchEvent(new Event(chartRealtimeDataChangedEvent))
}

function saveRealtimePageSnapshot({
  localRows,
  period,
  rows,
  symbol,
}: {
  localRows: number
  period: string
  rows: KLineData[]
  symbol: string
}) {
  const first = rows[0]
  const last = rows[rows.length - 1]
  writeJson(storageKeys.realtimePageSnapshot, {
    builtAt: new Date().toISOString(),
    localRows,
    mt5Rows: Math.max(0, rows.length - localRows),
    page: 1,
    pageSize: realtimePageMaxRows,
    period,
    rows: rows.length,
    symbol,
    timeFrom: typeof first?.timestamp === 'number' ? Math.floor(first.timestamp / 1000) : null,
    timeTo: typeof last?.timestamp === 'number' ? Math.floor(last.timestamp / 1000) : null,
    type: 'realtime',
  })
  dispatchWorkbenchEvent(workbenchEvents.realtimePageSnapshotChanged)
}

function normalizeTimeframe(period: string) {
  const value = period.trim().toUpperCase()
  if (value === '1M' || value === 'M1') return 'M1'
  if (value.endsWith('M') && value !== 'MN1') return `M${value.slice(0, -1)}`
  if (value.endsWith('H')) return `H${value.slice(0, -1)}`
  return value
}

function estimateTurnover(high: number, low: number, close: number, volume: number) {
  const typicalPrice = Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
    ? (high + low + close) / 3
    : close
  return Number.isFinite(typicalPrice) && Number.isFinite(volume) ? typicalPrice * volume : 0
}

function rowToKLine(row: StoreV5QueryRow): KLineData | null {
  const timestamp = Number(row.time) * 1000
  const open = Number(row.open)
  const high = Number(row.high)
  const low = Number(row.low)
  const close = Number(row.close)
  const volume = Number(row.volume ?? 0)
  if (![timestamp, open, high, low, close].every(Number.isFinite)) return null
  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    turnover: estimateTurnover(high, low, close, volume),
  }
}

function sameKLine(left: KLineData | undefined, right: KLineData | undefined) {
  if (!left || !right) return false
  return Number(left.timestamp) === Number(right.timestamp)
    && Number(left.open) === Number(right.open)
    && Number(left.high) === Number(right.high)
    && Number(left.low) === Number(right.low)
    && Number(left.close) === Number(right.close)
    && Number(left.volume ?? 0) === Number(right.volume ?? 0)
}

function shouldApplyRows(currentRows: KLineData[], nextRows: KLineData[]) {
  if (currentRows.length !== nextRows.length) return true
  const checkCount = Math.min(5, nextRows.length)
  for (let offset = 1; offset <= checkCount; offset += 1) {
    if (!sameKLine(currentRows[currentRows.length - offset], nextRows[nextRows.length - offset])) {
      return true
    }
  }
  return false
}

function normalizeSymbol(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase()
}

function resolveTickLast(detail: Partial<Mt5RealtimeTickEventDetail>) {
  if (typeof detail.bid === 'number' && Number.isFinite(detail.bid)) return detail.bid
  if (typeof detail.last === 'number' && Number.isFinite(detail.last)) return detail.last
  if (typeof detail.bid === 'number' && typeof detail.ask === 'number') return (detail.bid + detail.ask) / 2
  return detail.ask
}

function resolveTickTimestampMs(detail: Partial<Mt5RealtimeTickEventDetail>) {
  if (typeof detail.timeMsc === 'number' && Number.isFinite(detail.timeMsc)) {
    return detail.timeMsc < 1_000_000_000_000 ? detail.timeMsc * 1000 : detail.timeMsc
  }
  if (typeof detail.time === 'number' && Number.isFinite(detail.time)) {
    return detail.time < 1_000_000_000_000 ? detail.time * 1000 : detail.time
  }
  return Date.now()
}

function resolvePeriodStartTimestamp(timestampMs: number, periodSeconds: number) {
  const periodMs = periodSeconds * 1000
  return Math.floor(timestampMs / periodMs) * periodMs
}

export function useChartRealtimeTicks({ chartInstanceRef, dataReady = true, period, symbol }: UseChartRealtimeTicksOptions) {
  const [realtimeEnabled, setRealtimeEnabled] = useState(readWatchlistRealtimeEnabled)

  useEffect(() => {
    const syncRealtimeEnabled = () => setRealtimeEnabled(readWatchlistRealtimeEnabled())
    window.addEventListener(realtimeEnabledChangedEvent, syncRealtimeEnabled)
    window.addEventListener('storage', syncRealtimeEnabled)
    syncRealtimeEnabled()
    return () => {
      window.removeEventListener(realtimeEnabledChangedEvent, syncRealtimeEnabled)
      window.removeEventListener('storage', syncRealtimeEnabled)
    }
  }, [])

  useEffect(() => {
    if (!realtimeEnabled || !dataReady) return

    let disposed = false
    let bindTimer = 0
    let inFlight = false
    const normalizedSymbol = normalizeSymbol(symbol)
    const periodSeconds = resolvePeriodSeconds(period)

    const applyRealtimePageRows = (rows: KLineData[]) => {
      if (disposed) return
      const chart = chartInstanceRef.current
      if (!chart || rows.length === 0) return
      const currentRows = chart.getDataList()
      if (!shouldApplyRows(currentRows, rows)) return
      applyNewDataWithFuturePlaceholders(chart, rows, period, false, () => {
        applyPriceVolumePrecision(chart, symbol)
        dispatchChartRealtimeDataChanged()
      })
    }

    const pollMt5Rates = () => {
      if (disposed || !symbol || inFlight) return
      inFlight = true
      queryMt5Rates({
        symbol,
        timeframe: normalizeTimeframe(period),
        limit: mt5RealtimeInitialBarsLimit,
      })
        .then((payload) => {
          if (disposed) return
          const rows = (payload.rows ?? [])
            .map(rowToKLine)
            .filter((row): row is KLineData => row != null)
          const firstMt5Timestamp = rows[0]?.timestamp
          if (typeof firstMt5Timestamp !== 'number' || !Number.isFinite(firstMt5Timestamp)) {
            applyRealtimePageRows(rows)
            return
          }
          return loadStoreV5KLineData({
            symbol,
            period,
            limit: realtimeLocalBackfillLimit,
            timeTo: Math.floor(firstMt5Timestamp / 1000) - 1,
          })
            .then((localRows) => {
              if (disposed) return
              const realtimePageRows = mergeKLineData(localRows, rows).slice(-realtimePageMaxRows)
              saveRealtimePageSnapshot({ localRows: localRows.length, period, rows: realtimePageRows, symbol })
              applyRealtimePageRows(realtimePageRows)
            })
            .catch(() => {
              if (disposed) return
              saveRealtimePageSnapshot({ localRows: 0, period, rows, symbol })
              applyRealtimePageRows(rows)
            })
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false
        })
    }

    const handleRealtimeTick = (event: Event) => {
      const detail = (event as CustomEvent<Mt5RealtimeTickEventDetail>).detail
      if (!detail || normalizeSymbol(detail.symbol) !== normalizedSymbol) return
      const chart = chartInstanceRef.current
      if (!chart) return
      const last = resolveTickLast(detail)
      if (typeof last !== 'number' || !Number.isFinite(last)) return
      const rows = chart.getDataList()
      const latest = rows[rows.length - 1]
      if (!latest) return
      const latestTimestamp = Number(latest.timestamp)
      const tickTimestamp = resolveTickTimestampMs(detail)
      const tickPeriodStart = resolvePeriodStartTimestamp(tickTimestamp, periodSeconds)
      const shouldAppendNewBar = Number.isFinite(tickPeriodStart) &&
        Number.isFinite(latestTimestamp) &&
        tickPeriodStart > latestTimestamp
      const nextOpen = shouldAppendNewBar ? Number(latest.close) : Number(latest.open)
      const high = shouldAppendNewBar ? Math.max(nextOpen, last) : Math.max(Number(latest.high), last)
      const low = shouldAppendNewBar ? Math.min(nextOpen, last) : Math.min(Number(latest.low), last)
      const volume = shouldAppendNewBar ? 0 : Number(latest.volume ?? 0)
      const nextRow = shouldAppendNewBar
        ? {
            timestamp: tickPeriodStart,
            open: nextOpen,
            high,
            low,
            close: last,
            volume,
            turnover: estimateTurnover(high, low, last, volume),
          }
        : {
            ...latest,
            high,
            low,
            close: last,
            volume,
            turnover: estimateTurnover(high, low, last, volume),
          }
      chart.updateData(nextRow, () => {
        applyPriceVolumePrecision(chart, symbol)
        dispatchChartRealtimeDataChanged()
      })
    }

    const bindWhenReady = () => {
      if (disposed) return
      if (!chartInstanceRef.current) {
        bindTimer = window.setTimeout(bindWhenReady, 50)
        return
      }
      pollMt5Rates()
    }

    bindWhenReady()
    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)

    return () => {
      disposed = true
      if (bindTimer !== 0) window.clearTimeout(bindTimer)
      window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    }
  }, [chartInstanceRef, dataReady, period, realtimeEnabled, symbol])
}
