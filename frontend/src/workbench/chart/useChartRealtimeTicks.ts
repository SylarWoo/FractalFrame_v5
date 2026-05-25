import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { Chart } from 'klinecharts'
import { queryMt5Tick } from '../../services/mt5/mt5SymbolsApi'
import { saveMarketStatusTitleSnapshotFromRealtimeTick } from '../mt5DataCenter/marketStatusTitleState'
import { readWatchlistRealtimeEnabled, realtimeEnabledChangedEvent } from '../mt5DataCenter/storeV5Persistence'
import { applyPriceVolumePrecision } from './chartStyleAppliers'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { applyRightPlaceholderOffset, stripFuturePlaceholders } from './chartFuturePlaceholders'

type Mt5RealtimeTickEventDetail = {
  ask?: number | null
  bid?: number | null
  last?: number | null
  symbol: string
  time?: number | null
  timeMsc?: number | null
  volume?: number | null
}

type UseChartRealtimeTicksOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  dataReady?: boolean
  period: string
  symbol: string
  totalRows?: number | null
}

export const chartRealtimeDataChangedEvent = 'ff:chart-realtime-data-changed'

function dispatchChartRealtimeDataChanged() {
  window.dispatchEvent(new Event(chartRealtimeDataChangedEvent))
}

function estimateTurnover(high: number, low: number, close: number, volume: number) {
  const typicalPrice = (high + low + close) / 3
  return Number.isFinite(typicalPrice) && Number.isFinite(volume) ? typicalPrice * volume : 0
}

function resolveTickLast(detail: Partial<Mt5RealtimeTickEventDetail>) {
  if (typeof detail.bid === 'number' && Number.isFinite(detail.bid)) return detail.bid
  if (typeof detail.last === 'number' && Number.isFinite(detail.last)) return detail.last
  if (typeof detail.bid === 'number' && typeof detail.ask === 'number') return (detail.bid + detail.ask) / 2
  return detail.ask
}

function normalizeRealtimeSymbol(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase()
}

function replaceOrAppendRealRow(rows: ReturnType<Chart['getDataList']>, nextRow: ReturnType<Chart['getDataList']>[number]) {
  const realRows = stripFuturePlaceholders(rows)
  const index = realRows.findIndex((row) => row.timestamp === nextRow.timestamp)
  if (index >= 0) {
    return realRows.map((row, rowIndex) => (rowIndex === index ? nextRow : row))
  }
  return [...realRows, nextRow]
}

function commitRealtimeRow(
  chart: Chart,
  rows: ReturnType<Chart['getDataList']>,
  nextRow: ReturnType<Chart['getDataList']>[number],
  period: string,
  onCommitted?: () => void,
) {
  if (rows.length !== stripFuturePlaceholders(rows).length) {
    chart.applyNewData(replaceOrAppendRealRow(rows, nextRow), false, () => {
      applyRightPlaceholderOffset(chart, period)
      onCommitted?.()
    })
    return
  }
  chart.updateData(nextRow, () => {
    applyRightPlaceholderOffset(chart, period)
    onCommitted?.()
  })
}

