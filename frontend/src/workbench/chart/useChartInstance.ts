import { useEffect, useRef } from 'react'
import { dispose, init } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { settingsSymbolChangedEvent } from '../settingsSymbolState'
import { realtimeEnabledChangedEvent } from '../mt5DataCenter/storeV5Persistence'
import { marketStatusTitleChangedEvent } from '../mt5DataCenter/marketStatusTitleState'
import { formatChartDate, readChartTimezone } from './chartTimeFormatting'
import { readRightPlaceholderVisible, refreshChartFuturePlaceholders } from './chartFuturePlaceholders'
import { chartDrawingVisibilityRefreshEvent, installChartDrawingTools } from './chartDrawingTools'
import { installChartMouseBehaviorOverrides } from './chartMouseBehaviorOverrides'
import { domPaneTitleOverlayEnabled } from './paneTitleOverlayConfig'
import { installPaneTitleOverlay } from './paneTitleOverlayManager'
import { applySessionBreakIndicator } from './sessionBreakIndicator'
import { installChartViewportPersistence } from './chartViewportPersistence'
import {
  applyAxisLineStyle,
  applyAxisTextStyle,
  applyCandleBarStyle,
  applyCandleTooltipStyle,
  applyCrosshairLineStyle,
  applyGridStyle,
  applyIndicatorTooltipStyle,
  applyLastPriceLineStyle,
  applyPaneSeparatorStyle,
  applyPriceVolumePrecision,
  createChartBaseStyles,
} from './chartStyleAppliers'
import { installYAxisDragOptimization } from './chartAxisInteraction'

type UseChartInstanceOptions = {
  displayName?: string
  period: string
  symbol: string
}

function applyChartStyles(chart: Chart, symbol: string, period: string, displayName?: string) {
  chart.setTimezone(readChartTimezone())
  chart.setCustomApi({ formatDate: formatChartDate })
  applyPriceVolumePrecision(chart, symbol)
  applyGridStyle(chart)
  applyPaneSeparatorStyle(chart)
  applyIndicatorTooltipStyle(chart)
  applyCrosshairLineStyle(chart)
  applyAxisTextStyle(chart)
  applyAxisLineStyle(chart)
  applyCandleBarStyle(chart)
  applyCandleTooltipStyle(chart, symbol, period, displayName)
  applyLastPriceLineStyle(chart, symbol)
  applySessionBreakIndicator(chart, symbol, period)
}

export function useChartInstance({ displayName, period, symbol }: UseChartInstanceOptions) {
  const chartInstanceRef = useRef<Chart | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartContextRef = useRef({ period, symbol })
  const paneTitleOverlayRef = useRef<ReturnType<typeof installPaneTitleOverlay> | null>(null)

  useEffect(() => {
    chartContextRef.current = { period, symbol }
    window.dispatchEvent(new Event(chartDrawingVisibilityRefreshEvent))
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event(chartDrawingVisibilityRefreshEvent))
    })
  }, [period, symbol])

  useEffect(() => {
    if (!chartRef.current) return

    const container = chartRef.current
    const chart = init(container, {
      customApi: { formatDate: formatChartDate },
      timezone: readChartTimezone(),
      styles: createChartBaseStyles(),
    })

    chartInstanceRef.current = chart ?? null

    let resizeFrameId = 0
    const resize = () => {
      resizeFrameId = 0
      chart?.resize()
    }
    const scheduleResize = () => {
      if (resizeFrameId !== 0) return
      resizeFrameId = window.requestAnimationFrame(resize)
    }
    const resizeObserver = new ResizeObserver(() => {
      scheduleResize()
    })

    resizeObserver.observe(container)
    window.addEventListener('resize', scheduleResize)
    scheduleResize()
    let cleanupDrawingTools: (() => void) | null = null
    let cleanupMouseBehaviorOverrides: (() => void) | null = null
    let cleanupViewportPersistence: (() => void) | null = null
    let cleanupYAxisDragOptimization: (() => void) | null = null
    window.requestAnimationFrame(() => {
      if (chart) {
        cleanupYAxisDragOptimization = installYAxisDragOptimization(chart)
        cleanupMouseBehaviorOverrides = installChartMouseBehaviorOverrides(chart)
        cleanupDrawingTools = installChartDrawingTools(chart, () => chartContextRef.current.period)
        cleanupViewportPersistence = installChartViewportPersistence(chart, () => chartContextRef.current)
      }
    })
    if (chart && domPaneTitleOverlayEnabled) {
      paneTitleOverlayRef.current = installPaneTitleOverlay(chart, container, { period: '', symbol: '' })
    }

    return () => {
      paneTitleOverlayRef.current?.destroy()
      paneTitleOverlayRef.current = null
      cleanupViewportPersistence?.()
      cleanupDrawingTools?.()
      cleanupMouseBehaviorOverrides?.()
      cleanupYAxisDragOptimization?.()
      if (resizeFrameId !== 0) window.cancelAnimationFrame(resizeFrameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleResize)
      chartInstanceRef.current = null
      if (chart) dispose(chart)
    }
  }, [])

  useEffect(() => {
    paneTitleOverlayRef.current?.updateContext({ displayName, period, symbol })
    const apply = () => {
      const chart = chartInstanceRef.current
      if (chart) {
        applyChartStyles(chart, symbol, period, displayName)
        paneTitleOverlayRef.current?.update()
      }
    }
    apply()
    window.addEventListener(settingsSymbolChangedEvent, apply)
    window.addEventListener(realtimeEnabledChangedEvent, apply)
    window.addEventListener(marketStatusTitleChangedEvent, apply)
    window.addEventListener('storage', apply)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, apply)
      window.removeEventListener(realtimeEnabledChangedEvent, apply)
      window.removeEventListener(marketStatusTitleChangedEvent, apply)
      window.removeEventListener('storage', apply)
    }
  }, [displayName, period, symbol])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return
    applyCandleTooltipStyle(chart, symbol, period, displayName)
  }, [displayName, period, symbol])

  useEffect(() => {
    let previousVisible = readRightPlaceholderVisible()
    const refresh = () => {
      const nextVisible = readRightPlaceholderVisible()
      if (nextVisible === previousVisible) return
      previousVisible = nextVisible
      const chart = chartInstanceRef.current
      if (chart) refreshChartFuturePlaceholders(chart, period)
    }
    window.addEventListener(settingsSymbolChangedEvent, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [period])

  return { chartInstanceRef, chartRef }
}
