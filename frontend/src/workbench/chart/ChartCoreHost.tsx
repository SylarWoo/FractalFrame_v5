import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { ActionType } from 'klinecharts'
import { chartDrawingVisibilityRefreshEvent } from './chartDrawingTools'
import { installChartDragCursor } from './chartDragCursor'
import { scheduleResetIndicatorYAxisAutoScale, scheduleUnlockYAxisManualDrag } from './chartAxisInteraction'
import { useChartDataLoad } from './useChartDataLoad'
import { useChartInstance } from './useChartInstance'
import { useChartRealtimeTicks } from './useChartRealtimeTicks'
import { useCurrentCandleCountdown } from './useCurrentCandleCountdown'
import { useChartStepLoad } from './useChartStepLoad'
import { installIndicatorAxisDragSensitivity, uninstallIndicatorAxisDragSensitivity } from './rsiAxisDragSensitivity'
import { ensureMainVolumeLegendIndicator, installMainVolumeOverlay, mainVolumeIndicatorName } from './mainVolumeIndicator'
import { ensureTradingViewMaShiftIndicator } from './tradingViewMaShiftIndicator'
import { ensureTradingViewMacdIndicator } from './tradingViewMacdIndicator'
import { ensureTradingViewRsiIndicator } from './tradingViewRsiIndicator'
import { ensureTradingViewStochIndicator } from './tradingViewStochIndicator'
import { ensureTradingViewTsiIndicator } from './tradingViewTsiIndicator'
import { ensureTradingViewViIndicator } from './tradingViewViIndicator'
import { ensureTradingViewVwapIndicator } from './tradingViewVwapIndicator'
import type { MacdIndicatorSettings, MaIndicatorSettings, RsiIndicatorSettings, StochIndicatorSettings, TsiIndicatorSettings, ViIndicatorSettings, VolIndicatorSettings, VwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { isStoredVisibilityRangePeriodVisible } from '../visibilityRange/visibilityRangeModel'
import { readString, writeString } from '../persistence/jsonStorage'
import './ChartCoreHost.css'

const rsiPaneId = 'rsi_pane'
const stochPaneId = 'stoch_pane'
const macdPaneId = 'macd_pane'
const tsiPaneId = 'tsi_pane'
const viPaneId = 'vi_pane'
const rsiPaneHeightStorageKey = 'fractalframe.chart.rsiPaneHeight'
const stochPaneHeightStorageKey = 'fractalframe.chart.stochPaneHeight'
const macdPaneHeightStorageKey = 'fractalframe.chart.macdPaneHeight'
const tsiPaneHeightStorageKey = 'fractalframe.chart.tsiPaneHeight'
const viPaneHeightStorageKey = 'fractalframe.chart.viPaneHeight'
const defaultRsiPaneHeight = 128
const minRsiPaneHeight = 80
const maxStoredRsiPaneHeight = 720
const updateLevelAll = 4

function refreshChartDrawings() {
  window.dispatchEvent(new Event(chartDrawingVisibilityRefreshEvent))
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event(chartDrawingVisibilityRefreshEvent))
  })
}

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
  | { name: 'MACD'; settings?: MacdIndicatorSettings }
  | { name: 'RSI'; settings?: RsiIndicatorSettings }
  | { name: 'Stoch'; settings?: StochIndicatorSettings }
  | { name: 'TSI'; settings?: TsiIndicatorSettings }
  | { name: 'VI'; settings?: ViIndicatorSettings }
  | { name: 'VWAP'; settings?: VwapIndicatorSettings }
  | { name: 'Vol'; settings?: VolIndicatorSettings }
)

