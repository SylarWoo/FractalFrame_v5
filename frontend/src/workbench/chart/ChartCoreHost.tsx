import { useEffect, useRef, useState } from 'react'
import { ActionType, LoadDataType } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { chartError, chartInfo } from './chartLogger'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { applySessionBreakIndicator } from './sessionBreakIndicator'
import {
  historyPageSize,
  jumpWindowBars,
  resolveHasMoreOlder,
  resolveInitialLimit,
} from './chartCoreDataUtils'
import { resetYAxisAutoScale } from './chartStyleAppliers'
import { useChartInstance } from './useChartInstance'
import { useChartRealtimeTicks } from './useChartRealtimeTicks'
import { useChartStepLoad } from './useChartStepLoad'
import './ChartCoreHost.css'

type ChartCoreHostProps = {
  displayName?: string
  jump?: { id: number; timestamp?: number } | null
  limit?: number
  onLoadStateChange?: (state: ChartLoadState) => void
  period: string
  reloadId?: number
  stepLoad?: { direction: 'left' | 'right'; id: number } | null
  symbol: string
  totalRows?: number | null
}

export type ChartLoadState = {
  error: boolean
  loading: boolean
  loadingMore: boolean
  period: string
  requestedRows: number
  rows: number
  symbol: string
  totalRows?: number | null
}

