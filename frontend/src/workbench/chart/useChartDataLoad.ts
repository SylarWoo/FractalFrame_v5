import { useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { ActionType, LoadDataType } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { chartError, chartInfo } from './chartLogger'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { applyNewDataWithFuturePlaceholders, stripFuturePlaceholders } from './chartFuturePlaceholders'
import { applySessionBreakIndicator } from './sessionBreakIndicator'
import {
  historyPageSize,
  jumpBarSpace,
  jumpDisplayWindowBars,
  mergeKLineData,
  resolveHasMoreOlder,
  resolveInitialLimit,
} from './chartCoreDataUtils'
import { applyPriceVolumePrecision, resetYAxisAutoScale } from './chartStyleAppliers'
import { scheduleResetYAxisAutoScaleFlags } from './chartAxisInteraction'
import {
  captureChartViewportSnapshot,
  markChartViewportPersistenceReady,
  restoreChartViewportState,
  restoreChartViewportSnapshot,
  type ChartViewportSnapshot,
} from './chartViewportPersistence'
import type { ChartPageTarget } from './ChartCoreHost'

export type ChartLoadStateCore = {
  error: boolean
  loadedPeriod?: string
  loadedSymbol?: string
  loading: boolean
  loadingMore: boolean
  requestedRows: number
  rows: number
}

type UseChartDataLoadOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  jump?: { id: number; timestamp?: number } | null
  limit?: number
  page?: ChartPageTarget | null
  period: string
  reloadId?: number
  symbol: string
  totalRows?: number | null
}

export function useChartDataLoad({
  chartInstanceRef,
  jump,
  limit,
  page,
  period,
  reloadId,
  symbol,
  totalRows,
}: UseChartDataLoadOptions) {
  const requestSeqRef = useRef(0)
  const previousContextRef = useRef<{ period: string; symbol: string } | null>(null)
  const [loadState, setLoadState] = useState<ChartLoadStateCore>({
    error: false,
    loadedPeriod: '',
    loadedSymbol: '',
    loadingMore: false,
    loading: false,
    requestedRows: resolveInitialLimit(limit),
    rows: 0,
  })

  useEffect(() => {
    let disposed = false
    const chart = chartInstanceRef.current
    const requestSeq = requestSeqRef.current + 1
    const requestedRows = resolveInitialLimit(limit)
    let fallbackTimer: number | undefined
    requestSeqRef.current = requestSeq

    if (!chart) return

    const previousContext = previousContextRef.current
    const contextChanged = previousContext != null && (
      previousContext.symbol !== symbol ||
      previousContext.period !== period
    )
    const capturedViewport = contextChanged ? captureChartViewportSnapshot(chart) : null
    const inheritedViewport = capturedViewport && previousContext?.symbol !== symbol
      ? { ...capturedViewport, yAxisRange: null }
      : capturedViewport
    previousContextRef.current = { period, symbol }

    const shouldIgnore = () => disposed || requestSeqRef.current !== requestSeq
    const finishLoaded = () => {
      if (shouldIgnore()) return
      setLoadState({
        error: false,
        loadedPeriod: period,
        loadedSymbol: symbol,
        loadingMore: false,
        loading: false,
        requestedRows,
        rows: stripFuturePlaceholders(chart.getDataList()).length,
      })
    }

    chart.subscribeAction(ActionType.OnDataReady, finishLoaded)
    setLoadState({
      error: false,
      loadedPeriod: '',
      loadedSymbol: '',
      loadingMore: false,
      loading: true,
      requestedRows,
      rows: 0,
    })

    chart.setLoadDataCallback(({ type, data, callback }) => {
      if (shouldIgnore() || page || type !== LoadDataType.Forward || !data) {
        callback([], false)
        return
      }
      setLoadState((current) => ({ ...current, error: false, loadingMore: true }))
      const timeTo = Math.floor(data.timestamp / 1000) - 1
      chartInfo('[StoreV5Datafeed] request older start', { symbol, period, limit: historyPageSize, timeTo })

      loadStoreV5KLineData({ symbol, period, limit: historyPageSize, timeTo })
        .then((olderData) => {
          if (shouldIgnore()) {
            callback([], false)
            return
          }
          const loadedRows = stripFuturePlaceholders(chart.getDataList()).length + olderData.length
          const hasMoreOlder = resolveHasMoreOlder({
            loadedRows,
            pageSize: historyPageSize,
            receivedRows: olderData.length,
            totalRows,
          })
          chartInfo('[StoreV5Datafeed] callback older done', { rows: olderData.length, hasMoreOlder })
          callback(olderData, hasMoreOlder)
          window.setTimeout(() => {
            if (shouldIgnore()) return
            applySessionBreakIndicator(chart, symbol, period)
            setLoadState({
              error: false,
              loadedPeriod: period,
              loadedSymbol: symbol,
              loading: false,
              loadingMore: false,
              requestedRows,
              rows: stripFuturePlaceholders(chart.getDataList()).length,
            })
          }, 0)
        })
        .catch((error: unknown) => {
          if (shouldIgnore()) {
            callback([], false)
            return
          }
          chartError('[StoreV5Datafeed] request older failed', error)
          callback([], false)
          setLoadState((current) => ({
            ...current,
            error: true,
            loading: false,
            loadingMore: false,
            rows: stripFuturePlaceholders(chart.getDataList()).length,
          }))
        })
    })

    const setFallbackTimer = (timer: number) => { fallbackTimer = timer }
    if (page && page.realtime === false) {
      loadPagedWindow(chart, { inheritedViewport, page, period, setFallbackTimer, setLoadState, shouldIgnore, symbol })
    } else if (jump?.timestamp != null) {
      loadJumpWindow(chart, { inheritedViewport, jumpTimestamp: jump.timestamp, period, setFallbackTimer, setLoadState, shouldIgnore, symbol })
    } else {
      loadInitialWindow(chart, { inheritedViewport, period, requestedRows, setFallbackTimer, setLoadState, shouldIgnore, symbol, totalRows })
    }

    return () => {
      disposed = true
      chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
      chart.setLoadDataCallback(({ callback }) => callback([], false))
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
    }
  }, [chartInstanceRef, jump?.id, jump?.timestamp, limit, page, page?.index, page?.limit, page?.realtime, page?.timeTo, period, reloadId, symbol, totalRows])

  return { loadState, setLoadState }
}

