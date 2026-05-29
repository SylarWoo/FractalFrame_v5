import { useCallback, useEffect, useRef } from 'react'
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

    const handleCrosshairChange = (payload: unknown) => {
      morganRangeCrosshairIndexRef.current = readCrosshairDataIndex(payload)
      publishMorganRangeSegment(morganRangeCrosshairIndexRef.current)
    }
    chart.subscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
    publishMorganRangeSegment()
    return () => {
      chart.unsubscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
    }
  }, [chartInstanceRef, publishMorganRangeSegment])

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
    </section>
  )
}
