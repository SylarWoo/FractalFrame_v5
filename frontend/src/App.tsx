import { useEffect, useRef, useState } from 'react'
import { KLineChartPro } from '@klinecharts/pro'
import { TooltipIconPosition } from 'klinecharts'
import type { DeepPartial, Styles } from 'klinecharts'
import '@klinecharts/pro/dist/klinecharts-pro.css'
import './App.css'
import {
  createStaticMt5FullDatafeed,
  type StaticMt5FullDatafeedStats,
} from './datafeed/createStaticMt5FullDatafeed'

function createIndicatorTooltipIconStyles(color = '#76808F'): DeepPartial<Styles> {
  const baseIconStyle = {
    position: TooltipIconPosition.Middle,
    marginTop: 2,
    marginBottom: 0,
    paddingLeft: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    fontFamily: 'icomoon',
    size: 14,
    color,
    activeColor: color,
    backgroundColor: 'transparent',
    activeBackgroundColor: 'rgba(22, 119, 255, 0.15)',
  }

  return {
    indicator: {
      tooltip: {
        icons: [
          {
            ...baseIconStyle,
            id: 'visible',
            icon: '\ue903',
            marginLeft: 8,
            marginRight: 0,
          },
          {
            ...baseIconStyle,
            id: 'invisible',
            icon: '\ue901',
            marginLeft: 8,
            marginRight: 0,
          },
          {
            ...baseIconStyle,
            id: 'setting',
            icon: '\ue902',
            marginLeft: 6,
            marginRight: 0,
          },
          {
            ...baseIconStyle,
            id: 'close',
            icon: '\ue900',
            marginLeft: 6,
            marginRight: 0,
          },
        ],
      },
    },
  }
}

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [stats, setStats] = useState<StaticMt5FullDatafeedStats>({
    bars: 0,
    loadTimeMs: null,
    renderReadyTimeMs: null,
    dataFile: '/data/mt5_m1_full.json',
    status: 'idle',
  })

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const chartStartTime = performance.now()
    let disposed = false
    container.innerHTML = ''

    const chart = new KLineChartPro({
      container,
      symbol: {
        exchange: 'MT5',
        market: 'forex',
        name: 'XAUUSDm',
        shortName: 'XAUUSDm',
        ticker: 'XAUUSDm',
        priceCurrency: 'USD',
        type: 'forex',
      },
      period: {
        multiplier: 1,
        timespan: 'minute',
        text: '1m',
      },
      datafeed: createStaticMt5FullDatafeed({
        onStatsChange(nextStats) {
          if (disposed) return

          setStats((currentStats) => ({
            ...currentStats,
            ...nextStats,
          }))

          if (nextStats.status === 'ready') {
            window.requestAnimationFrame(() => {
              if (disposed) return

              setStats((currentStats) => ({
                ...currentStats,
                renderReadyTimeMs: Math.round(performance.now() - chartStartTime),
              }))
            })
          }
        },
      }),
    })

    chart.setStyles(createIndicatorTooltipIconStyles())
    window.setTimeout(() => {
      chart.setStyles(createIndicatorTooltipIconStyles())
    }, 0)

    return () => {
      disposed = true
      ;(chart as { destroy?: () => void }).destroy?.()
      container.innerHTML = ''
    }
  }, [])

  return (
    <div className="ff-v5-root">
      <div className="ff-v5-debug">
        <span>Symbol: XAUUSDm</span>
        <span>Period: M1</span>
        <span>Bars: {stats.bars.toLocaleString()}</span>
        <span>
          Load:{' '}
          {stats.loadTimeMs === null ? '-' : `${stats.loadTimeMs.toLocaleString()} ms`}
        </span>
        <span>
          Ready:{' '}
          {stats.renderReadyTimeMs === null
            ? '-'
            : `${stats.renderReadyTimeMs.toLocaleString()} ms`}
        </span>
        <span>Data: {stats.dataFile}</span>
        <span>Status: {stats.status}</span>
        {stats.error ? <span title={stats.error}>Error: {stats.error}</span> : null}
      </div>
      <div ref={containerRef} className="ff-v5-chart" />
    </div>
  )
}
