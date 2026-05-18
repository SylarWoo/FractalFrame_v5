import { useEffect, useRef } from 'react'
import { KLineChartPro } from '@klinecharts/pro'
import { TooltipIconPosition } from 'klinecharts'
import type { DeepPartial, Styles } from 'klinecharts'
import '@klinecharts/pro/dist/klinecharts-pro.css'
import './App.css'
import { createMockKLineChartProDatafeed } from './datafeed/createMockKLineChartProDatafeed'

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

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
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
        multiplier: 5,
        timespan: 'minute',
        text: '5m',
      },
      datafeed: createMockKLineChartProDatafeed(),
    })

    chart.setStyles(createIndicatorTooltipIconStyles())
    window.setTimeout(() => {
      chart.setStyles(createIndicatorTooltipIconStyles())
    }, 0)

    return () => {
      ;(chart as { destroy?: () => void }).destroy?.()
      container.innerHTML = ''
    }
  }, [])

  return (
    <div className="ff-v5-root">
      <div ref={containerRef} className="ff-v5-chart" />
    </div>
  )
}
