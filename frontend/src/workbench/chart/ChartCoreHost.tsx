import { useEffect, useRef, useState } from 'react'
import { ActionType, LoadDataType, dispose, init } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { repairStoreV5M1Gaps } from '../../services/mt5/mt5SymbolsApi'
import { settingsSymbolChangedEvent } from '../settingsSymbolState'
import { chartError, chartInfo, chartWarn } from './chartLogger'
import { formatChartDate, readChartTimezone, resolvePeriodSeconds } from './chartTimeFormatting'
import { applySessionBreakIndicator } from './sessionBreakIndicator'
import {
  historyPageSize,
  jumpWindowBars,
  mergeKLineData,
  realtimeTailRepairLookbackMinutes,
  realtimeTailRepairMaxGapMinutes,
  resolveHasMoreOlder,
  resolveInitialLimit,
} from './chartCoreDataUtils'
import {
  applyAxisLineStyle,
  applyAxisTextStyle,
  applyCandleBarStyle,
  applyCandleTooltipStyle,
  applyCrosshairLineStyle,
  applyGridStyle,
  applyLastPriceLineStyle,
  applyPriceVolumePrecision,
  createChartBaseStyles,
  resetYAxisAutoScale,
} from './chartStyleAppliers'
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

type Mt5RealtimeTickEventDetail = {
  ask?: number | null
  bid?: number | null
  last?: number | null
  symbol: string
  time?: number | null
  volume?: number | null
}

