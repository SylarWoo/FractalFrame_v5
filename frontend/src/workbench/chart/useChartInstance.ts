import { useEffect, useRef } from 'react'
import { dispose, init } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { settingsSymbolChangedEvent } from '../settingsSymbolState'
import { formatChartDate, readChartTimezone } from './chartTimeFormatting'
import { applySessionBreakIndicator } from './sessionBreakIndicator'
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
} from './chartStyleAppliers'

type UseChartInstanceOptions = {
  displayName?: string
  period: string
  symbol: string
}

function applyChartStyles(chart: Chart, symbol: string, period: string, displayName?: string) {
  chart.setTimezone(readChartTimezone())
  chart.setCustomApi({ formatDate: formatChartDate })
  applyPriceVolumePrecision(chart)
  applyGridStyle(chart)
  applyCrosshairLineStyle(chart)
  applyAxisTextStyle(chart)
  applyAxisLineStyle(chart)
  applyCandleBarStyle(chart)
  applyCandleTooltipStyle(chart, symbol, period, displayName)
  applyLastPriceLineStyle(chart)
  applySessionBreakIndicator(chart, symbol, period)
}

export function useChartInstance({ displayName, period, symbol }: UseChartInstanceOptions) {
  const chartInstanceRef = useRef<Chart | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    const container = chartRef.current
    const chart = init(container, {
      customApi: { formatDate: formatChartDate },
      timezone: readChartTimezone(),
      styles: createChartBaseStyles(),
    })

    chartInstanceRef.current = chart ?? null

    const resize = () => chart?.resize()
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
      if (chart) dispose(chart)
    }
  }, [])

  useEffect(() => {
    const apply = () => {
      const chart = chartInstanceRef.current
      if (chart) applyChartStyles(chart, symbol, period, displayName)
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

  return { chartInstanceRef, chartRef }
}
