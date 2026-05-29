import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { ActionType } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { chartDrawingVisibilityRefreshEvent } from './chartDrawingTools'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { useChartDataLoad } from './useChartDataLoad'
import { useChartInstance } from './useChartInstance'
import { chartRealtimeDataChangedEvent, useChartRealtimeTicks } from './useChartRealtimeTicks'
import { useCurrentCandleCountdown } from './useCurrentCandleCountdown'
import { useChartStepLoad } from './useChartStepLoad'
import { ensureMainVolumeLegendIndicator, installMainVolumeOverlay } from './mainVolumeIndicator'
import { applyMorganRangeOverlays, clearMorganRangeOverlays } from './useMorganRangeOverlays'
import { calculateMorganRangeSegments, findMorganRangeSegmentByDataIndex, h4MorganSeconds, type MorganRangeSegment } from './morganRangeModel'
import { mmfV2MomentumStatsEvent, publishMmfV2MomentumCrosshairIndex } from './mmfV2MomentumStats'
import type { MmfV2MomentumSample, MmfV2MomentumStats, MmfV2MomentumStatsSide } from './mmfV2MomentumStats'
import { readCrosshairDataIndex } from './paneTitleOverlayContent'
import { ensureTradingViewMaShiftIndicator } from './tradingViewMaShiftIndicator'
import { ensureTradingViewMmfIndicator } from './tradingViewMmfIndicator'
import { ensureTradingViewMmfV2Indicator } from './tradingViewMmfV2Indicator'
import { ensureTradingViewMacdIndicator } from './tradingViewMacdIndicator'
import { ensureTradingViewDpoIndicator } from './tradingViewDpoIndicator'
import { ensureTradingViewRsiIndicator } from './tradingViewRsiIndicator'
import { ensureTradingViewSqzmomIndicator } from './tradingViewSqzmomIndicator'
import { ensureTradingViewStochIndicator } from './tradingViewStochIndicator'
import { ensureTradingViewTsiIndicator } from './tradingViewTsiIndicator'
import { ensureTradingViewVdoIndicator } from './tradingViewVdoIndicator'
import { ensureTradingViewViIndicator } from './tradingViewViIndicator'
import { ensureTradingViewVwapIndicator } from './tradingViewVwapIndicator'
import {
  applyCandleIndicatorCommand,
  applyPaneIndicatorCommand,
  applyVolumeCommand,
} from './chartIndicatorCommandHandlers'
import type {
  CandleIndicatorCommandName,
  CandleIndicatorConfig,
  IndicatorPaneCommandName,
  IndicatorPaneConfig,
} from './chartIndicatorCommandHandlers'
import type { DpoIndicatorSettings, MacdIndicatorSettings, MaIndicatorSettings, MmfIndicatorSettings, MrIndicatorSettings, RsiIndicatorSettings, SqzmomIndicatorSettings, StochIndicatorSettings, TsiIndicatorSettings, VdoIndicatorSettings, ViIndicatorSettings, VolIndicatorSettings, VwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { isStoredVisibilityRangePeriodVisible } from '../visibilityRange/visibilityRangeModel'
import { readString, writeString } from '../persistence/jsonStorage'
import './ChartCoreHost.css'

const rsiPaneId = 'rsi_pane'
const stochPaneId = 'stoch_pane'
const sqzmomPaneId = 'sqzmom_pane'
const macdPaneId = 'macd_pane'
const dpoPaneId = 'dpo_pane'
const vdoPaneId = 'vdo_pane'
const tsiPaneId = 'tsi_pane'
const viPaneId = 'vi_pane'
const mmfIndicatorZLevel = 30
const rsiPaneHeightStorageKey = 'fractalframe.chart.rsiPaneHeight'
const stochPaneHeightStorageKey = 'fractalframe.chart.stochPaneHeight'
const sqzmomPaneHeightStorageKey = 'fractalframe.chart.sqzmomPaneHeight'
const macdPaneHeightStorageKey = 'fractalframe.chart.macdPaneHeight'
const dpoPaneHeightStorageKey = 'fractalframe.chart.dpoPaneHeight'
const vdoPaneHeightStorageKey = 'fractalframe.chart.vdoPaneHeight'
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
  mmfLoaded?: boolean
  mmfSettings?: MmfIndicatorSettings
  onLoadStateChange?: (state: ChartLoadState) => void
  onMorganRangeSegmentChange?: (segment: MorganRangeSegment | null) => void
  page?: ChartPageTarget | null
  period: string
  reloadId?: number
  stepLoad?: { direction: 'left' | 'right'; id: number } | null
  stochSettings?: StochIndicatorSettings
  symbol: string
  totalRows?: number | null
  vdoSettings?: VdoIndicatorSettings
}

