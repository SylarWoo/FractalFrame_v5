import { useEffect, useRef, useState } from 'react'
import { ActionType, dispose, init } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import './ChartCoreHost.css'

type ChartCoreHostProps = {
  limit?: number
  period: string
  symbol: string
}

export function ChartCoreHost({ limit, period, symbol }: ChartCoreHostProps) {
  const chartInstanceRef = useRef<Chart | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const requestSeqRef = useRef(0)
  const [loadState, setLoadState] = useState({
    error: false,
    loading: false,
    requestedRows: limit ?? 0,
    rows: 0,
  })

  useEffect(() => {
    if (!chartRef.current) return

    const container = chartRef.current
    const chart = init(container, {
      timezone: 'Asia/Shanghai',
      styles: {
        grid: {
          horizontal: {
            color: '#eef2f7',
            dashedValue: [2, 2],
            show: true,
            size: 1,
          },
          vertical: {
            color: '#eef2f7',
            dashedValue: [2, 2],
            show: true,
            size: 1,
          },
        },
      },
    })

    chart?.setPriceVolumePrecision(3, 0)
    chartInstanceRef.current = chart ?? null

    const resize = () => {
      chart?.resize()
    }

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(resize)
    })

    resizeObserver.observe(container)
    window.addEventListener('resize', resize)
    window.requestAnimationFrame(resize)

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
    let disposed = false
    const chart = chartInstanceRef.current
    const requestSeq = requestSeqRef.current + 1
    const requestedRows = limit ?? 1000
    let fallbackTimer: number | undefined
    requestSeqRef.current = requestSeq

    if (!chart) return

    const finishLoaded = () => {
      if (disposed || requestSeqRef.current !== requestSeq) return

      setLoadState({
        error: false,
        loading: false,
        requestedRows,
        rows: chart.getDataList().length,
      })
    }

    chart.unsubscribeAction(ActionType.OnDataReady)
    chart.subscribeAction(ActionType.OnDataReady, finishLoaded)

    setLoadState({
      error: false,
      loading: true,
      requestedRows,
      rows: 0,
    })

    loadStoreV5KLineData({ symbol, period, limit: requestedRows })
      .then((data) => {
        if (disposed || requestSeqRef.current !== requestSeq) return

        chart.applyNewData(data, true)
        fallbackTimer = window.setTimeout(() => {
          if (disposed || requestSeqRef.current !== requestSeq) return

          setLoadState({
            error: false,
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
          loading: false,
          requestedRows,
          rows: 0,
        })
      })

    return () => {
      disposed = true
      chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer)
      }
    }
  }, [limit, period, symbol])

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div className="ff-chart-core-host__meta">
        <span>{symbol}</span>
        <span>{period}</span>
        <span>
          {loadState.loading
            ? `加载中 ${loadState.requestedRows.toLocaleString()}`
            : loadState.error
              ? '加载失败'
              : `已进图 ${loadState.rows.toLocaleString()} / 本地 ${loadState.requestedRows.toLocaleString()}`}
        </span>
      </div>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
    </section>
  )
}
