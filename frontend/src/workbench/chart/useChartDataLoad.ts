import { useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { ActionType } from 'klinecharts'
import type { Chart, KLineData } from 'klinecharts'
import { loadStoreV6KLineData } from '../../datafeed/storeV6KLineDatafeed'
import { chartError, chartInfo } from './chartLogger'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'
import { applySessionBreakIndicator } from './sessionBreakIndicator'
import {
  jumpBarSpace,
  jumpDisplayWindowBars,
  mergeKLineData,
  resolveHasMoreOlder,
} from './chartCoreDataUtils'
import { applyPriceVolumePrecision } from './chartStyleAppliers'
import { scheduleResetYAxisAutoScaleFlags } from './chartAxisInteraction'
import {
  captureChartViewportSnapshot,
  markChartViewportPersistenceReady,
  restoreChartViewportState,
  restoreChartViewportSnapshot,
  type ChartViewportSnapshot,
} from './chartViewportPersistence'
import type { ChartPageTarget } from './ChartCoreHost'
import { preparePageDataPackage } from './pageData/pageDataManager'
import { writePageDataPackage } from './pageData/pageDataCache'
import { pageDataPackageToSlice } from './pageData/pageDataSlice'
import { writePageCalculationContext } from './pageCalculationContext'
import { resolvePageLoadPlan } from './pageLoader/pageLoadPlanner'
import { applyChartPageWindow, clearChartPageWindow } from './chartAdapter/chartWindowAdapter'
import { createChartPageWindow } from './pageWindow/chartPageWindow'
import { createHistoryPageWindow } from './pageWindow/historyPageWindow'
import { createRealtimePageWindow } from './pageWindow/realtimePageWindow'
import { readRealtimePageBuffer, writeRealtimePageBuffer } from './realtimePageBuffer'

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
  lookaheadRows?: number
  page?: ChartPageTarget | null
  period: string
  reloadId?: number
  symbol: string
  totalRows?: number | null
  viewportScope?: string
  warmupRows?: number
}

export function useChartDataLoad({
  chartInstanceRef,
  jump,
  limit,
  lookaheadRows,
  page,
  period,
  reloadId,
  symbol,
  totalRows,
  viewportScope = 'default',
  warmupRows,
}: UseChartDataLoadOptions) {
  const requestSeqRef = useRef(0)
  const previousContextRef = useRef<{ period: string; symbol: string } | null>(null)
  const [loadState, setLoadState] = useState<ChartLoadStateCore>({
    error: false,
    loadedPeriod: '',
    loadedSymbol: '',
    loadingMore: false,
    loading: false,
    requestedRows: resolvePageLoadPlan({ jump, limit, page }).requestedRows,
    rows: 0,
  })

  useEffect(() => {
    let disposed = false
    const chart = chartInstanceRef.current
    const requestSeq = requestSeqRef.current + 1
    const loadPlan = resolvePageLoadPlan({ jump, limit, page })
    const requestedRows = loadPlan.requestedRows
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

    chart.setLoadDataCallback(({ callback }) => callback([], false))

    const setFallbackTimer = (timer: number) => { fallbackTimer = timer }
    if (loadPlan.mode === 'history' && loadPlan.page) {
      loadPagedWindow(chart, { inheritedViewport, lookaheadRows, page: loadPlan.page, period, setFallbackTimer, setLoadState, shouldIgnore, symbol, viewportScope, warmupRows })
    } else if (loadPlan.mode === 'jump' && jump?.timestamp != null) {
      loadJumpWindow(chart, { inheritedViewport, jumpTimestamp: jump.timestamp, period, setFallbackTimer, setLoadState, shouldIgnore, symbol, viewportScope })
    } else {
      loadInitialWindow(chart, { followLatest: loadPlan.chartBehavior.followLatest, inheritedViewport, page: loadPlan.page, period, requestedRows, setFallbackTimer, setLoadState, shouldIgnore, symbol, totalRows, viewportScope })
    }

    return () => {
      disposed = true
      chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
      chart.setLoadDataCallback(({ callback }) => callback([], false))
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
    }
  }, [
    chartInstanceRef,
    jump?.id,
    jump?.timestamp,
    limit,
    lookaheadRows,
    page?.fromGlobalIndex,
    page?.index,
    page?.limit,
    page?.realtime,
    page?.rows,
    page?.timeFrom,
    page?.timeTo,
    page?.toGlobalIndex,
    period,
    reloadId,
    symbol,
    totalRows,
    viewportScope,
    warmupRows,
  ])

  return { loadState, setLoadState }
}