export type ChartPageTarget = {
  index: number
  limit: number
  realtime: boolean
  timeTo?: number | null
}

export type ChartIndicatorCommand = {
  action: 'load' | 'unload'
  id: number
} & (
  | { name: 'MA'; settings?: MaIndicatorSettings }
  | { name: 'MACD'; settings?: MacdIndicatorSettings }
  | { name: 'MMF'; settings?: MmfIndicatorSettings }
  | { name: 'MMF_V2'; settings?: MmfIndicatorSettings }
  | { name: 'DPO'; settings?: DpoIndicatorSettings }
  | { name: 'MR'; settings?: MrIndicatorSettings }
  | { name: 'RSI'; settings?: RsiIndicatorSettings }
  | { name: 'SQZMOM'; settings?: SqzmomIndicatorSettings }
  | { name: 'Stoch'; settings?: StochIndicatorSettings }
  | { name: 'TSI'; settings?: TsiIndicatorSettings }
  | { name: 'VDO'; settings?: VdoIndicatorSettings }
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

function isChartPaneSeparatorTarget(target: EventTarget | null, chartRoot: HTMLElement | null) {
  if (!(target instanceof HTMLElement) || !chartRoot?.contains(target)) return false
  const style = window.getComputedStyle(target)
  if (style.cursor !== 'ns-resize') return false
  const rect = target.getBoundingClientRect()
  return rect.height > 0 && rect.height <= 16 && rect.width > 80
}

function refreshPane(chart: unknown, paneId: string) {
  const updatePane = (chart as { updatePane?: (level: number, paneId?: string) => void }).updatePane
  if (!updatePane) return
  window.requestAnimationFrame(() => {
    updatePane.call(chart, updateLevelAll, paneId)
  })
}

export function ChartCoreHost({ displayName, indicatorCommand, jump, limit, mmfLoaded = false, mmfSettings, onLoadStateChange, onMorganRangeSegmentChange, page, period, reloadId, stepLoad, stochSettings, symbol, totalRows, vdoSettings }: ChartCoreHostProps) {
  const { chartInstanceRef, chartRef } = useChartInstance({ displayName, period, symbol })
  const [mmfV2MomentumStats, setMmfV2MomentumStats] = useState<MmfV2MomentumStats | null>(null)
  const [mmfV2MomentumCrosshairIndex, setMmfV2MomentumCrosshairIndex] = useState<number | null>(null)
  const [mmfV2MomentumClockTime, setMmfV2MomentumClockTime] = useState(() => formatMomentumClockTime())
  const [mmfV2MomentumOverlayStyle, setMmfV2MomentumOverlayStyle] = useState({ right: 96, top: 180 })
  const { loadState, setLoadState } = useChartDataLoad({ chartInstanceRef, jump, limit, page, period, reloadId, symbol, totalRows })
  const realtimeDataReady = !loadState.loading &&
    loadState.rows > 0 &&
    loadState.loadedSymbol === symbol &&
    loadState.loadedPeriod === period
  const realtimePageActive = page?.realtime !== false
  useChartRealtimeTicks({ chartInstanceRef, dataReady: realtimeDataReady && realtimePageActive, period, symbol, totalRows })
  const candleCountdown = useCurrentCandleCountdown({ chartInstanceRef, dataReady: realtimeDataReady && realtimePageActive, period, symbol })
  const rsiPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const stochPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const sqzmomPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const macdPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const dpoPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const vdoPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const tsiPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const viPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const paneResizeActiveRef = useRef(false)
  const paneResizeEndTimerRef = useRef(0)
  const mainVolumeOverlayRef = useRef<ReturnType<typeof installMainVolumeOverlay> | null>(null)
  const morganRangeLoadedRef = useRef(false)
  const morganRangeOverlayIdsRef = useRef<Set<string>>(new Set())
  const morganRangeSettingsRef = useRef<MrIndicatorSettings | null>(null)
  const morganRangeCrosshairIndexRef = useRef<number | null>(null)

  useEffect(() => {
    onLoadStateChange?.({ ...loadState, period, symbol, totalRows })
  }, [loadState, onLoadStateChange, period, symbol, totalRows])

  useChartStepLoad({ chartInstanceRef, period, setLoadState, stepLoad: stepLoad ?? null, symbol, totalRows })

  const persistVisiblePaneHeights = useCallback(() => {
    const chart = chartInstanceRef.current
    if (!chart) return
    const paneHeights = [
      [rsiPaneId, rsiPaneHeightStorageKey],
      [stochPaneId, stochPaneHeightStorageKey],
      [sqzmomPaneId, sqzmomPaneHeightStorageKey],
      [macdPaneId, macdPaneHeightStorageKey],
      [dpoPaneId, dpoPaneHeightStorageKey],
      [vdoPaneId, vdoPaneHeightStorageKey],
      [tsiPaneId, tsiPaneHeightStorageKey],
      [viPaneId, viPaneHeightStorageKey],
    ] as const
    paneHeights.forEach(([paneId, storageKey]) => {
      const size = chart.getSize(paneId)
      if (size?.height) writeStoredPaneHeight(storageKey, size.height)
    })
  }, [chartInstanceRef])

  const observeIndicatorPaneHeight = useCallback((paneId: string, storageKey: string, observerRef: MutableRefObject<ResizeObserver | null>) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    const chart = chartInstanceRef.current
    if (!chart) return

    window.requestAnimationFrame(() => {
      const paneDom = chart.getDom(paneId)
      if (!paneDom) return

      const observer = new ResizeObserver(() => {
        if (!paneResizeActiveRef.current) return
        const size = chart.getSize(paneId)
        if (size?.height) writeStoredPaneHeight(storageKey, size.height)
      })
      observer.observe(paneDom)
      observerRef.current = observer
    })
  }, [chartInstanceRef])

  useEffect(() => {
    const chartRoot = chartRef.current
    if (!chartRoot) return

    const startPaneResize = (event: Event) => {
      if (!isChartPaneSeparatorTarget(event.target, chartRoot)) return
      paneResizeActiveRef.current = true
      if (paneResizeEndTimerRef.current !== 0) {
        window.clearTimeout(paneResizeEndTimerRef.current)
        paneResizeEndTimerRef.current = 0
      }
    }

    const finishPaneResize = () => {
      if (!paneResizeActiveRef.current) return
      paneResizeActiveRef.current = false
      persistVisiblePaneHeights()
      paneResizeEndTimerRef.current = window.setTimeout(() => {
        paneResizeEndTimerRef.current = 0
        persistVisiblePaneHeights()
      }, 80)
    }

    chartRoot.addEventListener('pointerdown', startPaneResize, true)
    chartRoot.addEventListener('mousedown', startPaneResize, true)
    window.addEventListener('pointerup', finishPaneResize, true)
    window.addEventListener('mouseup', finishPaneResize, true)
    window.addEventListener('blur', finishPaneResize)

    return () => {
      chartRoot.removeEventListener('pointerdown', startPaneResize, true)
      chartRoot.removeEventListener('mousedown', startPaneResize, true)
      window.removeEventListener('pointerup', finishPaneResize, true)
      window.removeEventListener('mouseup', finishPaneResize, true)
      window.removeEventListener('blur', finishPaneResize)
      if (paneResizeEndTimerRef.current !== 0) {
        window.clearTimeout(paneResizeEndTimerRef.current)
        paneResizeEndTimerRef.current = 0
      }
      paneResizeActiveRef.current = false
    }
  }, [chartRef, persistVisiblePaneHeights])

  const observeRsiPaneHeight = useCallback(() => observeIndicatorPaneHeight(rsiPaneId, rsiPaneHeightStorageKey, rsiPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const observeStochPaneHeight = useCallback(() => observeIndicatorPaneHeight(stochPaneId, stochPaneHeightStorageKey, stochPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const observeSqzmomPaneHeight = useCallback(() => observeIndicatorPaneHeight(sqzmomPaneId, sqzmomPaneHeightStorageKey, sqzmomPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const observeMacdPaneHeight = useCallback(() => observeIndicatorPaneHeight(macdPaneId, macdPaneHeightStorageKey, macdPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const observeDpoPaneHeight = useCallback(() => observeIndicatorPaneHeight(dpoPaneId, dpoPaneHeightStorageKey, dpoPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const observeVdoPaneHeight = useCallback(() => observeIndicatorPaneHeight(vdoPaneId, vdoPaneHeightStorageKey, vdoPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const observeTsiPaneHeight = useCallback(() => observeIndicatorPaneHeight(tsiPaneId, tsiPaneHeightStorageKey, tsiPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const observeViPaneHeight = useCallback(() => observeIndicatorPaneHeight(viPaneId, viPaneHeightStorageKey, viPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const isIndicatorVisibleInCurrentPeriod = useCallback((name: ChartIndicatorCommand['name']) => isStoredVisibilityRangePeriodVisible(`indicator:${name}`, period), [period])

  const buildMmfCalcParams = useCallback((settings?: MmfIndicatorSettings) => [
    settings,
    {
      period,
      stochDSmoothing: stochSettings?.dSmoothing,
      stochKSmoothing: stochSettings?.kSmoothing,
      stochLength: stochSettings?.length,
      symbol,
    },
  ], [period, stochSettings?.dSmoothing, stochSettings?.kSmoothing, stochSettings?.length, symbol])

  const buildMmfV2CalcParams = useCallback((settings?: MmfIndicatorSettings) => [{
    maSettings: undefined,
    period,
    settings,
    symbol,
    vdoSettings,
  }], [period, symbol, vdoSettings])

  const publishMorganRangeSegment = useCallback((dataIndex: number | null = morganRangeCrosshairIndexRef.current) => {
    const chart = chartInstanceRef.current
    if (!chart) {
      onMorganRangeSegmentChange?.(null)
      return
    }
    const periodSeconds = resolvePeriodSeconds(period)
    if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) {
      onMorganRangeSegmentChange?.(null)
      return
    }
    const futureBars = Math.round(h4MorganSeconds / periodSeconds)
    const segments = calculateMorganRangeSegments(chart.getDataList(), futureBars)
    const fallbackIndex = chart.getDataList().length - 1
    onMorganRangeSegmentChange?.(findMorganRangeSegmentByDataIndex(segments, dataIndex ?? fallbackIndex) ?? segments[segments.length - 1] ?? null)
  }, [chartInstanceRef, onMorganRangeSegmentChange, period])

  const applyMorganRangeCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    chart.removeIndicator('candle_pane', 'MR')

    if (command.action === 'unload') {
      morganRangeLoadedRef.current = false
      morganRangeSettingsRef.current = null
      clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
      onMorganRangeSegmentChange?.(null)
      return
    }

    morganRangeLoadedRef.current = true
    morganRangeSettingsRef.current = command.name === 'MR' ? command.settings ?? null : null
    if (!isIndicatorVisibleInCurrentPeriod('MR')) {
      clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
      onMorganRangeSegmentChange?.(null)
      return
    }
    applyMorganRangeOverlays(chart, period, morganRangeOverlayIdsRef.current)
    publishMorganRangeSegment()
  }, [isIndicatorVisibleInCurrentPeriod, onMorganRangeSegmentChange, period, publishMorganRangeSegment])

  const applyMmfCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    ensureTradingViewMmfIndicator()

    if (command.action === 'unload' || !isIndicatorVisibleInCurrentPeriod('MMF')) {
      chart.removeIndicator('candle_pane', 'MMF')
      return
    }

    const settings = command.name === 'MMF' ? command.settings : undefined
    const calcParams = buildMmfCalcParams(settings)
    if (chart.getIndicatorByPaneId('candle_pane', 'MMF')) {
      chart.overrideIndicator({ name: 'MMF', calcParams, zLevel: mmfIndicatorZLevel }, 'candle_pane')
    } else {
      chart.createIndicator({ name: 'MMF', calcParams, zLevel: mmfIndicatorZLevel }, true, { id: 'candle_pane' })
    }
  }, [buildMmfCalcParams, isIndicatorVisibleInCurrentPeriod])

  const applyMmfV2Command = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    ensureTradingViewMmfV2Indicator()

    if (command.action === 'unload' || !isIndicatorVisibleInCurrentPeriod('MMF_V2')) {
      chart.removeIndicator('candle_pane', 'MMF_V2')
      return
    }

    const settings = command.name === 'MMF_V2' ? command.settings : undefined
    const calcParams = buildMmfV2CalcParams(settings)
    if (chart.getIndicatorByPaneId('candle_pane', 'MMF_V2')) {
      chart.overrideIndicator({ name: 'MMF_V2', calcParams, zLevel: mmfIndicatorZLevel }, 'candle_pane')
    } else {
      chart.createIndicator({ name: 'MMF_V2', calcParams, zLevel: mmfIndicatorZLevel }, true, { id: 'candle_pane' })
    }
  }, [buildMmfV2CalcParams, isIndicatorVisibleInCurrentPeriod])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return
    ensureTradingViewMmfIndicator()

    if (!mmfLoaded || !isIndicatorVisibleInCurrentPeriod('MMF')) {
      chart.removeIndicator('candle_pane', 'MMF')
      return
    }

    const calcParams = buildMmfCalcParams(mmfSettings)
    if (chart.getIndicatorByPaneId('candle_pane', 'MMF')) {
      chart.overrideIndicator({ name: 'MMF', calcParams, zLevel: mmfIndicatorZLevel }, 'candle_pane')
    } else {
      chart.createIndicator({ name: 'MMF', calcParams, zLevel: mmfIndicatorZLevel }, true, { id: 'candle_pane' })
    }
  }, [buildMmfCalcParams, chartInstanceRef, isIndicatorVisibleInCurrentPeriod, mmfLoaded, mmfSettings])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart || !indicatorCommand) return

    const paneIndicatorConfigs: Record<IndicatorPaneCommandName, IndicatorPaneConfig> = {
      DPO: {
        ensureRegistered: ensureTradingViewDpoIndicator,
        minHeight: minRsiPaneHeight,
        name: 'DPO',
        observeHeight: observeDpoPaneHeight,
        observerRef: dpoPaneHeightObserverRef,
        paneId: dpoPaneId,
        storageKey: dpoPaneHeightStorageKey,
      },
      MACD: {
        ensureRegistered: ensureTradingViewMacdIndicator,
        minHeight: minRsiPaneHeight,
        name: 'MACD',
        observeHeight: observeMacdPaneHeight,
        observerRef: macdPaneHeightObserverRef,
        paneId: macdPaneId,
        resetPaneIds: [macdPaneId],
        storageKey: macdPaneHeightStorageKey,
      },
      RSI: {
        ensureRegistered: ensureTradingViewRsiIndicator,
        minHeight: minRsiPaneHeight,
        name: 'RSI',
        observeHeight: observeRsiPaneHeight,
        observerRef: rsiPaneHeightObserverRef,
        paneId: rsiPaneId,
        storageKey: rsiPaneHeightStorageKey,
      },
      Stoch: {
        ensureRegistered: ensureTradingViewStochIndicator,
        minHeight: minRsiPaneHeight,
        name: 'Stoch',
        observeHeight: observeStochPaneHeight,
        observerRef: stochPaneHeightObserverRef,
        paneId: stochPaneId,
        storageKey: stochPaneHeightStorageKey,
      },
      SQZMOM: {
        ensureRegistered: ensureTradingViewSqzmomIndicator,
        minHeight: minRsiPaneHeight,
        name: 'SQZMOM',
        observeHeight: observeSqzmomPaneHeight,
        observerRef: sqzmomPaneHeightObserverRef,
        paneId: sqzmomPaneId,
        resetPaneIds: [sqzmomPaneId],
        storageKey: sqzmomPaneHeightStorageKey,
      },
      TSI: {
        ensureRegistered: ensureTradingViewTsiIndicator,
        minHeight: minRsiPaneHeight,
        name: 'TSI',
        observeHeight: observeTsiPaneHeight,
        observerRef: tsiPaneHeightObserverRef,
        paneId: tsiPaneId,
        storageKey: tsiPaneHeightStorageKey,
      },
      VDO: {
        ensureRegistered: ensureTradingViewVdoIndicator,
        minHeight: minRsiPaneHeight,
        name: 'VDO',
        observeHeight: observeVdoPaneHeight,
        observerRef: vdoPaneHeightObserverRef,
        paneId: vdoPaneId,
        storageKey: vdoPaneHeightStorageKey,
      },
      VI: {
        ensureRegistered: ensureTradingViewViIndicator,
        minHeight: minRsiPaneHeight,
        name: 'VI',
        observeHeight: observeViPaneHeight,
        observerRef: viPaneHeightObserverRef,
        paneId: viPaneId,
        storageKey: viPaneHeightStorageKey,
      },
    }
    const paneConfig = paneIndicatorConfigs[indicatorCommand.name as IndicatorPaneCommandName]
    if (paneConfig) {
      applyPaneIndicatorCommand({
        chart,
        command: indicatorCommand,
        config: paneConfig,
        isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
        readStoredPaneHeight,
        refreshChartDrawings,
        writeStoredPaneHeight,
      })
      return
    }
    if (indicatorCommand.name === 'MMF') {
      applyMmfCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'MMF_V2') {
      applyMmfV2Command(chart, indicatorCommand)
      return
    }
    const candleIndicatorConfigs: Record<CandleIndicatorCommandName, CandleIndicatorConfig> = {
      MA: {
        ensureRegistered: ensureTradingViewMaShiftIndicator,
        name: 'MA',
      },
      VWAP: {
        ensureRegistered: ensureTradingViewVwapIndicator,
        name: 'VWAP',
        resolveCalcParams: (command) => ({ ...command.settings, symbol }),
      },
    }
    const candleConfig = candleIndicatorConfigs[indicatorCommand.name as CandleIndicatorCommandName]
    if (candleConfig) {
      applyCandleIndicatorCommand({
        chart,
        command: indicatorCommand,
        config: candleConfig,
        isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      })
      return
    }
    const overlayIndicatorHandlers: Partial<Record<ChartIndicatorCommand['name'], () => void>> = {
      MR: () => applyMorganRangeCommand(chart, indicatorCommand),
      Vol: () => applyVolumeCommand({
        chart,
        command: indicatorCommand,
        ensureRegistered: ensureMainVolumeLegendIndicator,
        installOverlay: installMainVolumeOverlay,
        isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
        overlayRef: mainVolumeOverlayRef,
        refreshPane,
      }),
    }
    const overlayHandler = overlayIndicatorHandlers[indicatorCommand.name]
    if (overlayHandler) {
      overlayHandler()
      return
    }
  }, [
    applyMmfCommand,
    applyMmfV2Command,
    applyMorganRangeCommand,
    chartInstanceRef,
    indicatorCommand,
    isIndicatorVisibleInCurrentPeriod,
    observeDpoPaneHeight,
    observeMacdPaneHeight,
    observeRsiPaneHeight,
    observeSqzmomPaneHeight,
    observeStochPaneHeight,
    observeTsiPaneHeight,
    observeVdoPaneHeight,
    observeViPaneHeight,
    symbol,
  ])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart || !morganRangeLoadedRef.current || loadState.loading) return
    if (!isIndicatorVisibleInCurrentPeriod('MR')) {
      clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
      onMorganRangeSegmentChange?.(null)
      return
    }
    applyMorganRangeOverlays(chart, period, morganRangeOverlayIdsRef.current)
    publishMorganRangeSegment()
  }, [chartInstanceRef, isIndicatorVisibleInCurrentPeriod, loadState.loading, loadState.rows, onMorganRangeSegmentChange, period, publishMorganRangeSegment])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    let frame = 0
    const scheduleRefresh = () => {
      if (!morganRangeLoadedRef.current || loadState.loading) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (!isIndicatorVisibleInCurrentPeriod('MR')) {
          clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
          onMorganRangeSegmentChange?.(null)
          return
        }
        applyMorganRangeOverlays(chart, period, morganRangeOverlayIdsRef.current)
        publishMorganRangeSegment()
      })
    }

    const actions = [ActionType.OnDataReady, ActionType.OnZoom, ActionType.OnScroll, ActionType.OnVisibleRangeChange]
    actions.forEach((action) => chart.subscribeAction(action, scheduleRefresh))
    window.addEventListener(chartRealtimeDataChangedEvent, scheduleRefresh)
    return () => {
      window.cancelAnimationFrame(frame)
      actions.forEach((action) => chart.unsubscribeAction(action, scheduleRefresh))
      window.removeEventListener(chartRealtimeDataChangedEvent, scheduleRefresh)
    }
  }, [chartInstanceRef, isIndicatorVisibleInCurrentPeriod, loadState.loading, onMorganRangeSegmentChange, period, publishMorganRangeSegment])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    const clearMomentumCrosshair = () => {
      morganRangeCrosshairIndexRef.current = null
      setMmfV2MomentumCrosshairIndex(null)
      publishMorganRangeSegment(null)
      publishMmfV2MomentumCrosshairIndex(null)
    }

    const handleCrosshairChange = (payload: unknown) => {
      morganRangeCrosshairIndexRef.current = readCrosshairDataIndex(payload)
      setMmfV2MomentumCrosshairIndex(morganRangeCrosshairIndexRef.current)
      publishMorganRangeSegment(morganRangeCrosshairIndexRef.current)
      publishMmfV2MomentumCrosshairIndex(morganRangeCrosshairIndexRef.current)
    }
    const chartRoot = chartRef.current
    chart.subscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
    chartRoot?.addEventListener('pointerleave', clearMomentumCrosshair)
    window.addEventListener('blur', clearMomentumCrosshair)
    publishMorganRangeSegment()
    return () => {
      chart.unsubscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
      chartRoot?.removeEventListener('pointerleave', clearMomentumCrosshair)
      window.removeEventListener('blur', clearMomentumCrosshair)
    }
  }, [chartInstanceRef, chartRef, publishMorganRangeSegment])

  useEffect(() => {
    const handleStats = (event: Event) => {
      setMmfV2MomentumStats((event as CustomEvent<MmfV2MomentumStats>).detail ?? null)
    }
    window.addEventListener(mmfV2MomentumStatsEvent, handleStats)
    return () => window.removeEventListener(mmfV2MomentumStatsEvent, handleStats)
  }, [])

  useEffect(() => {
    const updateClock = () => setMmfV2MomentumClockTime(formatMomentumClockTime())
    updateClock()
    const timer = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const updatePosition = () => {
      const chart = chartInstanceRef.current
      const chartRoot = chartRef.current
      if (!chart || !chartRoot) return
      const candleSize = chart.getSize('candle_pane')
      const paneHeight = Number(candleSize?.height)
      const top = Number.isFinite(paneHeight) && paneHeight > 0 ? Math.round(8 + paneHeight / 2) : Math.round(chartRoot.clientHeight / 2)
      const axisWidth = resolveRightAxisWidth(chartRoot)
      const right = Math.round(axisWidth + 10)
      setMmfV2MomentumOverlayStyle((current) => current.top === top && current.right === right ? current : { right, top })
    }

    updatePosition()
    const chartRoot = chartRef.current
    const observer = chartRoot ? new ResizeObserver(updatePosition) : null
    if (chartRoot && observer) observer.observe(chartRoot)
    const actions = [
      ActionType.OnDataReady,
      ActionType.OnPaneDrag,
      ActionType.OnVisibleRangeChange,
      ActionType.OnZoom,
    ]
    const chart = chartInstanceRef.current
    actions.forEach((action) => chart?.subscribeAction(action, updatePosition))
    return () => {
      observer?.disconnect()
      actions.forEach((action) => chart?.unsubscribeAction(action, updatePosition))
    }
  }, [chartInstanceRef, chartRef])

  useEffect(() => () => {
    mainVolumeOverlayRef.current?.destroy()
    mainVolumeOverlayRef.current = null
    const chart = chartInstanceRef.current
    if (chart) clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
    rsiPaneHeightObserverRef.current?.disconnect()
    stochPaneHeightObserverRef.current?.disconnect()
    sqzmomPaneHeightObserverRef.current?.disconnect()
    macdPaneHeightObserverRef.current?.disconnect()
    tsiPaneHeightObserverRef.current?.disconnect()
    viPaneHeightObserverRef.current?.disconnect()
  }, [chartInstanceRef])

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
      <MmfV2MomentumScaleTable
        crosshairIndex={mmfV2MomentumCrosshairIndex}
        displayTime={mmfV2MomentumClockTime}
        overlayStyle={mmfV2MomentumOverlayStyle}
        settings={mmfSettings}
        stats={mmfV2MomentumStats}
      />
    </section>
  )
}

