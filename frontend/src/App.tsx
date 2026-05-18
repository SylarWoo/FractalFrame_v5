import { useEffect, useRef } from 'react'
import { KLineChartPro, DefaultDatafeed } from '@klinecharts/pro'
import '@klinecharts/pro/dist/klinecharts-pro.css'
import './App.css'

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = new KLineChartPro({
      container: containerRef.current,
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
      datafeed: new DefaultDatafeed(''),
    })

    return () => {
      ;(chart as { destroy?: () => void }).destroy?.()
    }
  }, [])

  return (
    <div className="ff-v5-root">
      <div ref={containerRef} className="ff-v5-chart" />
    </div>
  )
}
