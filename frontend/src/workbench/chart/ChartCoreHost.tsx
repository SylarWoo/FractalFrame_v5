import { useEffect, useRef } from 'react'
import { ActionType } from 'klinecharts'
import { installChartDragCursor } from './chartDragCursor'
import { useChartDataLoad } from './useChartDataLoad'
import { useChartInstance } from './useChartInstance'
import { useChartRealtimeTicks } from './useChartRealtimeTicks'
import { useChartStepLoad } from './useChartStepLoad'
import { installRsiAxisDragSensitivity, uninstallRsiAxisDragSensitivity } from './rsiAxisDragSensitivity'
import { ensureMainVolumeLegendIndicator, installMainVolumeOverlay, mainVolumeIndicatorName } from './mainVolumeIndicator'
import { ensureTradingViewMaShiftIndicator } from './tradingViewMaShiftIndicator'
import { ensureTradingViewRsiIndicator } from './tradingViewRsiIndicator'
import type { MaIndicatorSettings, RsiIndicatorSettings, VolIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import './ChartCoreHost.css'

const rsiPaneId = 'rsi_pane'
const rsiPaneHeightStorageKey = 'fractalframe.chart.rsiPaneHeight'
const defaultRsiPaneHeight = 128
const minRsiPaneHeight = 80
const maxStoredRsiPaneHeight = 720
const updateLevelAll = 4

type ChartCoreHostProps = {
  displayName?: string
  indicatorCommand?: ChartIndicatorCommand | null
  jump?: { id: number; timestamp?: number } | null
  limit?: number
  onLoadStateChange?: (state: ChartLoadState) => void
  period: string
  reloadId?: number
  stepLoad?: { direction: 'left' | 'right'; id: number } | null
  symbol: string
  totalRows?: number | null
}

export type ChartIndicatorCommand = {
  action: 'load' | 'unload'
  id: number
} & (
  | { name: 'MA'; settings?: MaIndicatorSettings }
  | { name: 'RSI'; settings?: RsiIndicatorSettings }
  | { name: 'Vol'; settings?: VolIndicatorSettings }
)

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

function normalizeRsiPaneHeight(value: number) {
  return Math.max(minRsiPaneHeight, Math.min(Math.round(value), maxStoredRsiPaneHeight))
}

function readStoredRsiPaneHeight() {
  if (typeof window === 'undefined') return defaultRsiPaneHeight
  const stored = Number(window.localStorage.getItem(rsiPaneHeightStorageKey))
  return Number.isFinite(stored) ? normalizeRsiPaneHeight(stored) : defaultRsiPaneHeight
}

function writeStoredRsiPaneHeight(height: number) {
  if (typeof window === 'undefined' || !Number.isFinite(height)) return
  window.localStorage.setItem(rsiPaneHeightStorageKey, String(normalizeRsiPaneHeight(height)))
}

function refreshPane(chart: unknown, paneId: string) {
  const updatePane = (chart as { updatePane?: (level: number, paneId?: string) => void }).updatePane
  if (!updatePane) return
  window.requestAnimationFrame(() => {
    updatePane.call(chart, updateLevelAll, paneId)
  })
}

export function ChartCoreHost({ displayName, indicatorCommand, jump, limit, onLoadStateChange, period, reloadId, stepLoad, symbol, totalRows }: ChartCoreHostProps) {
  const { chartInstanceRef, chartRef } = useChartInstance({ displayName, period, symbol })
  const { loadState, setLoadState } = useChartDataLoad({ chartInstanceRef, jump, limit, period, reloadId, symbol, totalRows })
  const rsiPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const mainVolumeOverlayRef = useRef<ReturnType<typeof installMainVolumeOverlay> | null>(null)

  useEffect(() => {
    onLoadStateChange?.({ ...loadState, period, symbol, totalRows })
  }, [loadState, onLoadStateChange, period, symbol, totalRows])

  useChartRealtimeTicks({ chartInstanceRef, period, symbol, totalRows })
  useChartStepLoad({ chartInstanceRef, period, setLoadState, stepLoad: stepLoad ?? null, symbol, totalRows })

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    const persistRsiPaneHeight = () => {
      window.requestAnimationFrame(() => {
        const size = chart.getSize(rsiPaneId)
        if (size?.height) writeStoredRsiPaneHeight(size.height)
      })
    }

    chart.subscribeAction(ActionType.OnPaneDrag, persistRsiPaneHeight)
    return () => chart.unsubscribeAction(ActionType.OnPaneDrag, persistRsiPaneHeight)
  }, [chartInstanceRef])

  const observeRsiPaneHeight = () => {
    rsiPaneHeightObserverRef.current?.disconnect()
    rsiPaneHeightObserverRef.current = null

    const chart = chartInstanceRef.current
    if (!chart) return

    window.requestAnimationFrame(() => {
      const paneDom = chart.getDom(rsiPaneId)
      if (!paneDom) return

      const observer = new ResizeObserver(() => {
        const size = chart.getSize(rsiPaneId)
        if (size?.height) writeStoredRsiPaneHeight(size.height)
      })
      observer.observe(paneDom)
      rsiPaneHeightObserverRef.current = observer

      const size = chart.getSize(rsiPaneId)
      if (size?.height) writeStoredRsiPaneHeight(size.height)
    })
  }

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart || !indicatorCommand) return

    if (indicatorCommand.name === 'RSI') {
      ensureTradingViewRsiIndicator()

      if (indicatorCommand.action === 'load') {
        if (chart.getIndicatorByPaneId(rsiPaneId, 'RSI')) {
          chart.overrideIndicator({ name: 'RSI', calcParams: [indicatorCommand.settings] }, rsiPaneId, observeRsiPaneHeight)
          window.requestAnimationFrame(() => installRsiAxisDragSensitivity(chart))
          return
        }
        chart.createIndicator(
          { name: 'RSI', calcParams: [indicatorCommand.settings] },
          false,
          { id: rsiPaneId, height: readStoredRsiPaneHeight(), minHeight: minRsiPaneHeight },
          () => {
            observeRsiPaneHeight()
            installChartDragCursor(chart)
          },
        )
        window.requestAnimationFrame(() => installRsiAxisDragSensitivity(chart))
      } else {
        const size = chart.getSize(rsiPaneId)
        if (size?.height) writeStoredRsiPaneHeight(size.height)
        rsiPaneHeightObserverRef.current?.disconnect()
        rsiPaneHeightObserverRef.current = null
        chart.removeIndicator(rsiPaneId, 'RSI')
        window.requestAnimationFrame(() => installRsiAxisDragSensitivity(chart))
      }
    }

    if (indicatorCommand.name === 'MA') {
      ensureTradingViewMaShiftIndicator()

      if (indicatorCommand.action === 'load') {
        if (chart.getIndicatorByPaneId('candle_pane', 'MA')) {
          chart.overrideIndicator({ name: 'MA', calcParams: [indicatorCommand.settings] }, 'candle_pane')
          return
        }
        chart.createIndicator({ name: 'MA', calcParams: [indicatorCommand.settings] }, true, { id: 'candle_pane' })
      } else {
        chart.removeIndicator('candle_pane', 'MA')
      }
    }

    if (indicatorCommand.name === 'Vol') {
      ensureMainVolumeLegendIndicator()

      if (indicatorCommand.action === 'load') {
        if (chart.getIndicatorByPaneId('candle_pane', mainVolumeIndicatorName)) {
          chart.overrideIndicator({ name: mainVolumeIndicatorName, calcParams: [indicatorCommand.settings] }, 'candle_pane')
        } else {
          chart.createIndicator({ name: mainVolumeIndicatorName, calcParams: [indicatorCommand.settings] }, true, { id: 'candle_pane' })
        }
        if (mainVolumeOverlayRef.current) {
          mainVolumeOverlayRef.current.updateSettings(indicatorCommand.settings)
        } else {
          mainVolumeOverlayRef.current = installMainVolumeOverlay(chart, indicatorCommand.settings)
        }
        refreshPane(chart, 'candle_pane')
      } else {
        chart.removeIndicator('candle_pane', mainVolumeIndicatorName)
        mainVolumeOverlayRef.current?.destroy()
        mainVolumeOverlayRef.current = null
        refreshPane(chart, 'candle_pane')
      }
    }
  }, [chartInstanceRef, indicatorCommand])

  useEffect(() => () => {
    mainVolumeOverlayRef.current?.destroy()
    mainVolumeOverlayRef.current = null
    rsiPaneHeightObserverRef.current?.disconnect()
    uninstallRsiAxisDragSensitivity()
  }, [])

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
    </section>
  )
}