function resolveRightAxisWidth(chartRoot: HTMLElement) {
  const rootRect = chartRoot.getBoundingClientRect()
  const candidates = Array.from(chartRoot.querySelectorAll('canvas, div'))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        height: rect.height,
        rightGap: Math.abs(rootRect.right - rect.right),
        width: rect.width,
      }
    })
    .filter((rect) => rect.width >= 36 && rect.width <= 120 && rect.height > Math.max(80, rootRect.height * 0.25) && rect.rightGap <= 4)
    .sort((left, right) => right.height - left.height)
  return Math.round(candidates[0]?.width ?? 88)
}

function MmfV2MomentumScaleTable({
  crosshairIndex,
  displayTime,
  overlayStyle,
  settings,
  stats,
}: {
  crosshairIndex: number | null
  displayTime: string
  overlayStyle: { right: number; top: number }
  settings?: MmfIndicatorSettings
  stats: MmfV2MomentumStats | null
}) {
  if (!stats) return null
  if (settings?.showVdoMomentumFloatingPanel === false) return null
  const highLow = resolveScaleMomentumValue(stats.up, stats.down, crosshairIndex)
  const breakout = resolveScaleMomentumValue(stats.breakoutUp, stats.breakoutDown, crosshairIndex)
  const close = resolveScaleMomentumValue(stats.closeUp, stats.closeDown, crosshairIndex)
  if (!highLow && !breakout && !close) return null

  const highLowColor = highLow?.direction === 'up'
    ? settings?.lowColor ?? '#26a69a'
    : highLow?.direction === 'down'
      ? settings?.highColor ?? '#ef5350'
      : '#334155'
  const breakoutColor = breakout?.direction === 'up'
    ? settings?.resistanceUpBreakColor ?? '#26a69a'
    : breakout?.direction === 'down'
      ? settings?.supportDownBreakColor ?? '#ef5350'
      : '#334155'
  const closeColor = close?.direction === 'up'
    ? settings?.supportUpBreakColor ?? '#26a69a'
    : close?.direction === 'down'
      ? settings?.resistanceDownBreakColor ?? '#ef5350'
      : '#334155'

  return (
    <div
      className="ff-chart-mmf-v2-momentum-scale-table"
      aria-label="MMF V2 momentum current values"
      style={{
        right: `${overlayStyle.right}px`,
        top: `${overlayStyle.top}px`,
      }}
    >
      <div className="ff-chart-mmf-v2-momentum-scale-table__time">{displayTime}</div>
      <div className="ff-chart-mmf-v2-momentum-scale-table__label">{'\u9ad8\u4f4e\u70b9\u52a8\u91cf'}</div>
      <div className="ff-chart-mmf-v2-momentum-scale-table__value" style={{ color: highLowColor }}>{formatScaleMomentumValue(highLow?.sample.momentum)}</div>
      <div className="ff-chart-mmf-v2-momentum-scale-table__label">{'\u7a81\u7834\u70b9\u52a8\u91cf'}</div>
      <div className="ff-chart-mmf-v2-momentum-scale-table__value" style={{ color: breakoutColor }}>{formatScaleMomentumValue(breakout?.sample.momentum)}</div>
      <div className="ff-chart-mmf-v2-momentum-scale-table__label">{'\u5173\u95ed\u70b9\u52a8\u91cf'}</div>
      <div className="ff-chart-mmf-v2-momentum-scale-table__value" style={{ color: closeColor }}>{formatScaleMomentumValue(close?.sample.momentum)}</div>
    </div>
  )
}