type LoadOptions = {
  followLatest?: boolean
  inheritedViewport?: ChartViewportSnapshot | null
  lookaheadRows?: number
  page?: ChartPageTarget | null
  period: string
  setFallbackTimer: (timer: number) => void
  setLoadState: Dispatch<SetStateAction<ChartLoadStateCore>>
  shouldIgnore: () => boolean
  symbol: string
  viewportScope: string
  warmupRows?: number
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

function restorePersistedViewport(chart: Chart, symbol: string, period: string, viewportScope: string) {
  restoreChartViewportState(chart, symbol, period, viewportScope)
  markChartViewportPersistenceReady(chart, symbol, period, viewportScope)
}

function restoreViewportAfterLoad(chart: Chart, options: LoadOptions) {
  if (options.inheritedViewport) {
    restoreChartViewportSnapshot(chart, options.inheritedViewport)
    markChartViewportPersistenceReady(chart, options.symbol, options.period, options.viewportScope)
    return
  }
  restorePersistedViewport(chart, options.symbol, options.period, options.viewportScope)
}

function loadJumpWindow(chart: Chart, options: LoadOptions & { jumpTimestamp: number }) {
  const periodSeconds = resolvePeriodSeconds(options.period)
  const backwardLimit = Math.floor(jumpDisplayWindowBars / 2)
  const forwardLimit = jumpDisplayWindowBars - backwardLimit
  const targetSeconds = Math.floor(options.jumpTimestamp / 1000)
  const backwardTimeTo = targetSeconds + periodSeconds
  const forwardTimeFrom = targetSeconds + periodSeconds + 1

  chartInfo('[StoreV6Datafeed] request jump start', {
    symbol: options.symbol,
    period: options.period,
    backwardLimit,
    backwardTimeTo,
    forwardLimit,
    forwardTimeFrom,
  })
  Promise.all([
    loadStoreV6KLineData({ symbol: options.symbol, period: options.period, limit: backwardLimit, timeTo: backwardTimeTo }),
    loadStoreV6KLineData({ symbol: options.symbol, period: options.period, limit: forwardLimit, timeFrom: forwardTimeFrom }),
  ])
    .then(([backwardData, forwardData]) => {
      if (options.shouldIgnore()) return
      const data = mergeKLineData(backwardData, forwardData)
      const hasMoreOlder = backwardData.length >= backwardLimit
      chartInfo('[StoreV6Datafeed] callback jump done', {
        backwardRows: backwardData.length,
        forwardRows: forwardData.length,
        rows: data.length,
        target: options.jumpTimestamp,
        hasMoreOlder,
      })
      applyChartPageWindow(chart, createHistoryPageWindow({
        rows: data,
        period: options.period,
        symbol: options.symbol,
      }), { hasMoreOlder })
      applyPriceVolumePrecision(chart, options.symbol)
      options.setFallbackTimer(window.setTimeout(() => {
        if (options.shouldIgnore()) return
        scheduleResetYAxisAutoScaleFlags(chart)
        scrollJumpTargetIntoView(chart, options.jumpTimestamp)
        applySessionBreakIndicator(chart, options.symbol, options.period)
        window.setTimeout(() => {
          if (options.shouldIgnore()) return
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
      chartError('[StoreV6Datafeed] request jump failed', error)
      clearChartPageWindow(chart, options.period)
      options.setLoadState({ error: true, loadingMore: false, loading: false, requestedRows: jumpDisplayWindowBars, rows: 0 })
    })
}

function loadPagedWindow(chart: Chart, options: LoadOptions & { page: ChartPageTarget }) {
  const limit = Math.max(1, Math.round(options.page.limit))
  const timeTo = typeof options.page.timeTo === 'number' && Number.isFinite(options.page.timeTo)
    ? options.page.timeTo
    : undefined
  chartInfo('[StoreV6Datafeed] request page start', {
    fromGlobalIndex: options.page.fromGlobalIndex,
    symbol: options.symbol,
    period: options.period,
    page: options.page.index,
    limit,
    timeTo,
    toGlobalIndex: options.page.toGlobalIndex,
  })
  preparePageDataPackage({
    fromGlobalIndex: options.page.fromGlobalIndex,
    lookaheadRows: options.lookaheadRows,
    pageIndex: options.page.index,
    period: options.period,
    realtime: options.page.realtime,
    rows: limit,
    symbol: options.symbol,
    timeFrom: options.page.timeFrom,
    timeTo,
    toGlobalIndex: options.page.toGlobalIndex,
    warmupRows: options.warmupRows,
  })
    .then((pagePackage) => {
      if (options.shouldIgnore()) return
      const data = pagePackage.displayRows
      chartInfo('[StoreV6Datafeed] callback page done', { rows: data.length, page: options.page.index })
      chartInfo('[StoreV6Datafeed] page data package ready', {
        calculationRows: pagePackage.calculationRows.length,
        displayOffset: pagePackage.displayOffset,
        displayRows: pagePackage.displayRows.length,
        lookaheadRows: pagePackage.lookaheadRows.length,
        page: pagePackage.pageIndex,
        warmupRows: pagePackage.warmupRows.length,
      })
      const pageWindow = createChartPageWindow(pageDataPackageToSlice(pagePackage))
      applyChartPageWindow(chart, pageWindow, { hasMoreOlder: false })
      applyPriceVolumePrecision(chart, options.symbol)
      options.setFallbackTimer(window.setTimeout(() => {
        if (options.shouldIgnore()) return
        scheduleResetYAxisAutoScaleFlags(chart)
        applySessionBreakIndicator(chart, options.symbol, options.period)
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
        writePageDataPackage(pagePackage)
      }, 0))
    })
    .catch((error: unknown) => {
      if (options.shouldIgnore()) return
      chartError('[StoreV6Datafeed] request page failed', error)
      clearChartPageWindow(chart, options.period)
      options.setLoadState({ error: true, loadingMore: false, loading: false, requestedRows: limit, rows: 0 })
    })
}

function loadInitialWindow(chart: Chart, options: LoadOptions & { requestedRows: number; totalRows?: number | null }) {
  chartInfo('[StoreV6Datafeed] request init start', { symbol: options.symbol, period: options.period, limit: options.requestedRows })
  const pageIndexFrom = typeof options.page?.fromGlobalIndex === 'number' && Number.isFinite(options.page.fromGlobalIndex)
    ? options.page.fromGlobalIndex
    : undefined
  const pageIndexTo = typeof options.page?.toGlobalIndex === 'number' && Number.isFinite(options.page.toGlobalIndex)
    ? options.page.toGlobalIndex
    : undefined
  const pageBoundedRealtime = options.followLatest && pageIndexFrom != null && pageIndexTo != null
  const bufferedRows = options.followLatest && !pageBoundedRealtime ? readRealtimePageBuffer(options.symbol, options.period) : []
  ;(pageBoundedRealtime
    ? loadStoreV6KLineData({ symbol: options.symbol, period: options.period, limit: options.requestedRows, indexFrom: pageIndexFrom, indexTo: pageIndexTo })
    : bufferedRows.length
    ? Promise.resolve(bufferedRows)
    : loadStoreV6KLineData({ symbol: options.symbol, period: options.period, limit: options.requestedRows }))
    .then((data) => {
      if (options.shouldIgnore()) return
      if (options.followLatest && (pageBoundedRealtime || !bufferedRows.length) && data.length) {
        writeRealtimePageBuffer(options.symbol, options.period, data)
      }
      const warmupLimit = Math.max(0, Math.round(options.warmupRows ?? 0))
      const warmupTimeTo = typeof data[0]?.timestamp === 'number'
        ? Math.floor(data[0].timestamp / 1000) - 1
        : null
      let realtimeWarmupRows: KLineData[] | null = null
      let realtimeDisplayReady = false
      let realtimeContextWritten = false
      const writeRealtimeCalculationContext = (warmupRows: KLineData[]) => {
        if (!options.followLatest || options.shouldIgnore() || data.length === 0) return
        writePageCalculationContext({
          calculationRows: mergeKLineData(warmupRows, data),
          displayRows: data,
          newerLookaheadRows: 0,
          olderWarmupRows: warmupRows.length,
          pageIndex: options.page?.index ?? 1,
          period: options.period,
          realtime: true,
          symbol: options.symbol,
        })
      }
      const maybeWriteRealtimeCalculationContext = () => {
        if (realtimeContextWritten || !realtimeDisplayReady || realtimeWarmupRows == null) return
        realtimeContextWritten = true
        writeRealtimeCalculationContext(realtimeWarmupRows)
      }
      if (options.followLatest && warmupLimit > 0 && warmupTimeTo != null) {
        loadStoreV6KLineData({
          symbol: options.symbol,
          period: options.period,
          limit: warmupLimit,
          timeTo: warmupTimeTo,
        })
          .then((warmupRows) => {
            realtimeWarmupRows = warmupRows
            maybeWriteRealtimeCalculationContext()
          })
          .catch(() => {
            realtimeWarmupRows = []
            maybeWriteRealtimeCalculationContext()
          })
      } else {
        realtimeContextWritten = true
      }
      const hasMoreOlder = options.followLatest ? false : resolveHasMoreOlder({
        loadedRows: data.length,
        pageSize: options.requestedRows,
        receivedRows: data.length,
        totalRows: options.totalRows,
      })
      chartInfo('[StoreV6Datafeed] callback init done', { rows: data.length, hasMoreOlder })
      applyChartPageWindow(chart, options.followLatest
        ? createRealtimePageWindow({
            rows: data,
            pageIndex: options.page?.index ?? 1,
            period: options.period,
            symbol: options.symbol,
          })
        : createHistoryPageWindow({
            rows: data,
            pageIndex: options.page?.index ?? 0,
            period: options.period,
            symbol: options.symbol,
          }), { hasMoreOlder })
      applyPriceVolumePrecision(chart, options.symbol)
      options.setFallbackTimer(window.setTimeout(() => {
        if (options.shouldIgnore()) return
        realtimeDisplayReady = true
        maybeWriteRealtimeCalculationContext()
        scheduleResetYAxisAutoScaleFlags(chart)
        applySessionBreakIndicator(chart, options.symbol, options.period)
        restoreViewportAfterLoad(chart, options)
        scheduleResetYAxisAutoScaleFlags(chart)
        options.setFallbackTimer(window.setTimeout(() => {
          if (options.shouldIgnore()) return
          options.setLoadState({
            error: false,
            loadedPeriod: options.period,
            loadedSymbol: options.symbol,
            loadingMore: false,
            loading: false,
            requestedRows: options.requestedRows,
            rows: stripFuturePlaceholders(chart.getDataList()).length || data.length,
          })
        }, 32))
      }, 0))
    })
    .catch(() => {
      if (options.shouldIgnore()) return
      clearChartPageWindow(chart, options.period)
      options.setLoadState({ error: true, loadingMore: false, loading: false, requestedRows: options.requestedRows, rows: 0 })
    })
}