type LoadOptions = {
  inheritedViewport?: ChartViewportSnapshot | null
  period: string
  setFallbackTimer: (timer: number) => void
  setLoadState: Dispatch<SetStateAction<ChartLoadStateCore>>
  shouldIgnore: () => boolean
  symbol: string
}

function findNearestDataIndex(chart: Chart, timestamp: number) {
  const dataList = chart.getDataList()
  if (!dataList.length) return -1

  let nearestIndex = 0
  let nearestDistance = Math.abs(Number(dataList[0]?.timestamp ?? 0) - timestamp)
  for (let index = 1; index < dataList.length; index += 1) {
    const distance = Math.abs(Number(dataList[index]?.timestamp ?? 0) - timestamp)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }
  return nearestIndex
}

function scrollJumpTargetIntoView(chart: Chart, timestamp: number) {
  chart.setBarSpace(jumpBarSpace)

  const targetIndex = findNearestDataIndex(chart, timestamp)
  if (targetIndex < 0) return

  const visibleRange = chart.getVisibleRange()
  const visibleCount = Math.max(1, Math.floor(visibleRange.to - visibleRange.from))
  const rightEdgeIndex = Math.min(chart.getDataList().length - 1, targetIndex + Math.floor(visibleCount / 2))
  chart.scrollToDataIndex(rightEdgeIndex, 0)
}

function restorePersistedViewport(chart: Chart, symbol: string, period: string) {
  restoreChartViewportState(chart, symbol, period)
  markChartViewportPersistenceReady(chart, symbol, period)
}

function restoreViewportAfterLoad(chart: Chart, options: LoadOptions) {
  if (options.inheritedViewport) {
    restoreChartViewportSnapshot(chart, options.inheritedViewport)
    markChartViewportPersistenceReady(chart, options.symbol, options.period)
    return
  }
  restorePersistedViewport(chart, options.symbol, options.period)
}

function loadJumpWindow(chart: Chart, options: LoadOptions & { jumpTimestamp: number }) {
  const periodSeconds = resolvePeriodSeconds(options.period)
  const backwardLimit = Math.floor(jumpDisplayWindowBars / 2)
  const forwardLimit = jumpDisplayWindowBars - backwardLimit
  const targetSeconds = Math.floor(options.jumpTimestamp / 1000)
  const backwardTimeTo = targetSeconds + periodSeconds
  const forwardTimeFrom = targetSeconds + periodSeconds + 1

  chartInfo('[StoreV5Datafeed] request jump start', {
    symbol: options.symbol,
    period: options.period,
    backwardLimit,
    backwardTimeTo,
    forwardLimit,
    forwardTimeFrom,
  })
  Promise.all([
    loadStoreV5KLineData({ symbol: options.symbol, period: options.period, limit: backwardLimit, timeTo: backwardTimeTo }),
    loadStoreV5KLineData({ symbol: options.symbol, period: options.period, limit: forwardLimit, timeFrom: forwardTimeFrom }),
  ])
    .then(([backwardData, forwardData]) => {
      if (options.shouldIgnore()) return
      const data = mergeKLineData(backwardData, forwardData)
      const hasMoreOlder = backwardData.length >= backwardLimit
      chartInfo('[StoreV5Datafeed] callback jump done', {
        backwardRows: backwardData.length,
        forwardRows: forwardData.length,
        rows: data.length,
        target: options.jumpTimestamp,
        hasMoreOlder,
      })
      applyNewDataWithFuturePlaceholders(chart, data, options.period, hasMoreOlder)
      applyPriceVolumePrecision(chart, options.symbol)
      options.setFallbackTimer(window.setTimeout(() => {
        if (options.shouldIgnore()) return
        resetYAxisAutoScale(chart)
        scheduleResetYAxisAutoScaleFlags(chart)
        scrollJumpTargetIntoView(chart, options.jumpTimestamp)
        applySessionBreakIndicator(chart, options.symbol, options.period)
        window.setTimeout(() => {
          if (options.shouldIgnore()) return
          resetYAxisAutoScale(chart)
          scheduleResetYAxisAutoScaleFlags(chart)
          scrollJumpTargetIntoView(chart, options.jumpTimestamp)
          applySessionBreakIndicator(chart, options.symbol, options.period)
          markChartViewportPersistenceReady(chart, options.symbol, options.period)
        }, 0)
          options.setLoadState({
            error: false,
            loadedPeriod: options.period,
            loadedSymbol: options.symbol,
            loadingMore: false,
            loading: false,
          requestedRows: jumpDisplayWindowBars,
          rows: stripFuturePlaceholders(chart.getDataList()).length || data.length,
        })
      }, 0))
    })
    .catch((error: unknown) => {
      if (options.shouldIgnore()) return
      chartError('[StoreV5Datafeed] request jump failed', error)
      applyNewDataWithFuturePlaceholders(chart, [], options.period, false)
      options.setLoadState({ error: true, loadingMore: false, loading: false, requestedRows: jumpDisplayWindowBars, rows: 0 })
    })
}

