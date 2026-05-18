import { useEffect, useRef } from 'react'
import { dispose, init } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import './ChartCoreHost.css'

type ChartCoreHostProps = {
  period: string
  symbol: string
}

function createPreviewBars(count = 180): KLineData[] {
  const bars: KLineData[] = []
  const now = Date.now()
  const intervalMs = 60 * 1000
  let price = 4540

  for (let index = count - 1; index >= 0; index -= 1) {
    const timestamp = now - index * intervalMs
    const wave = Math.sin((count - index) / 12) * 1.8
    const drift = (Math.random() - 0.48) * 3
    const open = price
    const close = Math.max(1, open + drift + wave * 0.12)
    const high = Math.max(open, close) + Math.random() * 1.6
    const low = Math.min(open, close) - Math.random() * 1.6

    bars.push({
      timestamp,
      open: Number(open.toFixed(3)),
      high: Number(high.toFixed(3)),
      low: Number(low.toFixed(3)),
      close: Number(close.toFixed(3)),
      volume: Math.round(100 + Math.random() * 600),
    })

    price = close
  }

  return bars
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
    chart?.applyNewData(createPreviewBars(), true)

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

      if (chart) {
        dispose(chart)
      }
    }
  }, [])

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
