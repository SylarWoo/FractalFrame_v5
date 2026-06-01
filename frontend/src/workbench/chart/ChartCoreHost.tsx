import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { ActionType } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { chartDrawingVisibilityRefreshEvent } from './chartDrawingTools'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { useChartDataLoad } from './useChartDataLoad'
import { useChartInstance } from './useChartInstance'
import { chartRealtimeDataChangedEvent, useChartRealtimeTicks } from './useChartRealtimeTicks'
import { useCurrentCandleCountdown } from './useCurrentCandleCountdown'
import { useChartStepLoad } from './useChartStepLoad'
import { ensureMainVolumeLegendIndicator, installMainVolumeOverlay } from './mainVolumeIndicator'
import {
  createIndicatorPageKey,
  createIndicatorSettingsHash,
  createIndicatorSnapshotRows,
  readIndicatorPageSnapshot,
  writeIndicatorPageSnapshot,
} from './indicatorPageSnapshotStore'
import { applyMorganRangeOverlaySegments, applyMorganRangeOverlays, clearMorganRangeOverlays } from './useMorganRangeOverlays'
import {
  calculateMorganRangeSegmentsForModeCached,
  findMorganRangeSegmentByDataIndex,
  resolveMorganRangeBucketSeconds,
  type MorganRangeMode,
  type MorganRangeSegment,
} from './morganRangeModel'
import { mmfV2MomentumStatsEvent, publishMmfV2MomentumCrosshairIndex } from './mmfV2MomentumStats'
import type { MmfV2MomentumSample, MmfV2MomentumStats, MmfV2MomentumStatsSide } from './mmfV2MomentumStats'
import { readCrosshairDataIndex } from './paneTitleOverlayContent'
import { calculateTradingViewMaShiftRows, ensureTradingViewMaShiftIndicator } from './tradingViewMaShiftIndicator'
import { ensureTradingViewMmfIndicator } from './tradingViewMmfIndicator'
import { ensureTradingViewMmfV2Indicator } from './tradingViewMmfV2Indicator'
import { calculateMmfV3RowsForPage, ensureTradingViewMmfV3Indicator } from './tradingViewMmfV3Indicator'
import { bprM5StrategyIndicatorName, ensureTradingViewBprM5StrategyIndicator } from './tradingViewBprM5StrategyIndicator'
import { calculateTradingViewMacdRows, ensureTradingViewMacdIndicator } from './tradingViewMacdIndicator'
import { calculateTradingViewDpoRows, ensureTradingViewDpoIndicator } from './tradingViewDpoIndicator'
import { calculateTradingViewRsiRows, ensureTradingViewRsiIndicator } from './tradingViewRsiIndicator'
import { calculateTradingViewSqzmomRows, ensureTradingViewSqzmomIndicator } from './tradingViewSqzmomIndicator'
import { calculateTradingViewStochRows, ensureTradingViewStochIndicator } from './tradingViewStochIndicator'
import { calculateTradingViewTsiRows, ensureTradingViewTsiIndicator } from './tradingViewTsiIndicator'
import { calculateTradingViewVdoRows, ensureTradingViewVdoIndicator } from './tradingViewVdoIndicator'
import { calculateTradingViewViRows, ensureTradingViewViIndicator } from './tradingViewViIndicator'
import { calculateTradingViewAoRows, ensureTradingViewAoIndicator } from './tradingViewAoIndicator'
import { calculateTradingViewVmiRows, ensureTradingViewVmiIndicator } from './tradingViewVmiIndicator'
import { calculateTradingViewVwapRows, ensureTradingViewVwapIndicator } from './tradingViewVwapIndicator'
import { ensureTradingViewMrIndicator, resolveTradingViewMrIndicatorName } from './tradingViewMrIndicator'
import {
  applyCandleIndicatorCommand,
  applyPaneIndicatorCommand,
  applySnapshotCandleIndicatorCommand,
  applySnapshotPaneIndicatorCommand,
  applyVolumeCommand,
} from './chartIndicatorCommandHandlers'
import type {
  CandleIndicatorCommandName,
  CandleIndicatorConfig,
  IndicatorPaneCommandName,
  IndicatorPaneConfig,
} from './chartIndicatorCommandHandlers'
import type { DpoIndicatorSettings, MacdIndicatorSettings, MaIndicatorSettings, MmfIndicatorSettings, MrIndicatorSettings, RsiIndicatorSettings, SqzmomIndicatorSettings, StochIndicatorSettings, TsiIndicatorSettings, VdoIndicatorSettings, ViIndicatorSettings, AoIndicatorSettings, VmiIndicatorSettings, VolIndicatorSettings, VwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
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
const aoPaneId = 'ao_pane'
const vmiPaneId = 'vmi_pane'
const mmfIndicatorZLevel = 30
const rsiPaneHeightStorageKey = 'fractalframe.chart.rsiPaneHeight'
const stochPaneHeightStorageKey = 'fractalframe.chart.stochPaneHeight'
const sqzmomPaneHeightStorageKey = 'fractalframe.chart.sqzmomPaneHeight'
const macdPaneHeightStorageKey = 'fractalframe.chart.macdPaneHeight'
const dpoPaneHeightStorageKey = 'fractalframe.chart.dpoPaneHeight'
const vdoPaneHeightStorageKey = 'fractalframe.chart.vdoPaneHeight'
const tsiPaneHeightStorageKey = 'fractalframe.chart.tsiPaneHeight'
const viPaneHeightStorageKey = 'fractalframe.chart.viPaneHeight'
const aoPaneHeightStorageKey = 'fractalframe.chart.aoPaneHeight'
const vmiPaneHeightStorageKey = 'fractalframe.chart.vmiPaneHeight'
const defaultRsiPaneHeight = 128
const minRsiPaneHeight = 80
const maxStoredRsiPaneHeight = 720
const updateLevelAll = 4

type MorganRangeIndicatorName = 'MR-M5' | 'MR-M30'

function resolveMorganRangeMode(name: MorganRangeIndicatorName): MorganRangeMode {
  return name === 'MR-M30' ? 'D1_M30' : 'H4_M5'
}

let chartDrawingRefreshFrame = 0

function refreshChartDrawings() {
  if (chartDrawingRefreshFrame !== 0) return
  window.dispatchEvent(new Event(chartDrawingVisibilityRefreshEvent))
  chartDrawingRefreshFrame = window.requestAnimationFrame(() => {
    chartDrawingRefreshFrame = 0
    window.dispatchEvent(new Event(chartDrawingVisibilityRefreshEvent))
  })
}

type ChartCoreHostProps = {
  displayName?: string
  indicatorCommand?: ChartIndicatorCommand | null
  jump?: { id: number; timestamp?: number } | null
  limit?: number
  loadedStrategyKeys?: string[]
  mmfLoaded?: boolean
  maSettings?: MaIndicatorSettings
  mmfSettings?: MmfIndicatorSettings
  morganRangeMode?: MorganRangeMode
  onLoadStateChange?: (state: ChartLoadState) => void
  onMorganRangeSegmentChange?: (segment: MorganRangeSegment | null) => void
  page?: ChartPageTarget | null
  period: string
  reloadId?: number
  stepLoad?: { direction: 'left' | 'right'; id: number } | null
  stochSettings?: StochIndicatorSettings
  tsiSettings?: TsiIndicatorSettings
  symbol: string
  totalRows?: number | null
  vdoSettings?: VdoIndicatorSettings
  vmiSettings?: VmiIndicatorSettings
  vwapSettings?: VwapIndicatorSettings
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
  | { name: 'MMF_V3'; settings?: MmfIndicatorSettings }
  | { name: 'DPO'; settings?: DpoIndicatorSettings }
  | { name: 'MR-M5'; settings?: MrIndicatorSettings }
  | { name: 'MR-M30'; settings?: MrIndicatorSettings }
  | { name: 'RSI'; settings?: RsiIndicatorSettings }
  | { name: 'SQZMOM'; settings?: SqzmomIndicatorSettings }
  | { name: 'Stoch'; settings?: StochIndicatorSettings }
  | { name: 'TSI'; settings?: TsiIndicatorSettings }
  | { name: 'VDO'; settings?: VdoIndicatorSettings }
  | { name: 'VI'; settings?: ViIndicatorSettings }
  | { name: 'AO'; settings?: AoIndicatorSettings }
  | { name: 'VMI'; settings?: VmiIndicatorSettings }
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

function createChartDataSignature(chart: Chart) {
  const rows = stripFuturePlaceholders(chart.getDataList())
  const first = rows[0]
  const last = rows[rows.length - 1]
  return [
    rows.length,
    first?.timestamp,
    first?.open,
    first?.high,
    first?.low,
    first?.close,
    last?.timestamp,
    last?.open,
    last?.high,
    last?.low,
    last?.close,
  ].join('|')
}

function createCurrentIndicatorPageKey(chart: Chart, options: { pageIndex: number; period: string; realtime: boolean; symbol: string }) {
  return createIndicatorPageKey({
    pageIndex: options.pageIndex,
    period: options.period,
    realtime: options.realtime,
    rows: chart.getDataList(),
    symbol: options.symbol,
  })
}

export function ChartCoreHost({ displayName, indicatorCommand, jump, limit, loadedStrategyKeys = [], maSettings, mmfLoaded = false, mmfSettings, morganRangeMode, onLoadStateChange, onMorganRangeSegmentChange, page, period, reloadId, stepLoad, stochSettings, symbol, totalRows, tsiSettings, vdoSettings, vmiSettings, vwapSettings }: ChartCoreHostProps) {
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
  const aoPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const vmiPaneHeightObserverRef = useRef<ResizeObserver | null>(null)
  const paneResizeActiveRef = useRef(false)
  const paneResizeEndTimerRef = useRef(0)
  const mainVolumeOverlayRef = useRef<ReturnType<typeof installMainVolumeOverlay> | null>(null)
  const morganRangeModeRef = useRef<MorganRangeMode | null>(null)
  const morganRangeIndicatorNameRef = useRef<MorganRangeIndicatorName | null>(null)
  const morganRangeOverlayIdsRef = useRef<Set<string>>(new Set())
  const morganRangeSettingsRef = useRef<MrIndicatorSettings | null>(null)
  const morganRangeCrosshairIndexRef = useRef<number | null>(null)
  const morganRangePublishedSegmentRef = useRef('')
  const mmfV3StaticRequestIdRef = useRef(0)

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
      [aoPaneId, aoPaneHeightStorageKey],
      [vmiPaneId, vmiPaneHeightStorageKey],
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
  const observeAoPaneHeight = useCallback(() => observeIndicatorPaneHeight(aoPaneId, aoPaneHeightStorageKey, aoPaneHeightObserverRef), [observeIndicatorPaneHeight])
  const observeVmiPaneHeight = useCallback(() => observeIndicatorPaneHeight(vmiPaneId, vmiPaneHeightStorageKey, vmiPaneHeightObserverRef), [observeIndicatorPaneHeight])
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
    maSettings,
    morganRangeMode,
    period,
    settings,
    symbol,
    stochSettings,
    vdoSettings,
    vmiSettings,
    tsiSettings,
    vwapSettings,
  }], [maSettings, morganRangeMode, period, stochSettings, symbol, tsiSettings, vdoSettings, vmiSettings, vwapSettings])

  const buildMmfV3CalcParams = useCallback((settings?: MmfIndicatorSettings, snapshot?: { pageKey: string; settingsHash: string }) => [{
    maSettings,
    morganRangeMode,
    pageKey: snapshot?.pageKey,
    period,
    settings,
    settingsHash: snapshot?.settingsHash,
    symbol,
    stochSettings,
    vdoSettings,
    vmiSettings,
    tsiSettings,
    vwapSettings,
  }], [maSettings, morganRangeMode, period, stochSettings, symbol, tsiSettings, vdoSettings, vmiSettings, vwapSettings])

  const buildBprM5StrategyCalcParams = useCallback(() => [{
    maSettings,
    mmfSettings,
    morganRangeMode,
    period,
    stochSettings,
    symbol,
    tsiSettings,
    vdoSettings,
    vmiSettings,
    vwapSettings,
  }], [maSettings, mmfSettings, morganRangeMode, period, stochSettings, symbol, tsiSettings, vdoSettings, vmiSettings, vwapSettings])

  const publishMorganRangeSegment = useCallback((dataIndex: number | null = morganRangeCrosshairIndexRef.current) => {
    const chart = chartInstanceRef.current
    const mode = morganRangeModeRef.current
    if (!chart) {
      onMorganRangeSegmentChange?.(null)
      return
    }
    if (!mode) {
      onMorganRangeSegmentChange?.(null)
      return
    }
    const periodSeconds = resolvePeriodSeconds(period)
    if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) {
      onMorganRangeSegmentChange?.(null)
      return
    }
    const futureBars = Math.round(resolveMorganRangeBucketSeconds(mode) / periodSeconds)
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const segments = readIndicatorPageSnapshot(pageKey)?.morganRange?.segments
      ?? calculateMorganRangeSegmentsForModeCached(chart.getDataList(), mode, futureBars)
    const fallbackIndex = chart.getDataList().length - 1
    const segment = findMorganRangeSegmentByDataIndex(segments, dataIndex ?? fallbackIndex) ?? segments[segments.length - 1] ?? null
    const signature = segment
      ? `${dataIndex ?? fallbackIndex}|${segment.startIndex}|${segment.endIndex}|${segment.center}|${segment.upper}|${segment.lower}`
      : 'null'
    if (signature === morganRangePublishedSegmentRef.current) return
    morganRangePublishedSegmentRef.current = signature
    onMorganRangeSegmentChange?.(segment)
  }, [chartInstanceRef, onMorganRangeSegmentChange, page?.index, page?.realtime, period, symbol])

  const applyMorganRangeCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'MR-M5' && command.name !== 'MR-M30') return

    if (command.action === 'unload') {
      if (morganRangeIndicatorNameRef.current !== command.name) return
      chart.removeIndicator('candle_pane', resolveTradingViewMrIndicatorName(command.name))
      morganRangeModeRef.current = null
      morganRangeIndicatorNameRef.current = null
      morganRangeSettingsRef.current = null
      morganRangePublishedSegmentRef.current = ''
      clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
      onMorganRangeSegmentChange?.(null)
      return
    }

    const chartIndicatorName = resolveTradingViewMrIndicatorName(command.name)
    ensureTradingViewMrIndicator(chartIndicatorName)
    chart.removeIndicator('candle_pane', 'MR_M5')
    chart.removeIndicator('candle_pane', 'MR_M30')
    const mode = resolveMorganRangeMode(command.name)
    morganRangeModeRef.current = mode
    morganRangeIndicatorNameRef.current = command.name
    morganRangeSettingsRef.current = command.settings ?? null
    if (!isIndicatorVisibleInCurrentPeriod(command.name)) {
      clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
      morganRangePublishedSegmentRef.current = ''
      onMorganRangeSegmentChange?.(null)
      return
    }
    const periodSeconds = resolvePeriodSeconds(period)
    const futureBars = Number.isFinite(periodSeconds) && periodSeconds > 0
      ? Math.round(resolveMorganRangeBucketSeconds(mode) / periodSeconds)
      : 0
    const segments = futureBars > 0 ? calculateMorganRangeSegmentsForModeCached(chart.getDataList(), mode, futureBars) : []
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: command.name,
      mode,
      period,
      settings: command.settings,
      symbol,
    })
    writeIndicatorPageSnapshot({
      morganRange: { mode, segments },
      pageKey,
      period: period.trim().toUpperCase(),
      rows: createIndicatorSnapshotRows({ period, rows: chart.getDataList(), symbol }),
      settingsHash,
      settingsHashKey: 'MR',
      symbol,
    })
    chart.createIndicator({ name: chartIndicatorName, calcParams: [command.settings] }, true, { id: 'candle_pane' })
    applyMorganRangeOverlaySegments(chart, period, morganRangeOverlayIdsRef.current, mode, segments)
    publishMorganRangeSegment()
  }, [isIndicatorVisibleInCurrentPeriod, onMorganRangeSegmentChange, page?.index, page?.realtime, period, publishMorganRangeSegment, symbol])

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

  const applyMmfV3Command = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    ensureTradingViewMmfV3Indicator()

    if (command.action === 'unload' || !isIndicatorVisibleInCurrentPeriod('MMF_V3')) {
      mmfV3StaticRequestIdRef.current += 1
      chart.removeIndicator('candle_pane', 'MMF_V3')
      return
    }

    const settings = command.name === 'MMF_V3' ? command.settings : undefined
    const dataList = chart.getDataList()
    const dataSignature = createChartDataSignature(chart)
    const pageKey = createIndicatorPageKey({
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      rows: dataList,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'MMF_V3',
      maSettings,
      mmfSettings: settings,
      morganRangeMode,
      period,
      stochSettings,
      symbol,
      tsiSettings,
      vdoSettings,
      vmiSettings,
      vwapSettings,
    })
    const requestId = mmfV3StaticRequestIdRef.current + 1
    mmfV3StaticRequestIdRef.current = requestId
    const existingSnapshot = readIndicatorPageSnapshot(pageKey)
    const snapshotReady = Boolean(
      existingSnapshot &&
      existingSnapshot.symbol === symbol &&
      existingSnapshot.period === period.trim().toUpperCase() &&
      (existingSnapshot.settingsHashes?.MMF_V3 ?? existingSnapshot.settingsHash) === settingsHash,
    )
    const fallbackCalcParams = snapshotReady
      ? buildMmfV3CalcParams(settings, { pageKey, settingsHash })
      : buildMmfV3CalcParams(settings)
    if (chart.getIndicatorByPaneId('candle_pane', 'MMF_V3')) {
      chart.overrideIndicator({ name: 'MMF_V3', calcParams: fallbackCalcParams, zLevel: mmfIndicatorZLevel }, 'candle_pane')
    } else {
      chart.createIndicator({ name: 'MMF_V3', calcParams: fallbackCalcParams, zLevel: mmfIndicatorZLevel }, true, { id: 'candle_pane' })
    }
    if (snapshotReady) return
    calculateMmfV3RowsForPage(dataList, fallbackCalcParams[0])
      .then((staticRows) => {
        if (mmfV3StaticRequestIdRef.current !== requestId) return
        if (!isIndicatorVisibleInCurrentPeriod('MMF_V3')) return
        const currentChart = chartInstanceRef.current
        if (!currentChart || currentChart !== chart) return
        if (createChartDataSignature(currentChart) !== dataSignature) return
        writeIndicatorPageSnapshot({
          pageKey,
          period: period.trim().toUpperCase(),
          rows: createIndicatorSnapshotRows({ mmfV3Rows: staticRows, period, rows: dataList, symbol }),
          settingsHash,
          settingsHashKey: 'MMF_V3',
          symbol,
        })
        const calcParams = buildMmfV3CalcParams(settings, { pageKey, settingsHash })
        if (currentChart.getIndicatorByPaneId('candle_pane', 'MMF_V3')) {
          currentChart.overrideIndicator({ name: 'MMF_V3', calcParams, zLevel: mmfIndicatorZLevel }, 'candle_pane')
        } else {
          currentChart.createIndicator({ name: 'MMF_V3', calcParams, zLevel: mmfIndicatorZLevel }, true, { id: 'candle_pane' })
        }
      })
      .catch(() => {
        if (mmfV3StaticRequestIdRef.current !== requestId) return
        const currentChart = chartInstanceRef.current
        if (!currentChart || currentChart !== chart) return
        if (createChartDataSignature(currentChart) !== dataSignature) return
        if (currentChart.getIndicatorByPaneId('candle_pane', 'MMF_V3')) {
          currentChart.overrideIndicator({ name: 'MMF_V3', calcParams: fallbackCalcParams, zLevel: mmfIndicatorZLevel }, 'candle_pane')
        } else {
          currentChart.createIndicator({ name: 'MMF_V3', calcParams: fallbackCalcParams, zLevel: mmfIndicatorZLevel }, true, { id: 'candle_pane' })
        }
      })
  }, [buildMmfV3CalcParams, chartInstanceRef, isIndicatorVisibleInCurrentPeriod, maSettings, morganRangeMode, page?.index, page?.realtime, period, stochSettings, symbol, tsiSettings, vdoSettings, vmiSettings, vwapSettings])

  const applyMaCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'MA') return
    const config: CandleIndicatorConfig = {
      ensureRegistered: ensureTradingViewMaShiftIndicator,
      name: 'MA',
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'MA',
      period,
      settings,
      symbol,
    })
    applySnapshotCandleIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ maRows: calculateTradingViewMaShiftRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      settingsHash,
      settingsHashKey: 'MA',
      symbol,
    })
  }, [isIndicatorVisibleInCurrentPeriod, page?.index, page?.realtime, period, symbol])

  const applyVwapCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'VWAP') return
    const config: CandleIndicatorConfig = {
      ensureRegistered: ensureTradingViewVwapIndicator,
      name: 'VWAP',
    }
    const settings = { ...command.settings, symbol }
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'VWAP',
      period,
      settings,
      symbol,
    })
    applySnapshotCandleIndicatorCommand({
      calcParams: [{ ...settings, pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ vwapRows: calculateTradingViewVwapRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      settingsHash,
      settingsHashKey: 'VWAP',
      symbol,
    })
  }, [isIndicatorVisibleInCurrentPeriod, page?.index, page?.realtime, period, symbol])

  const applyStochCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'Stoch') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewStochIndicator,
      minHeight: minRsiPaneHeight,
      name: 'Stoch',
      observeHeight: observeStochPaneHeight,
      observerRef: stochPaneHeightObserverRef,
      paneId: stochPaneId,
      storageKey: stochPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'Stoch',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ stochRows: calculateTradingViewStochRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'Stoch',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeStochPaneHeight, page?.index, page?.realtime, period, symbol])

  const applyVdoCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'VDO') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewVdoIndicator,
      minHeight: minRsiPaneHeight,
      name: 'VDO',
      observeHeight: observeVdoPaneHeight,
      observerRef: vdoPaneHeightObserverRef,
      paneId: vdoPaneId,
      storageKey: vdoPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'VDO',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ vdoRows: calculateTradingViewVdoRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'VDO',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeVdoPaneHeight, page?.index, page?.realtime, period, symbol])

  const applyVmiCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'VMI') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewVmiIndicator,
      minHeight: minRsiPaneHeight,
      name: 'VMI',
      observeHeight: observeVmiPaneHeight,
      observerRef: vmiPaneHeightObserverRef,
      paneId: vmiPaneId,
      storageKey: vmiPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'VMI',
      period,
      settings,
      symbol,
      vdoSettings,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ pageKey, period, settings, settingsHash, symbol, vdoSettings }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ vmiRows: calculateTradingViewVmiRows(realRows, settings, vdoSettings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'VMI',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeVmiPaneHeight, page?.index, page?.realtime, period, symbol, vdoSettings])

  const applyTsiCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'TSI') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewTsiIndicator,
      minHeight: minRsiPaneHeight,
      name: 'TSI',
      observeHeight: observeTsiPaneHeight,
      observerRef: tsiPaneHeightObserverRef,
      paneId: tsiPaneId,
      storageKey: tsiPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'TSI',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ tsiRows: calculateTradingViewTsiRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'TSI',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeTsiPaneHeight, page?.index, page?.realtime, period, symbol])

  const applyAoCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'AO') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewAoIndicator,
      minHeight: minRsiPaneHeight,
      name: 'AO',
      observeHeight: observeAoPaneHeight,
      observerRef: aoPaneHeightObserverRef,
      paneId: aoPaneId,
      storageKey: aoPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'AO',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ aoRows: calculateTradingViewAoRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'AO',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeAoPaneHeight, page?.index, page?.realtime, period, symbol])

  const applyViCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'VI') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewViIndicator,
      minHeight: minRsiPaneHeight,
      name: 'VI',
      observeHeight: observeViPaneHeight,
      observerRef: viPaneHeightObserverRef,
      paneId: viPaneId,
      storageKey: viPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'VI',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ viRows: calculateTradingViewViRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'VI',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeViPaneHeight, page?.index, page?.realtime, period, symbol])

  const applyRsiCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'RSI') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewRsiIndicator,
      minHeight: minRsiPaneHeight,
      name: 'RSI',
      observeHeight: observeRsiPaneHeight,
      observerRef: rsiPaneHeightObserverRef,
      paneId: rsiPaneId,
      storageKey: rsiPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'RSI',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ rsiRows: calculateTradingViewRsiRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'RSI',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeRsiPaneHeight, page?.index, page?.realtime, period, symbol])

  const applyMacdCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'MACD') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewMacdIndicator,
      minHeight: minRsiPaneHeight,
      name: 'MACD',
      observeHeight: observeMacdPaneHeight,
      observerRef: macdPaneHeightObserverRef,
      paneId: macdPaneId,
      resetPaneIds: [macdPaneId],
      storageKey: macdPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'MACD',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ macdRows: calculateTradingViewMacdRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'MACD',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeMacdPaneHeight, page?.index, page?.realtime, period, symbol])

  const applyDpoCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'DPO') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewDpoIndicator,
      minHeight: minRsiPaneHeight,
      name: 'DPO',
      observeHeight: observeDpoPaneHeight,
      observerRef: dpoPaneHeightObserverRef,
      paneId: dpoPaneId,
      storageKey: dpoPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'DPO',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ dpoRows: calculateTradingViewDpoRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'DPO',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeDpoPaneHeight, page?.index, page?.realtime, period, symbol])

  const applySqzmomCommand = useCallback((chart: Chart, command: ChartIndicatorCommand) => {
    if (command.name !== 'SQZMOM') return
    const config: IndicatorPaneConfig = {
      ensureRegistered: ensureTradingViewSqzmomIndicator,
      minHeight: minRsiPaneHeight,
      name: 'SQZMOM',
      observeHeight: observeSqzmomPaneHeight,
      observerRef: sqzmomPaneHeightObserverRef,
      paneId: sqzmomPaneId,
      resetPaneIds: [sqzmomPaneId],
      storageKey: sqzmomPaneHeightStorageKey,
    }
    const settings = command.settings
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const settingsHash = createIndicatorSettingsHash({
      indicator: 'SQZMOM',
      period,
      settings,
      symbol,
    })
    applySnapshotPaneIndicatorCommand({
      calcParams: [{ ...(settings ?? {}), pageKey, period, settingsHash, symbol }],
      chart,
      command,
      config,
      createSnapshotRows: (realRows) => ({ sqzmomRows: calculateTradingViewSqzmomRows(realRows, settings) }),
      isIndicatorVisible: isIndicatorVisibleInCurrentPeriod,
      pageKey,
      period,
      readStoredPaneHeight,
      refreshChartDrawings,
      settingsHash,
      settingsHashKey: 'SQZMOM',
      symbol,
      writeStoredPaneHeight,
    })
  }, [isIndicatorVisibleInCurrentPeriod, observeSqzmomPaneHeight, page?.index, page?.realtime, period, symbol])

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
    if (!chart) return
    ensureTradingViewBprM5StrategyIndicator()

    const loaded = loadedStrategyKeys.includes('m5-breakout-pullback')
    if (!loaded) {
      chart.removeIndicator('candle_pane', bprM5StrategyIndicatorName)
      return
    }

    const calcParams = buildBprM5StrategyCalcParams()
    if (chart.getIndicatorByPaneId('candle_pane', bprM5StrategyIndicatorName)) {
      chart.overrideIndicator({ name: bprM5StrategyIndicatorName, calcParams, zLevel: mmfIndicatorZLevel + 2 }, 'candle_pane')
    } else {
      chart.createIndicator({ name: bprM5StrategyIndicatorName, calcParams, zLevel: mmfIndicatorZLevel + 2 }, true, { id: 'candle_pane' })
    }
  }, [buildBprM5StrategyCalcParams, chartInstanceRef, loadedStrategyKeys])

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
      AO: {
        ensureRegistered: ensureTradingViewAoIndicator,
        minHeight: minRsiPaneHeight,
        name: 'AO',
        observeHeight: observeAoPaneHeight,
        observerRef: aoPaneHeightObserverRef,
        paneId: aoPaneId,
        storageKey: aoPaneHeightStorageKey,
      },
      VMI: {
        ensureRegistered: ensureTradingViewVmiIndicator,
        minHeight: minRsiPaneHeight,
        name: 'VMI',
        observeHeight: observeVmiPaneHeight,
        observerRef: vmiPaneHeightObserverRef,
        paneId: vmiPaneId,
        storageKey: vmiPaneHeightStorageKey,
      },
    }
    if (indicatorCommand.name === 'Stoch') {
      applyStochCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'VDO') {
      applyVdoCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'VMI') {
      applyVmiCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'TSI') {
      applyTsiCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'AO') {
      applyAoCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'VI') {
      applyViCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'RSI') {
      applyRsiCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'MACD') {
      applyMacdCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'DPO') {
      applyDpoCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'SQZMOM') {
      applySqzmomCommand(chart, indicatorCommand)
      return
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
    if (indicatorCommand.name === 'MMF_V3') {
      applyMmfV3Command(chart, indicatorCommand)
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
    if (indicatorCommand.name === 'MA') {
      applyMaCommand(chart, indicatorCommand)
      return
    }
    if (indicatorCommand.name === 'VWAP') {
      applyVwapCommand(chart, indicatorCommand)
      return
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
      'MR-M5': () => applyMorganRangeCommand(chart, indicatorCommand),
      'MR-M30': () => applyMorganRangeCommand(chart, indicatorCommand),
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
    applyMmfV3Command,
    applyMaCommand,
    applyVwapCommand,
    applyStochCommand,
    applyVdoCommand,
    applyVmiCommand,
    applyTsiCommand,
    applyAoCommand,
    applyViCommand,
    applyRsiCommand,
    applyMacdCommand,
    applyDpoCommand,
    applySqzmomCommand,
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
    observeAoPaneHeight,
    observeVmiPaneHeight,
    symbol,
  ])

  useEffect(() => {
    const chart = chartInstanceRef.current
    const indicatorName = morganRangeIndicatorNameRef.current
    const mode = morganRangeModeRef.current
    if (!chart || !indicatorName || !mode || loadState.loading) return
    if (!isIndicatorVisibleInCurrentPeriod(indicatorName)) {
      clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
      onMorganRangeSegmentChange?.(null)
      return
    }
    const pageKey = createCurrentIndicatorPageKey(chart, {
      pageIndex: page?.index ?? 1,
      period,
      realtime: page?.realtime !== false,
      symbol,
    })
    const segments = readIndicatorPageSnapshot(pageKey)?.morganRange?.segments
    if (segments) {
      applyMorganRangeOverlaySegments(chart, period, morganRangeOverlayIdsRef.current, mode, segments)
    } else {
      applyMorganRangeOverlays(chart, period, morganRangeOverlayIdsRef.current, mode)
    }
    publishMorganRangeSegment()
  }, [chartInstanceRef, isIndicatorVisibleInCurrentPeriod, loadState.loading, loadState.rows, onMorganRangeSegmentChange, page?.index, page?.realtime, period, publishMorganRangeSegment, symbol])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    let frame = 0
    const scheduleRefresh = () => {
      const indicatorName = morganRangeIndicatorNameRef.current
      const mode = morganRangeModeRef.current
      if (!indicatorName || !mode || loadState.loading) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (!isIndicatorVisibleInCurrentPeriod(indicatorName)) {
          clearMorganRangeOverlays(chart, morganRangeOverlayIdsRef.current)
          morganRangePublishedSegmentRef.current = ''
          onMorganRangeSegmentChange?.(null)
          return
        }
        const pageKey = createCurrentIndicatorPageKey(chart, {
          pageIndex: page?.index ?? 1,
          period,
          realtime: page?.realtime !== false,
          symbol,
        })
        const segments = readIndicatorPageSnapshot(pageKey)?.morganRange?.segments
        if (segments) {
          applyMorganRangeOverlaySegments(chart, period, morganRangeOverlayIdsRef.current, mode, segments)
        } else {
          applyMorganRangeOverlays(chart, period, morganRangeOverlayIdsRef.current, mode)
        }
        publishMorganRangeSegment()
      })
    }

    const actions = [ActionType.OnDataReady, ActionType.OnZoom]
    actions.forEach((action) => chart.subscribeAction(action, scheduleRefresh))
    window.addEventListener(chartRealtimeDataChangedEvent, scheduleRefresh)
    return () => {
      window.cancelAnimationFrame(frame)
      actions.forEach((action) => chart.unsubscribeAction(action, scheduleRefresh))
      window.removeEventListener(chartRealtimeDataChangedEvent, scheduleRefresh)
    }
  }, [chartInstanceRef, isIndicatorVisibleInCurrentPeriod, loadState.loading, onMorganRangeSegmentChange, page?.index, page?.realtime, period, publishMorganRangeSegment, symbol])

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
      const nextIndex = readCrosshairDataIndex(payload)
      if (nextIndex === morganRangeCrosshairIndexRef.current) return
      morganRangeCrosshairIndexRef.current = nextIndex
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
    let frame = 0
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
    const scheduleUpdatePosition = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        updatePosition()
      })
    }

    updatePosition()
    const chartRoot = chartRef.current
    const observer = chartRoot ? new ResizeObserver(scheduleUpdatePosition) : null
    if (chartRoot && observer) observer.observe(chartRoot)
    const actions = [
      ActionType.OnDataReady,
      ActionType.OnPaneDrag,
      ActionType.OnVisibleRangeChange,
      ActionType.OnZoom,
    ]
    const chart = chartInstanceRef.current
    actions.forEach((action) => chart?.subscribeAction(action, scheduleUpdatePosition))
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      actions.forEach((action) => chart?.unsubscribeAction(action, scheduleUpdatePosition))
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
    dpoPaneHeightObserverRef.current?.disconnect()
    vdoPaneHeightObserverRef.current?.disconnect()
    tsiPaneHeightObserverRef.current?.disconnect()
    viPaneHeightObserverRef.current?.disconnect()
    aoPaneHeightObserverRef.current?.disconnect()
    vmiPaneHeightObserverRef.current?.disconnect()
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
