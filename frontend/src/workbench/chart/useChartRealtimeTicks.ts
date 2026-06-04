import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { ActionType } from 'klinecharts'
import type { Chart, KLineData } from 'klinecharts'
import { loadStoreV6KLineData } from '../../datafeed/storeV6KLineDatafeed'
import { queryMt5Rates } from '../../services/mt5/mt5SymbolsApi'
import type { StoreV6QueryRow } from '../../services/mt5/mt5SymbolsApi'
import { readWatchlistRealtimeEnabled, realtimeEnabledChangedEvent } from '../mt5DataCenter/storeV6Persistence'
import { writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { dispatchWorkbenchEvent, workbenchEvents } from '../persistence/workbenchEvents'
import { applyPriceVolumePrecision } from './chartStyleAppliers'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { applyNewDataWithFuturePlaceholders, stripFuturePlaceholders } from './chartFuturePlaceholders'
import { mergeKLineData } from './chartCoreDataUtils'
import { storeV6HistoryPageSize, storeV6LivePageSize } from './pagePartition/pagePartitionBuilder'
import { readRealtimePageBuffer, upsertRealtimePageBufferRow, writeRealtimePageBuffer } from './realtimePageBuffer'
import { enrichRealtimeBarIdentity, normalizeRealtimePeriod } from './realtimeBarIdentity'

type UseChartRealtimeTicksOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  dataReady?: boolean
  period: string
  renderActive?: boolean
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
const realtimePageWindowRows = storeV6LivePageSize
const realtimePageBackfillRows = storeV6HistoryPageSize
const realtimePageRolloverRows = storeV6HistoryPageSize
const realtimePageRolloverStepRows = storeV6HistoryPageSize - storeV6LivePageSize
const defaultMt5RealtimeInitialBarsLimit = 600
const defaultRealtimeLocalBackfillLimit = realtimePageWindowRows - defaultMt5RealtimeInitialBarsLimit

function resolveRealtimeWindowLimits(period: string) {
  const periodSeconds = resolvePeriodSeconds(period)
  if (Number.isFinite(periodSeconds) && periodSeconds > 0 && periodSeconds <= 5 * 60) {
    return {
      mt5Rows: defaultMt5RealtimeInitialBarsLimit,
      localRows: defaultRealtimeLocalBackfillLimit,
      maxRows: realtimePageBackfillRows,
    }
  }
  if (Number.isFinite(periodSeconds) && periodSeconds > 0 && periodSeconds <= 30 * 60) {
    return {
      mt5Rows: defaultMt5RealtimeInitialBarsLimit,
      localRows: defaultRealtimeLocalBackfillLimit,
      maxRows: realtimePageBackfillRows,
    }
  }
  return {
    mt5Rows: defaultMt5RealtimeInitialBarsLimit,
    localRows: defaultRealtimeLocalBackfillLimit,
    maxRows: realtimePageBackfillRows,
  }
}

function dispatchChartRealtimeDataChanged() {
  window.dispatchEvent(new Event(chartRealtimeDataChangedEvent))
}

function dispatchRealtimePageRolloverRequested(options: {
  period: string
  rows: number
  symbol: string
}) {
  window.dispatchEvent(new CustomEvent(workbenchEvents.realtimePageRolloverRequested, {
    detail: {
      period: options.period,
      rows: options.rows,
      symbol: options.symbol,
      thresholdRows: realtimePageRolloverRows,
    },
  }))
}

function saveRealtimePageSnapshot({
  localRows,
  pageSize,
  period,
  rows,
  symbol,
}: {
  localRows: number
  pageSize: number
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
    pageSize,
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
  return normalizeRealtimePeriod(period)
}

function estimateTurnover(high: number, low: number, close: number, volume: number) {
  const typicalPrice = Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
    ? (high + low + close) / 3
    : close
  return Number.isFinite(typicalPrice) && Number.isFinite(volume) ? typicalPrice * volume : 0
}

function rowToKLine(row: StoreV6QueryRow, symbol: string, period: string): KLineData | null {
  const timestamp = Number(row.time) * 1000
  const open = Number(row.open)
  const high = Number(row.high)
  const low = Number(row.low)
  const close = Number(row.close)
  const volume = Number(row.volume ?? 0)
  if (![timestamp, open, high, low, close].every(Number.isFinite)) return null
  return enrichRealtimeBarIdentity({
    barKey: typeof row.barKey === 'string' ? row.barKey : undefined,
    globalIndex: typeof row.globalIndex === 'number' ? row.globalIndex : undefined,
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    sessionId: typeof row.sessionId === 'string' ? row.sessionId : undefined,
    tradingDay: typeof row.tradingDay === 'string' ? row.tradingDay : undefined,
    turnover: estimateTurnover(high, low, close, volume),
  } as KLineData, {
    period,
    source: 'storeV6',
    symbol,
  })
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

export function resolveRealtimeRateVolume(options: {
  appendNewBar: boolean
  latestVolume?: number | null
  mt5RateVolume?: number | null
}) {
  const mt5RateVolume = options.mt5RateVolume == null ? NaN : Number(options.mt5RateVolume)
  if (Number.isFinite(mt5RateVolume) && mt5RateVolume >= 0) return mt5RateVolume
  const latestVolume = Number(options.latestVolume ?? 0)
  if (options.appendNewBar) return 0
  return Number.isFinite(latestVolume) ? Math.max(0, latestVolume) : 0
}

export function useChartRealtimeTicks({ chartInstanceRef, dataReady = true, period, renderActive = true, symbol }: UseChartRealtimeTicksOptions) {
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
    if (!realtimeEnabled) return

    let disposed = false
    let bindTimer = 0
    let inFlight = false
    let tickDataReadyFallbackTimer = 0
    let tickDataReadySubscribedChart: Chart | null = null
    let lastRolloverBucket = 0
    let lastRealtimeTickSignature = ''
    const normalizedSymbol = normalizeSymbol(symbol)
    const periodSeconds = resolvePeriodSeconds(period)
    const realtimeWindowLimits = resolveRealtimeWindowLimits(period)
    const initialRealtimeBackfillEnabled = false

    const finishRealtimeTickUpdate = () => {
      if (tickDataReadySubscribedChart) {
        tickDataReadySubscribedChart.unsubscribeAction(ActionType.OnDataReady, finishRealtimeTickUpdate)
        tickDataReadySubscribedChart = null
      }
      if (tickDataReadyFallbackTimer !== 0) {
        window.clearTimeout(tickDataReadyFallbackTimer)
        tickDataReadyFallbackTimer = 0
      }
      if (disposed) return
      const chart = chartInstanceRef.current
      if (!chart) return
      applyPriceVolumePrecision(chart, symbol)
      const realRows = stripFuturePlaceholders(chart.getDataList()).length
      if (realRows >= realtimePageRolloverRows) {
        const bucket = Math.floor((realRows - realtimePageWindowRows) / Math.max(1, realtimePageRolloverStepRows))
        if (bucket > lastRolloverBucket) {
          lastRolloverBucket = bucket
          dispatchRealtimePageRolloverRequested({ period, rows: realRows, symbol })
        }
      }
      dispatchChartRealtimeDataChanged()
    }

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
        limit: realtimeWindowLimits.mt5Rows,
      })
        .then((payload) => {
          if (disposed) return
          const rows = (payload.rows ?? [])
            .map((row) => rowToKLine(row, symbol, period))
            .filter((row): row is KLineData => row != null)
          const firstMt5Timestamp = rows[0]?.timestamp
          if (typeof firstMt5Timestamp !== 'number' || !Number.isFinite(firstMt5Timestamp)) {
            applyRealtimePageRows(rows)
            return
          }
          return loadStoreV6KLineData({
            symbol,
            period,
            limit: realtimeWindowLimits.localRows,
            timeTo: Math.floor(firstMt5Timestamp / 1000) - 1,
          })
            .then((localRows) => {
              if (disposed) return
              const realtimePageRows = mergeKLineData(localRows, rows).slice(-realtimeWindowLimits.maxRows)
              writeRealtimePageBuffer(symbol, period, realtimePageRows)
              saveRealtimePageSnapshot({ localRows: localRows.length, pageSize: realtimeWindowLimits.maxRows, period, rows: realtimePageRows, symbol })
              if (renderActive && dataReady) applyRealtimePageRows(realtimePageRows)
            })
            .catch(() => {
              if (disposed) return
              const realtimePageRows = rows.slice(-realtimeWindowLimits.maxRows)
              writeRealtimePageBuffer(symbol, period, realtimePageRows)
              saveRealtimePageSnapshot({ localRows: 0, pageSize: realtimeWindowLimits.maxRows, period, rows: realtimePageRows, symbol })
              if (renderActive && dataReady) applyRealtimePageRows(realtimePageRows)
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
      const last = resolveTickLast(detail)
      if (typeof last !== 'number' || !Number.isFinite(last)) return
      const tickSignature = [
        normalizeSymbol(detail.symbol),
        detail.timeMsc ?? detail.time ?? '',
        detail.bid ?? '',
        detail.ask ?? '',
        detail.last ?? '',
        detail.volume ?? '',
      ].join('|')
      if (tickSignature === lastRealtimeTickSignature) return
      lastRealtimeTickSignature = tickSignature
      const chart = chartInstanceRef.current
      const rows = renderActive && dataReady && chart
        ? stripFuturePlaceholders(chart.getDataList())
        : readRealtimePageBuffer(symbol, period)
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
      const volume = resolveRealtimeRateVolume({
        appendNewBar: shouldAppendNewBar,
        latestVolume: Number(latest.volume ?? 0),
        mt5RateVolume: null,
      })
      const rawNextRow = shouldAppendNewBar
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
      const nextRow = enrichRealtimeBarIdentity(rawNextRow, {
        isClosed: false,
        isRealtime: true,
        period,
        source: 'mt5Tick',
        symbol,
      })
      if (!nextRow) return
      const realtimeRows = upsertRealtimePageBufferRow(symbol, period, nextRow, { persist: shouldAppendNewBar })
      if (!renderActive || !dataReady || !chart) {
        saveRealtimePageSnapshot({ localRows: 0, pageSize: realtimeRows.length, period, rows: realtimeRows, symbol })
        if (realtimeRows.length >= realtimePageRolloverRows) {
          const bucket = Math.floor((realtimeRows.length - realtimePageWindowRows) / Math.max(1, realtimePageRolloverStepRows))
          if (bucket > lastRolloverBucket) {
            lastRolloverBucket = bucket
            dispatchRealtimePageRolloverRequested({ period, rows: realtimeRows.length, symbol })
          }
        }
        dispatchChartRealtimeDataChanged()
        return
      }
      if (!tickDataReadySubscribedChart) {
        tickDataReadySubscribedChart = chart
        chart.subscribeAction(ActionType.OnDataReady, finishRealtimeTickUpdate)
      }
      if (tickDataReadyFallbackTimer !== 0) window.clearTimeout(tickDataReadyFallbackTimer)
      tickDataReadyFallbackTimer = window.setTimeout(finishRealtimeTickUpdate, 120)
      chart.updateData(realtimeRows[realtimeRows.length - 1] ?? nextRow)
    }

    const bindWhenReady = () => {
      if (disposed) return
      if (!chartInstanceRef.current) {
        bindTimer = window.setTimeout(bindWhenReady, 50)
        return
      }
      if (!readRealtimePageBuffer(symbol, period).length) {
        loadStoreV6KLineData({ symbol, period, limit: realtimePageWindowRows })
          .then((rows) => {
            if (!disposed && rows.length) writeRealtimePageBuffer(symbol, period, rows)
          })
          .catch(() => {})
      }
      if (initialRealtimeBackfillEnabled) pollMt5Rates()
    }

    bindWhenReady()
    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)

    return () => {
      disposed = true
      if (bindTimer !== 0) window.clearTimeout(bindTimer)
      if (tickDataReadyFallbackTimer !== 0) window.clearTimeout(tickDataReadyFallbackTimer)
      if (tickDataReadySubscribedChart) {
        tickDataReadySubscribedChart.unsubscribeAction(ActionType.OnDataReady, finishRealtimeTickUpdate)
        tickDataReadySubscribedChart = null
      }
      window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    }
  }, [chartInstanceRef, dataReady, period, realtimeEnabled, renderActive, symbol])
}