export function ChartCoreHost({ displayName, jump, limit, onLoadStateChange, period, reloadId, stepLoad, symbol, totalRows }: ChartCoreHostProps) {
  const chartInstanceRef = useRef<Chart | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const requestSeqRef = useRef(0)
  const realtimeTailRefreshInFlightRef = useRef(false)
  const realtimeTailRefreshBucketRef = useRef<number | null>(null)
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

  useEffect(() => {
    if (!chartRef.current) return

    const container = chartRef.current
    const chart = init(container, {
      customApi: {
        formatDate: formatChartDate,
      },
      timezone: readChartTimezone(),
      styles: createChartBaseStyles(),
    })

    if (chart) {
      applyPriceVolumePrecision(chart)
      applyGridStyle(chart)
      applyCrosshairLineStyle(chart)
      applyAxisTextStyle(chart)
      applyAxisLineStyle(chart)
      applyCandleBarStyle(chart)
      applyLastPriceLineStyle(chart)
      applySessionBreakIndicator(chart, symbol, period)
    }
    chartInstanceRef.current = chart ?? null

    const resize = () => {
      chart?.resize()
    }

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(resize)
    })

    resizeObserver.observe(container)
    window.addEventListener('resize', resize)
    window.requestAnimationFrame(() => {
      resize()
    })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
      chartInstanceRef.current = null

      if (chart) {
        dispose(chart)
      }
    }
  }, [])

  useEffect(() => {
    const apply = () => {
      const chart = chartInstanceRef.current
        if (chart) {
          chart.setTimezone(readChartTimezone())
          chart.setCustomApi({ formatDate: formatChartDate })
          applyPriceVolumePrecision(chart)
          applyGridStyle(chart)
          applyCrosshairLineStyle(chart)
          applyAxisTextStyle(chart)
          applyAxisLineStyle(chart)
          applyCandleTooltipStyle(chart, symbol, period, displayName)
          applyLastPriceLineStyle(chart)
          applySessionBreakIndicator(chart, symbol, period)
        }
      }
    apply()
    window.addEventListener(settingsSymbolChangedEvent, apply)
    window.addEventListener('storage', apply)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, apply)
      window.removeEventListener('storage', apply)
    }
  }, [displayName, period, symbol])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    applyCandleTooltipStyle(chart, symbol, period, displayName)
  }, [displayName, period, symbol])

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
  }, [jump?.id, jump?.timestamp, limit, period, reloadId, symbol, totalRows])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    realtimeTailRefreshInFlightRef.current = false
    realtimeTailRefreshBucketRef.current = null

    const refreshRealtimeTail = async (bucketTimestamp: number) => {
      if (period.trim().toUpperCase() !== '1M' && period.trim().toUpperCase() !== 'M1') return
      if (realtimeTailRefreshInFlightRef.current) return

      realtimeTailRefreshInFlightRef.current = true
      try {
        await repairStoreV5M1Gaps(symbol, {
          lookbackMinutes: realtimeTailRepairLookbackMinutes,
          maxGapMinutes: realtimeTailRepairMaxGapMinutes,
        })

        const timeTo = Math.floor(bucketTimestamp / 1000) + 60
        const timeFrom = timeTo - realtimeTailRepairLookbackMinutes * 60
        const tailData = await loadStoreV5KLineData({
          symbol,
          period,
          limit: realtimeTailRepairLookbackMinutes + 5,
          timeFrom,
          timeTo,
        })
        if (!tailData.length) return

        const currentData = chart.getDataList()
        const merged = mergeKLineData(currentData, tailData)
        const hasMoreOlder = typeof totalRows === 'number' && Number.isFinite(totalRows)
          ? merged.length < totalRows
          : currentData.length >= historyPageSize
        chart.applyNewData(merged, hasMoreOlder)
      } catch (error) {
        chartWarn('[StoreV5Datafeed] realtime tail refresh failed', error)
      } finally {
        realtimeTailRefreshInFlightRef.current = false
      }
    }

    const handleRealtimeTick = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as Partial<Mt5RealtimeTickEventDetail> : null
      if (!detail || detail.symbol !== symbol) return

      const last = typeof detail.last === 'number' && Number.isFinite(detail.last)
        ? detail.last
        : typeof detail.bid === 'number' && typeof detail.ask === 'number'
          ? (detail.bid + detail.ask) / 2
          : detail.bid ?? detail.ask
      if (typeof last !== 'number' || !Number.isFinite(last)) return

      const tickSeconds = typeof detail.time === 'number' && Number.isFinite(detail.time)
        ? Math.floor(detail.time)
        : Math.floor(Date.now() / 1000)
      const periodSeconds = resolvePeriodSeconds(period)
      const bucketTimestamp = Math.floor(tickSeconds / periodSeconds) * periodSeconds * 1000
      const currentData = chart.getDataList()
      const latest = currentData[currentData.length - 1]
      const volume = typeof detail.volume === 'number' && Number.isFinite(detail.volume) ? detail.volume : 0

      if (!latest || bucketTimestamp > latest.timestamp) {
        if (realtimeTailRefreshBucketRef.current !== bucketTimestamp) {
          realtimeTailRefreshBucketRef.current = bucketTimestamp
          void refreshRealtimeTail(bucketTimestamp)
        }
          chart.updateData({
            timestamp: bucketTimestamp,
            open: latest?.close ?? last,
            high: last,
            low: last,
            close: last,
            volume,
          })
          return
        }

        if (bucketTimestamp === latest.timestamp) {
          chart.updateData({
          ...latest,
          high: Math.max(Number(latest.high), last),
          low: Math.min(Number(latest.low), last),
            close: last,
            volume: Math.max(Number(latest.volume ?? 0), volume),
          })
        }
      }

    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    return () => window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
  }, [period, symbol, totalRows])

  useEffect(() => {
    if (!stepLoad) return

    const chart = chartInstanceRef.current
    if (!chart) return

    let disposed = false
    const currentData = chart.getDataList()
    if (!currentData.length) return

    setLoadState((current) => ({
      ...current,
      error: false,
      loadingMore: true,
    }))

    const oldest = currentData[0]
    const newest = currentData[currentData.length - 1]
    const options = stepLoad.direction === 'left'
      ? {
          limit: historyPageSize,
          period,
          symbol,
          timeTo: Math.floor(oldest.timestamp / 1000) - 1,
        }
      : {
          limit: historyPageSize,
          period,
          symbol,
          timeFrom: Math.floor(newest.timestamp / 1000) + 1,
        }

    chartInfo('[StoreV5Datafeed] request manual step start', {
      direction: stepLoad.direction,
      ...options,
    })

    loadStoreV5KLineData(options)
      .then((data) => {
        if (disposed) return

        const merged = stepLoad.direction === 'left'
          ? mergeKLineData(data, chart.getDataList())
          : mergeKLineData(chart.getDataList(), data)
        const hasMoreOlder = resolveHasMoreOlder({
          loadedRows: merged.length,
          pageSize: historyPageSize,
          receivedRows: stepLoad.direction === 'left' ? data.length : historyPageSize,
          totalRows,
        })

        chartInfo('[StoreV5Datafeed] callback manual step done', {
          direction: stepLoad.direction,
          rows: data.length,
          mergedRows: merged.length,
        })
        const targetTimestamp = stepLoad.direction === 'left'
          ? data[Math.floor(data.length / 2)]?.timestamp
          : data[Math.max(0, data.length - Math.floor(data.length / 2) - 1)]?.timestamp
        chart.applyNewData(merged, hasMoreOlder)
        window.setTimeout(() => {
          if (disposed) return
          resetYAxisAutoScale(chart)
          applySessionBreakIndicator(chart, symbol, period)
          if (typeof targetTimestamp === 'number') {
            chart.scrollToTimestamp(targetTimestamp, 0)
          }
          setLoadState((current) => ({
            ...current,
            error: false,
            loading: false,
            loadingMore: false,
            requestedRows: current.requestedRows,
            rows: chart.getDataList().length || merged.length,
          }))
        }, 0)
      })
      .catch((error: unknown) => {
        if (disposed) return

        chartError('[StoreV5Datafeed] request manual step failed', error)
        setLoadState((current) => ({
          ...current,
          error: true,
          loading: false,
          loadingMore: false,
          rows: chart.getDataList().length,
        }))
      })

    return () => {
      disposed = true
    }
  }, [period, stepLoad, symbol, totalRows])

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
    </section>
  )
}




