import { useEffect, useRef } from 'react'
import { dispose, init } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import './ChartCoreHost.css'

type ChartCoreHostProps = {
  period: string
  symbol: string
}

export function ChartCoreHost({ period, symbol }: ChartCoreHostProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)

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
    let disposed = false
    loadStoreV5KLineData({ symbol, period, limit: 1000 })
      .then((data) => {
        if (!disposed) chart?.applyNewData(data, true)
      })
      .catch(() => {
        if (!disposed) chart?.applyNewData([], true)
      })

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
      disposed = true
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)

      if (chart) {
        dispose(chart)
      }
    }
  }, [period, symbol])

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div className="ff-chart-core-host__meta">
        <span>{symbol}</span>
        <span>{period}</span>
        <span>KLineCharts Core</span>
      </div>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
    </section>
  )
}