export type ChartLoadState = {
  error: boolean
  loadedPeriod?: string
  loadedSymbol?: string
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

function readStoredPaneHeight(storageKey: string) {
  if (typeof window === 'undefined') return defaultRsiPaneHeight
  const stored = Number(readString(storageKey))
  return Number.isFinite(stored) ? normalizeRsiPaneHeight(stored) : defaultRsiPaneHeight
}

function writeStoredPaneHeight(storageKey: string, height: number) {
  if (typeof window === 'undefined' || !Number.isFinite(height)) return
  writeString(storageKey, String(normalizeRsiPaneHeight(height)))
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
  const realtimeDataReady = !loadState.loading &&
    loadState.rows > 0 &&
    loadState.loadedSymbol === symbol &&
    loadState.loadedPeriod === period
  const candleCountdown = useCurrentCandleCountdown({ chartInstanceRef, dataReady: realtimeDataReady, period, symbol })
  const rsiPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const stochPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const macdPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const tsiPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const viPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const mainVolumeOverlayRef = useRef<ReturnType<typeof installMainVolumeOverlay> | null>(null)

  useEffect(() => {
    onLoadStateChange?.({ ...loadState, period, symbol, totalRows })
  }, [loadState, onLoadStateChange, period, symbol, totalRows])

  useChartRealtimeTicks({ chartInstanceRef, dataReady: realtimeDataReady, period, symbol, totalRows })
  useChartStepLoad({ chartInstanceRef, period, setLoadState, stepLoad: stepLoad ?? null, symbol, totalRows })

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    const persistRsiPaneHeight = () => {
      window.requestAnimationFrame(() => {
        const size = chart.getSize(rsiPaneId)
        if (size?.height) writeStoredPaneHeight(rsiPaneHeightStorageKey, size.height)
      })
    }

    const persistStochPaneHeight = () => {
      window.requestAnimationFrame(() => {
        const size = chart.getSize(stochPaneId)
        if (size?.height) writeStoredPaneHeight(stochPaneHeightStorageKey, size.height)
      })
    }
    const persistMacdPaneHeight = () => {
      window.requestAnimationFrame(() => {
        const size = chart.getSize(macdPaneId)
        if (size?.height) writeStoredPaneHeight(macdPaneHeightStorageKey, size.height)
      })
    }
    const persistTsiPaneHeight = () => {
      window.requestAnimationFrame(() => {
        const size = chart.getSize(tsiPaneId)
        if (size?.height) writeStoredPaneHeight(tsiPaneHeightStorageKey, size.height)
      })
    }
    const persistViPaneHeight = () => {
      window.requestAnimationFrame(() => {
        const size = chart.getSize(viPaneId)
        if (size?.height) writeStoredPaneHeight(viPaneHeightStorageKey, size.height)
      })
    }

    chart.subscribeAction(ActionType.OnPaneDrag, persistRsiPaneHeight)
    chart.subscribeAction(ActionType.OnPaneDrag, persistStochPaneHeight)
    chart.subscribeAction(ActionType.OnPaneDrag, persistMacdPaneHeight)
    chart.subscribeAction(ActionType.OnPaneDrag, persistTsiPaneHeight)
    chart.subscribeAction(ActionType.OnPaneDrag, persistViPaneHeight)
    return () => {
      chart.unsubscribeAction(ActionType.OnPaneDrag, persistRsiPaneHeight)
      chart.unsubscribeAction(ActionType.OnPaneDrag, persistStochPaneHeight)
      chart.unsubscribeAction(ActionType.OnPaneDrag, persistMacdPaneHeight)
      chart.unsubscribeAction(ActionType.OnPaneDrag, persistTsiPaneHeight)
      chart.unsubscribeAction(ActionType.OnPaneDrag, persistViPaneHeight)
    }
  }, [chartInstanceRef])

  const observeIndicatorPaneHeight = (paneId: string, storageKey: string, observerRef: MutableRefObject<ResizeObserver | null>) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    const chart = chartInstanceRef.current
    if (!chart) return

    window.requestAnimationFrame(() => {
      const paneDom = chart.getDom(paneId)
      if (!paneDom) return

      const observer = new ResizeObserver(() => {
        const size = chart.getSize(paneId)
        if (size?.height) writeStoredPaneHeight(storageKey, size.height)
      })
      observer.observe(paneDom)
      observerRef.current = observer

      const size = chart.getSize(paneId)
      if (size?.height) writeStoredPaneHeight(storageKey, size.height)
    })
  }

  const observeRsiPaneHeight = () => observeIndicatorPaneHeight(rsiPaneId, rsiPaneHeightStorageKey, rsiPaneHeightObserverRef)
  const observeStochPaneHeight = () => observeIndicatorPaneHeight(stochPaneId, stochPaneHeightStorageKey, stochPaneHeightObserverRef)
  const observeMacdPaneHeight = () => observeIndicatorPaneHeight(macdPaneId, macdPaneHeightStorageKey, macdPaneHeightObserverRef)
  const observeTsiPaneHeight = () => observeIndicatorPaneHeight(tsiPaneId, tsiPaneHeightStorageKey, tsiPaneHeightObserverRef)
  const observeViPaneHeight = () => observeIndicatorPaneHeight(viPaneId, viPaneHeightStorageKey, viPaneHeightObserverRef)
  const isIndicatorVisibleInCurrentPeriod = (name: ChartIndicatorCommand['name']) => isStoredVisibilityRangePeriodVisible(`indicator:${name}`, period)

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart || !indicatorCommand) return

    if (indicatorCommand.name === 'RSI') {
      ensureTradingViewRsiIndicator()

      if (indicatorCommand.action === 'load') {
        if (!isIndicatorVisibleInCurrentPeriod('RSI')) {
          const size = chart.getSize(rsiPaneId)
          if (size?.height) writeStoredPaneHeight(rsiPaneHeightStorageKey, size.height)
          rsiPaneHeightObserverRef.current?.disconnect()
          rsiPaneHeightObserverRef.current = null
          chart.removeIndicator(rsiPaneId, 'RSI')
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        if (chart.getIndicatorByPaneId(rsiPaneId, 'RSI')) {
          chart.overrideIndicator({ name: 'RSI', calcParams: [indicatorCommand.settings] }, rsiPaneId, observeRsiPaneHeight)
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        chart.createIndicator(
          { name: 'RSI', calcParams: [indicatorCommand.settings] },
          false,
          { id: rsiPaneId, height: readStoredPaneHeight(rsiPaneHeightStorageKey), minHeight: minRsiPaneHeight },
          () => {
            observeRsiPaneHeight()
            installChartDragCursor(chart)
            refreshChartDrawings()
            scheduleUnlockYAxisManualDrag(chart)
          },
        )
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      } else {
        const size = chart.getSize(rsiPaneId)
        if (size?.height) writeStoredPaneHeight(rsiPaneHeightStorageKey, size.height)
        rsiPaneHeightObserverRef.current?.disconnect()
        rsiPaneHeightObserverRef.current = null
        chart.removeIndicator(rsiPaneId, 'RSI')
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      }
    }

    if (indicatorCommand.name === 'Stoch') {
      ensureTradingViewStochIndicator()

      if (indicatorCommand.action === 'load') {
        if (!isIndicatorVisibleInCurrentPeriod('Stoch')) {
          const size = chart.getSize(stochPaneId)
          if (size?.height) writeStoredPaneHeight(stochPaneHeightStorageKey, size.height)
          stochPaneHeightObserverRef.current?.disconnect()
          stochPaneHeightObserverRef.current = null
          chart.removeIndicator(stochPaneId, 'Stoch')
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        if (chart.getIndicatorByPaneId(stochPaneId, 'Stoch')) {
          chart.overrideIndicator({ name: 'Stoch', calcParams: [indicatorCommand.settings] }, stochPaneId, observeStochPaneHeight)
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        chart.createIndicator(
          { name: 'Stoch', calcParams: [indicatorCommand.settings] },
          false,
          { id: stochPaneId, height: readStoredPaneHeight(stochPaneHeightStorageKey), minHeight: minRsiPaneHeight },
          () => {
            observeStochPaneHeight()
            installChartDragCursor(chart)
            refreshChartDrawings()
            scheduleUnlockYAxisManualDrag(chart)
          },
        )
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      } else {
        const size = chart.getSize(stochPaneId)
        if (size?.height) writeStoredPaneHeight(stochPaneHeightStorageKey, size.height)
        stochPaneHeightObserverRef.current?.disconnect()
        stochPaneHeightObserverRef.current = null
        chart.removeIndicator(stochPaneId, 'Stoch')
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      }
    }

    if (indicatorCommand.name === 'MACD') {
      ensureTradingViewMacdIndicator()

      if (indicatorCommand.action === 'load') {
        if (!isIndicatorVisibleInCurrentPeriod('MACD')) {
          const size = chart.getSize(macdPaneId)
          if (size?.height) writeStoredPaneHeight(macdPaneHeightStorageKey, size.height)
          macdPaneHeightObserverRef.current?.disconnect()
          macdPaneHeightObserverRef.current = null
          chart.removeIndicator(macdPaneId, 'MACD')
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        if (chart.getIndicatorByPaneId(macdPaneId, 'MACD')) {
          chart.overrideIndicator({ name: 'MACD', calcParams: [indicatorCommand.settings] }, macdPaneId, observeMacdPaneHeight)
          scheduleResetIndicatorYAxisAutoScale(chart, [macdPaneId])
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        chart.createIndicator(
          { name: 'MACD', calcParams: [indicatorCommand.settings] },
          false,
          { id: macdPaneId, height: readStoredPaneHeight(macdPaneHeightStorageKey), minHeight: minRsiPaneHeight },
          () => {
            observeMacdPaneHeight()
            installChartDragCursor(chart)
            refreshChartDrawings()
            scheduleResetIndicatorYAxisAutoScale(chart, [macdPaneId])
            scheduleUnlockYAxisManualDrag(chart)
          },
        )
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      } else {
        const size = chart.getSize(macdPaneId)
        if (size?.height) writeStoredPaneHeight(macdPaneHeightStorageKey, size.height)
        macdPaneHeightObserverRef.current?.disconnect()
        macdPaneHeightObserverRef.current = null
        chart.removeIndicator(macdPaneId, 'MACD')
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      }
    }

    if (indicatorCommand.name === 'TSI') {
      ensureTradingViewTsiIndicator()

      if (indicatorCommand.action === 'load') {
        if (!isIndicatorVisibleInCurrentPeriod('TSI')) {
          const size = chart.getSize(tsiPaneId)
          if (size?.height) writeStoredPaneHeight(tsiPaneHeightStorageKey, size.height)
          tsiPaneHeightObserverRef.current?.disconnect()
          tsiPaneHeightObserverRef.current = null
          chart.removeIndicator(tsiPaneId, 'TSI')
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        if (chart.getIndicatorByPaneId(tsiPaneId, 'TSI')) {
          chart.overrideIndicator({ name: 'TSI', calcParams: [indicatorCommand.settings] }, tsiPaneId, observeTsiPaneHeight)
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        chart.createIndicator(
          { name: 'TSI', calcParams: [indicatorCommand.settings] },
          false,
          { id: tsiPaneId, height: readStoredPaneHeight(tsiPaneHeightStorageKey), minHeight: minRsiPaneHeight },
          () => {
            observeTsiPaneHeight()
            installChartDragCursor(chart)
            refreshChartDrawings()
            scheduleUnlockYAxisManualDrag(chart)
          },
        )
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      } else {
        const size = chart.getSize(tsiPaneId)
        if (size?.height) writeStoredPaneHeight(tsiPaneHeightStorageKey, size.height)
        tsiPaneHeightObserverRef.current?.disconnect()
        tsiPaneHeightObserverRef.current = null
        chart.removeIndicator(tsiPaneId, 'TSI')
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      }
    }

    if (indicatorCommand.name === 'VI') {
      ensureTradingViewViIndicator()

      if (indicatorCommand.action === 'load') {
        if (!isIndicatorVisibleInCurrentPeriod('VI')) {
          const size = chart.getSize(viPaneId)
          if (size?.height) writeStoredPaneHeight(viPaneHeightStorageKey, size.height)
          viPaneHeightObserverRef.current?.disconnect()
          viPaneHeightObserverRef.current = null
          chart.removeIndicator(viPaneId, 'VI')
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        if (chart.getIndicatorByPaneId(viPaneId, 'VI')) {
          chart.overrideIndicator({ name: 'VI', calcParams: [indicatorCommand.settings] }, viPaneId, observeViPaneHeight)
          window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
          scheduleUnlockYAxisManualDrag(chart)
          return
        }
        chart.createIndicator(
          { name: 'VI', calcParams: [indicatorCommand.settings] },
          false,
          { id: viPaneId, height: readStoredPaneHeight(viPaneHeightStorageKey), minHeight: minRsiPaneHeight },
          () => {
            observeViPaneHeight()
            installChartDragCursor(chart)
            refreshChartDrawings()
            scheduleUnlockYAxisManualDrag(chart)
          },
        )
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      } else {
        const size = chart.getSize(viPaneId)
        if (size?.height) writeStoredPaneHeight(viPaneHeightStorageKey, size.height)
        viPaneHeightObserverRef.current?.disconnect()
        viPaneHeightObserverRef.current = null
        chart.removeIndicator(viPaneId, 'VI')
        window.requestAnimationFrame(() => installIndicatorAxisDragSensitivity(chart))
        scheduleUnlockYAxisManualDrag(chart)
      }
    }

    if (indicatorCommand.name === 'MA') {
      ensureTradingViewMaShiftIndicator()

      if (indicatorCommand.action === 'load') {
        if (!isIndicatorVisibleInCurrentPeriod('MA')) {
          chart.removeIndicator('candle_pane', 'MA')
          return
        }
        if (chart.getIndicatorByPaneId('candle_pane', 'MA')) {
          chart.overrideIndicator({ name: 'MA', calcParams: [indicatorCommand.settings] }, 'candle_pane')
          return
        }
        chart.createIndicator({ name: 'MA', calcParams: [indicatorCommand.settings] }, true, { id: 'candle_pane' })
      } else {
        chart.removeIndicator('candle_pane', 'MA')
      }
    }

    if (indicatorCommand.name === 'VWAP') {
      ensureTradingViewVwapIndicator()
      const vwapSettings = { ...indicatorCommand.settings, symbol }

      if (indicatorCommand.action === 'load') {
        if (!isIndicatorVisibleInCurrentPeriod('VWAP')) {
          chart.removeIndicator('candle_pane', 'VWAP')
          return
        }
        if (chart.getIndicatorByPaneId('candle_pane', 'VWAP')) {
          chart.overrideIndicator({ name: 'VWAP', calcParams: [vwapSettings] }, 'candle_pane')
          return
        }
        chart.createIndicator({ name: 'VWAP', calcParams: [vwapSettings] }, true, { id: 'candle_pane' })
      } else {
        chart.removeIndicator('candle_pane', 'VWAP')
      }
    }

    if (indicatorCommand.name === 'Vol') {
      ensureMainVolumeLegendIndicator()

      if (indicatorCommand.action === 'load') {
        if (!isIndicatorVisibleInCurrentPeriod('Vol')) {
          chart.removeIndicator('candle_pane', mainVolumeIndicatorName)
          mainVolumeOverlayRef.current?.destroy()
          mainVolumeOverlayRef.current = null
          refreshPane(chart, 'candle_pane')
          return
        }
        if (chart.getIndicatorByPaneId('candle_pane', mainVolumeIndicatorName)) {
          chart.overrideIndicator({ name: mainVolumeIndicatorName, calcParams: [indicatorCommand.settings], zLevel: -20 }, 'candle_pane')
        } else {
          chart.createIndicator({ name: mainVolumeIndicatorName, calcParams: [indicatorCommand.settings], zLevel: -20 }, true, { id: 'candle_pane' })
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
  }, [chartInstanceRef, indicatorCommand, period, symbol])

  useEffect(() => () => {
    mainVolumeOverlayRef.current?.destroy()
    mainVolumeOverlayRef.current = null
    rsiPaneHeightObserverRef.current?.disconnect()
    stochPaneHeightObserverRef.current?.disconnect()
    macdPaneHeightObserverRef.current?.disconnect()
    tsiPaneHeightObserverRef.current?.disconnect()
    viPaneHeightObserverRef.current?.disconnect()
    uninstallIndicatorAxisDragSensitivity()
  }, [])

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
      {candleCountdown.visible && (
        <div
          className="ff-chart-current-candle-countdown"
          style={{
            ['--ff-current-candle-y-axis-width' as string]: `${candleCountdown.axisWidth}px`,
            backgroundColor: candleCountdown.color,
            top: `${candleCountdown.top}px`,
          }}
        >
          <span>{candleCountdown.price}</span>
          <span>{candleCountdown.text}</span>
        </div>
      )}
    </section>
  )
}
