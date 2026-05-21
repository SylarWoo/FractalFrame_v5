import { useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { ActionType, LoadDataType } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { chartError, chartInfo } from './chartLogger'
import { resolvePeriodSeconds } from './chartTimeFormatting'
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
import { scheduleUnlockYAxisManualDrag } from './chartAxisInteraction'

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
  period: string
  reloadId?: number
  symbol: string
  totalRows?: number | null
}

export function useChartDataLoad({
  chartInstanceRef,
  jump,
  limit,
  period,
  reloadId,
  symbol,
  totalRows,
}: UseChartDataLoadOptions) {
  const requestSeqRef = useRef(0)
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
        rows: chart.getDataList().length,
      })
    }

    chart.unsubscribeAction(ActionType.OnDataReady)
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
      if (shouldIgnore() || type !== LoadDataType.Forward || !data) {
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
          const loadedRows = chart.getDataList().length + olderData.length
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
              rows: chart.getDataList().length,
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
            rows: chart.getDataList().length,
          }))
        })
    })

    const setFallbackTimer = (timer: number) => { fallbackTimer = timer }
    if (jump?.timestamp != null) {
      loadJumpWindow(chart, { jumpTimestamp: jump.timestamp, period, setFallbackTimer, setLoadState, shouldIgnore, symbol })
    } else {
      loadInitialWindow(chart, { period, requestedRows, setFallbackTimer, setLoadState, shouldIgnore, symbol, totalRows })
    }

    return () => {
      disposed = true
      chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
      chart.setLoadDataCallback(({ callback }) => callback([], false))
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
    }
  }, [chartInstanceRef, jump?.id, jump?.timestamp, limit, period, reloadId, symbol, totalRows])

  return { loadState, setLoadState }
}

type LoadOptions = {
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
      chart.applyNewData(data, hasMoreOlder)
      applyPriceVolumePrecision(chart, options.symbol)
      options.setFallbackTimer(window.setTimeout(() => {
        if (options.shouldIgnore()) return
        resetYAxisAutoScale(chart)
        scrollJumpTargetIntoView(chart, options.jumpTimestamp)
        applySessionBreakIndicator(chart, options.symbol, options.period)
        scheduleUnlockYAxisManualDrag(chart)
        window.setTimeout(() => {
          if (options.shouldIgnore()) return
          resetYAxisAutoScale(chart)
          scrollJumpTargetIntoView(chart, options.jumpTimestamp)
          applySessionBreakIndicator(chart, options.symbol, options.period)
          scheduleUnlockYAxisManualDrag(chart)
        }, 0)
          options.setLoadState({
            error: false,
            loadedPeriod: options.period,
            loadedSymbol: options.symbol,
            loadingMore: false,
            loading: false,
          requestedRows: jumpDisplayWindowBars,
          rows: chart.getDataList().length || data.length,
        })
      }, 0))
    })
    .catch((error: unknown) => {
      if (options.shouldIgnore()) return
      chartError('[StoreV5Datafeed] request jump failed', error)
      chart.applyNewData([], false)
      options.setLoadState({ error: true, loadingMore: false, loading: false, requestedRows: jumpDisplayWindowBars, rows: 0 })
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
      chart.applyNewData(data, hasMoreOlder)
      applyPriceVolumePrecision(chart, options.symbol)
      options.setFallbackTimer(window.setTimeout(() => {
        if (options.shouldIgnore()) return
        resetYAxisAutoScale(chart)
        applySessionBreakIndicator(chart, options.symbol, options.period)
        scheduleUnlockYAxisManualDrag(chart)
        options.setLoadState({
          error: false,
          loadedPeriod: options.period,
          loadedSymbol: options.symbol,
          loadingMore: false,
          loading: false,
          requestedRows: options.requestedRows,
          rows: chart.getDataList().length || data.length,
        })
      }, 0))
    })
    .catch(() => {
      if (options.shouldIgnore()) return
      chart.applyNewData([], false)
      options.setLoadState({ error: true, loadingMore: false, loading: false, requestedRows: options.requestedRows, rows: 0 })
    })
}