function resolveTickSeconds(detail: Partial<Mt5RealtimeTickEventDetail>) {
  const rawTime = typeof detail.timeMsc === 'number' && Number.isFinite(detail.timeMsc)
    ? detail.timeMsc
    : detail.time
  if (typeof rawTime !== 'number' || !Number.isFinite(rawTime)) return Math.floor(Date.now() / 1000)
  return Math.floor(rawTime > 10_000_000_000 ? rawTime / 1000 : rawTime)
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
    let pollTimer = 0
    let inFlight = false
    let cleanupListeners: (() => void) | null = null

    const bindWhenReady = () => {
      if (disposed || cleanupListeners) return
      const chart = chartInstanceRef.current
      if (!chart) {
        bindTimer = window.setTimeout(bindWhenReady, 50)
        return
      }

      const normalizedPeriod = period.trim().toUpperCase()
      const isDirectM1 = normalizedPeriod === '1M' || normalizedPeriod === 'M1'
      const normalizedSymbol = normalizeRealtimeSymbol(symbol)
      let latestTick: Partial<Mt5RealtimeTickEventDetail> | null = null
      let retryTimer = 0
      let failureCount = 0
      const schedulePoll = () => {
        if (disposed) return
        const delay = failureCount === 0 ? 1000 : Math.min(10_000, 1500 * failureCount)
        pollTimer = window.setTimeout(pollTick, delay)
      }

      const applyRealtimeTick = (detail: Partial<Mt5RealtimeTickEventDetail> | null) => {
        if (!detail || normalizeRealtimeSymbol(detail.symbol) !== normalizedSymbol) return
        saveMarketStatusTitleSnapshotFromRealtimeTick(detail as Mt5RealtimeTickEventDetail)
        latestTick = detail
        const activeChart = chartInstanceRef.current
        if (!activeChart) return

        const last = resolveTickLast(detail)
        if (typeof last !== 'number' || !Number.isFinite(last)) return

        const tickSeconds = resolveTickSeconds(detail)
        const periodSeconds = resolvePeriodSeconds(period)
        const periodMs = periodSeconds * 1000
        const bucketTimestamp = Math.floor(tickSeconds / periodSeconds) * periodSeconds * 1000
        const currentData = activeChart.getDataList()
        const realData = stripFuturePlaceholders(currentData)
        const latest = realData[realData.length - 1]
        if (!latest) {
          if (retryTimer === 0) {
            retryTimer = window.setTimeout(() => {
              retryTimer = 0
              applyRealtimeTick(latestTick)
            }, 100)
          }
          return
        }
        const tickVolume = typeof detail.volume === 'number' && Number.isFinite(detail.volume) ? detail.volume : 0
        const updateLatestPrice = () => {
          if (!latest) return
          const nextHigh = Math.max(Number(latest.high), last)
          const nextLow = Math.min(Number(latest.low), last)
          const nextVolume = Number(latest.volume ?? 0)
          const nextRow = {
            ...latest,
            high: nextHigh,
            low: nextLow,
            close: last,
            volume: nextVolume,
            turnover: estimateTurnover(nextHigh, nextLow, last, nextVolume),
          }
          activeChart.updateData(nextRow, dispatchChartRealtimeDataChanged)
          applyPriceVolumePrecision(activeChart, symbol)
        }

        if (!isDirectM1 && latest && bucketTimestamp <= latest.timestamp) {
          updateLatestPrice()
          return
        }

        if (!isDirectM1) {
          if (bucketTimestamp > latest.timestamp + periodMs) {
            const nextRow = {
              timestamp: bucketTimestamp,
              open: latest.close,
              high: last,
              low: last,
              close: last,
              volume: 0,
              turnover: 0,
            }
            commitRealtimeRow(activeChart, currentData, nextRow, period, dispatchChartRealtimeDataChanged)
            applyPriceVolumePrecision(activeChart, symbol)
            return
          }

          if (bucketTimestamp === latest.timestamp + periodMs) {
            const nextRow = {
              timestamp: bucketTimestamp,
              open: latest.close,
              high: last,
              low: last,
              close: last,
              volume: 0,
              turnover: 0,
            }
            commitRealtimeRow(activeChart, currentData, nextRow, period, dispatchChartRealtimeDataChanged)
            applyPriceVolumePrecision(activeChart, symbol)
          }
          return
        }

        if (!latest || bucketTimestamp > latest.timestamp) {
          const open = latest?.close ?? last
          const nextRow = {
            timestamp: bucketTimestamp,
            open,
            high: last,
            low: last,
            close: last,
            volume: tickVolume,
            turnover: estimateTurnover(last, last, last, tickVolume),
          }
          commitRealtimeRow(activeChart, currentData, nextRow, period, dispatchChartRealtimeDataChanged)
          applyPriceVolumePrecision(activeChart, symbol)
          return
        }

        if (bucketTimestamp === latest.timestamp) {
          const nextHigh = Math.max(Number(latest.high), last)
          const nextLow = Math.min(Number(latest.low), last)
          const nextVolume = isDirectM1
            ? Math.max(Number(latest.volume ?? 0), tickVolume)
            : Number(latest.volume ?? 0)
          activeChart.updateData({
            ...latest,
            high: nextHigh,
            low: nextLow,
            close: last,
            volume: nextVolume,
            turnover: estimateTurnover(nextHigh, nextLow, last, nextVolume),
          }, dispatchChartRealtimeDataChanged)
          applyPriceVolumePrecision(activeChart, symbol)
        }
      }

      const pollTick = () => {
        if (disposed || !symbol || inFlight) return
        inFlight = true
        queryMt5Tick(symbol)
          .then((payload) => {
            failureCount = 0
            applyRealtimeTick(payload.tick ?? null)
          })
          .catch(() => {
            failureCount += 1
          })
          .finally(() => {
            inFlight = false
            schedulePoll()
          })
      }

      pollTick()

      cleanupListeners = () => {
        if (retryTimer !== 0) window.clearTimeout(retryTimer)
        if (pollTimer !== 0) window.clearTimeout(pollTimer)
      }
    }

    bindWhenReady()

    return () => {
      disposed = true
      if (bindTimer !== 0) window.clearTimeout(bindTimer)
      cleanupListeners?.()
    }
  }, [chartInstanceRef, dataReady, period, realtimeEnabled, symbol])
}