export function ChartCoreHost({ displayName, jump, limit, onLoadStateChange, period, reloadId, stepLoad, symbol, totalRows }: ChartCoreHostProps) {
  const { chartInstanceRef, chartRef } = useChartInstance({ displayName, period, symbol })
  const requestSeqRef = useRef(0)
  const [loadState, setLoadState] = useState({
    error: false,
    loadingMore: false,
    loading: false,
    requestedRows: resolveInitialLimit(limit),
    rows: 0,
  })

  useEffect(() => {
    onLoadStateChange?.({
      ...loadState,
      period,
      symbol,
      totalRows,
    })
  }, [loadState, onLoadStateChange, period, symbol, totalRows])

  useChartRealtimeTicks({ chartInstanceRef, period, symbol, totalRows })
  useChartStepLoad({ chartInstanceRef, period, setLoadState, stepLoad: stepLoad ?? null, symbol, totalRows })

  useEffect(() => {
    let disposed = false
    const chart = chartInstanceRef.current
    const requestSeq = requestSeqRef.current + 1
    const requestedRows = resolveInitialLimit(limit)
    let fallbackTimer: number | undefined
    requestSeqRef.current = requestSeq

    if (!chart) return

    const finishLoaded = () => {
      if (disposed || requestSeqRef.current !== requestSeq) return

        setLoadState({
          error: false,
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
      loadingMore: false,
      loading: true,
      requestedRows,
      rows: 0,
    })

    chart.setLoadDataCallback(({ type, data, callback }) => {
      if (disposed || requestSeqRef.current !== requestSeq) {
        callback([], false)
        return
      }

      if (type !== LoadDataType.Forward || !data) {
        callback([], false)
        return
      }

      setLoadState((current) => ({
        ...current,
        error: false,
        loadingMore: true,
      }))

      const timeTo = Math.floor(data.timestamp / 1000) - 1
      chartInfo('[StoreV5Datafeed] request older start', {
        symbol,
        period,
        limit: historyPageSize,
        timeTo,
      })

      loadStoreV5KLineData({ symbol, period, limit: historyPageSize, timeTo })
        .then((olderData) => {
          if (disposed || requestSeqRef.current !== requestSeq) {
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

          chartInfo('[StoreV5Datafeed] callback older done', {
            rows: olderData.length,
            hasMoreOlder,
          })
          callback(olderData, hasMoreOlder)

          window.setTimeout(() => {
            if (disposed || requestSeqRef.current !== requestSeq) return
            applySessionBreakIndicator(chart, symbol, period)
            setLoadState({
              error: false,
              loading: false,
              loadingMore: false,
              requestedRows,
              rows: chart.getDataList().length,
            })
          }, 0)
        })
        .catch((error: unknown) => {
          if (disposed || requestSeqRef.current !== requestSeq) {
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

    if (jump?.timestamp != null) {
      const periodSeconds = resolvePeriodSeconds(period)
      const halfWindowSeconds = Math.floor(jumpWindowBars / 2) * periodSeconds
      const targetSeconds = Math.floor(jump.timestamp / 1000)
      const timeFrom = targetSeconds - halfWindowSeconds
      const timeTo = targetSeconds + halfWindowSeconds

      chartInfo('[StoreV5Datafeed] request jump start', {
        symbol,
        period,
        limit: jumpWindowBars,
        timeFrom,
        timeTo,
      })

      loadStoreV5KLineData({ symbol, period, limit: jumpWindowBars, timeFrom, timeTo })
        .then((data) => {
          if (disposed || requestSeqRef.current !== requestSeq) return

          const hasMoreOlder = data.length >= jumpWindowBars
          chartInfo('[StoreV5Datafeed] callback jump done', {
            rows: data.length,
            target: jump.timestamp,
            hasMoreOlder,
          })
          chart.applyNewData(data, hasMoreOlder)
          fallbackTimer = window.setTimeout(() => {
            if (disposed || requestSeqRef.current !== requestSeq) return
            resetYAxisAutoScale(chart)
            chart.scrollToTimestamp(jump.timestamp as number, 0)
            applySessionBreakIndicator(chart, symbol, period)
            window.setTimeout(() => {
              if (disposed || requestSeqRef.current !== requestSeq) return
              resetYAxisAutoScale(chart)
              applySessionBreakIndicator(chart, symbol, period)
            }, 0)
            setLoadState({
              error: false,
              loadingMore: false,
              loading: false,
              requestedRows: jumpWindowBars,
              rows: chart.getDataList().length || data.length,
            })
          }, 0)
        })
        .catch((error: unknown) => {
          if (disposed || requestSeqRef.current !== requestSeq) return

          chartError('[StoreV5Datafeed] request jump failed', error)
          chart.applyNewData([], false)
          setLoadState({
            error: true,
            loadingMore: false,
            loading: false,
            requestedRows: jumpWindowBars,
            rows: 0,
          })
        })

      return () => {
        disposed = true
        chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
        chart.setLoadDataCallback(({ callback }) => callback([], false))
        if (fallbackTimer !== undefined) {
          window.clearTimeout(fallbackTimer)
        }
      }
    }

    chartInfo('[StoreV5Datafeed] request init start', {
      symbol,
      period,
      limit: requestedRows,
    })

    loadStoreV5KLineData({ symbol, period, limit: requestedRows })
      .then((data) => {
        if (disposed || requestSeqRef.current !== requestSeq) return

        const hasMoreOlder = resolveHasMoreOlder({
          loadedRows: data.length,
          pageSize: requestedRows,
          receivedRows: data.length,
          totalRows,
        })
        chartInfo('[StoreV5Datafeed] callback init done', {
          rows: data.length,
          hasMoreOlder,
        })
        chart.applyNewData(data, hasMoreOlder)
        fallbackTimer = window.setTimeout(() => {
          if (disposed || requestSeqRef.current !== requestSeq) return
          resetYAxisAutoScale(chart)
          applySessionBreakIndicator(chart, symbol, period)

          setLoadState({
            error: false,
            loadingMore: false,
            loading: false,
            requestedRows,
            rows: chart.getDataList().length || data.length,
          })
        }, 0)
      })
      .catch(() => {
        if (disposed || requestSeqRef.current !== requestSeq) return

        chart.applyNewData([], false)
        setLoadState({
          error: true,
          loadingMore: false,
          loading: false,
          requestedRows,
          rows: 0,
        })
      })

    return () => {
      disposed = true
      chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
      chart.setLoadDataCallback(({ callback }) => callback([], false))
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer)
      }
    }
  }, [chartInstanceRef, jump?.id, jump?.timestamp, limit, period, reloadId, symbol, totalRows])

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
    </section>
  )
}