function resolveScaleMomentumValue(upStats: MmfV2MomentumStatsSide | null, downStats: MmfV2MomentumStatsSide | null, crosshairIndex: number | null): { direction: 'down' | 'up'; sample: MmfV2MomentumSample } | null {
  const upSamples = upStats?.samplesList ?? []
  const downSamples = downStats?.samplesList ?? []
  const safeCrosshairIndex = Number.isFinite(Number(crosshairIndex)) ? Math.round(Number(crosshairIndex)) : null
  if (safeCrosshairIndex != null) {
    const upHit = upSamples.find((sample) => sample.markerIndex === safeCrosshairIndex)
    if (upHit) return { direction: 'up', sample: upHit }
    const downHit = downSamples.find((sample) => sample.markerIndex === safeCrosshairIndex)
    if (downHit) return { direction: 'down', sample: downHit }
  }
  const latest = [
    ...upSamples.map((sample) => ({ direction: 'up' as const, sample })),
    ...downSamples.map((sample) => ({ direction: 'down' as const, sample })),
  ].sort((left, right) => right.sample.entryIndex - left.sample.entryIndex)[0]
  return latest ?? null
}

function formatScaleMomentumValue(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toFixed(2).replace(/\.?0+$/, '')
}

function formatMomentumClockTime() {
  const date = new Date()
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':')
}