function loadPagedWindow(chart: Chart, options: LoadOptions & { page: ChartPageTarget }) {
  const limit = Math.max(1, Math.round(options.page.limit))
  const timeTo = typeof options.page.timeTo === 'number' && Number.isFinite(options.page.timeTo)
    ? options.page.timeTo
    : undefined
  chartInfo('[StoreV5Datafeed] request page start', {
    symbol: options.symbol,
    period: options.period,
    page: options.page.index,
    limit,
    timeTo,
  })
  loadStoreV5KLineData({ symbol: options.symbol, period: options.period, limit, timeTo })
    .then((data) => {
      if (options.shouldIgnore()) return
      chartInfo('[StoreV5Datafeed] callback page done', { rows: data.length, page: options.page.index })
      applyNewDataWithFuturePlaceholders(chart, data, options.period, false)
      applyPriceVolumePrecision(chart, options.symbol)
      options.setFallbackTimer(window.setTimeout(() => {
        if (options.shouldIgnore()) return
        resetYAxisAutoScale(chart)
        scheduleResetYAxisAutoScaleFlags(chart)
        applySessionBreakIndicator(chart, options.symbol, options.period)
        chart.scrollToRealTime(0)
        scheduleResetYAxisAutoScaleFlags(chart)
        options.setLoadState({
          error: false,
          loadedPeriod: options.period,
          loadedSymbol: options.symbol,
          loadingMore: false,
          loading: false,
          requestedRows: limit,
          rows: stripFuturePlaceholders(chart.getDataList()).length || data.length,
        })
      }, 0))
    })
    .catch((error: unknown) => {
      if (options.shouldIgnore()) return
      chartError('[StoreV5Datafeed] request page failed', error)
      applyNewDataWithFuturePlaceholders(chart, [], options.period, false)
      options.setLoadState({ error: true, loadingMore: false, loading: false, requestedRows: limit, rows: 0 })
    })
}

function loadInitialWindow(chart: Chart, options: LoadOptions & { requestedRows: number; totalRows?: number | null }) {
  chartInfo('[StoreV5Datafeed] request init start', { symbol: options.symbol, period: options.period, limit: options.requestedRows })
  loadStoreV5KLineData({ symbol: options.symbol, period: options.period, limit: options.requestedRows })
    .then((data) => {
      if (options.shouldIgnore()) return
      const hasMoreOlder = resolveHasMoreOlder({
        loadedRows: data.length,
        pageSize: options.requestedRows,
        receivedRows: data.length,
        totalRows: options.totalRows,
      })
      chartInfo('[StoreV5Datafeed] callback init done', { rows: data.length, hasMoreOlder })
      applyNewDataWithFuturePlaceholders(chart, data, options.period, hasMoreOlder)
      applyPriceVolumePrecision(chart, options.symbol)
      options.setFallbackTimer(window.setTimeout(() => {
        if (options.shouldIgnore()) return
        resetYAxisAutoScale(chart)
        scheduleResetYAxisAutoScaleFlags(chart)
        applySessionBreakIndicator(chart, options.symbol, options.period)
        restoreViewportAfterLoad(chart, options)
        scheduleResetYAxisAutoScaleFlags(chart)
        options.setLoadState({
          error: false,
          loadedPeriod: options.period,
          loadedSymbol: options.symbol,
          loadingMore: false,
          loading: false,
          requestedRows: options.requestedRows,
          rows: stripFuturePlaceholders(chart.getDataList()).length || data.length,
        })
      }, 0))
    })
    .catch(() => {
      if (options.shouldIgnore()) return
      applyNewDataWithFuturePlaceholders(chart, [], options.period, false)
      options.setLoadState({ error: true, loadingMore: false, loading: false, requestedRows: options.requestedRows, rows: 0 })
    })
}
