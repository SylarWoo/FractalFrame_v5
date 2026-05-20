import { useEffect, useRef, useState } from 'react'
import { ActionType, LineType, LoadDataType, YAxisType, dispose, init } from 'klinecharts'
import type { CandleTooltipCustomCallbackData, Chart, KLineData } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { repairStoreV5M1Gaps } from '../../services/mt5/mt5SymbolsApi'
import { readSettingsNumberStringValue, readSettingsStringValue, readSettingsSymbolState, settingsSymbolChangedEvent } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { chartError, chartInfo, chartWarn } from './chartLogger'
import { formatChartDate, readChartTimezone, resolvePeriodSeconds } from './chartTimeFormatting'
import { applySessionBreakIndicator } from './sessionBreakIndicator'
import './ChartCoreHost.css'

const initialLoadLimit = 10_000
const maxInitialLoadLimit = 20_000
const historyPageSize = 10_000
const jumpWindowBars = 50_000
const realtimeTailRepairLookbackMinutes = 30
const realtimeTailRepairMaxGapMinutes = 30
const chartNumberFontFamily = '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, Arial, sans-serif'
const chartNumberFontWeight = 400
type ChartCoreHostProps = {
  displayName?: string
  jump?: { id: number; timestamp?: number } | null
  limit?: number
  onLoadStateChange?: (state: ChartLoadState) => void
  period: string
  reloadId?: number
  stepLoad?: { direction: 'left' | 'right'; id: number } | null
  symbol: string
  totalRows?: number | null
}

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

type Mt5RealtimeTickEventDetail = {
  ask?: number | null
  bid?: number | null
  last?: number | null
  symbol: string
  time?: number | null
  volume?: number | null
}

function resolveInitialLimit(limit?: number) {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return initialLoadLimit
  }
  return Math.max(1, Math.min(Math.round(limit), maxInitialLoadLimit))
}

function readSymbolLabelVisibleParts() {
  const visibleParts = readSettingsSymbolState()['coordinates.symbolLabel.visibleParts']
  return Array.isArray(visibleParts)
    ? visibleParts.filter((value): value is string => typeof value === 'string')
    : ['value', 'line']
}

function resolveHasMoreOlder(options: {
  loadedRows: number
  pageSize: number
  receivedRows: number
  totalRows?: number | null
}) {
  if (options.receivedRows < options.pageSize) return false
  if (typeof options.totalRows === 'number' && Number.isFinite(options.totalRows)) {
    return options.loadedRows < options.totalRows
  }
  return true
}

function readAxisTextSize() {
  const raw = readSettingsStringValue('layout.axisText.size', '12')
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 24)) : 12
}

function readAxisTextColor() {
  return resolveSwatchColor(readSettingsSymbolState()['layout.axisText.color'], '#5f6675')
}

function readAxisLineColor() {
  return resolveSwatchColor(readSettingsSymbolState()['layout.axisLine.color'], '#858b98')
}

function resetYAxisAutoScale(chart: Chart) {
  const axisLineColor = readAxisLineColor()

  chart.setStyles({
    yAxis: {
      axisLine: {
        color: axisLineColor,
        show: true,
        size: 1,
      },
      size: 'auto',
      tickLine: {
        color: axisLineColor,
        length: 3,
        show: true,
        size: 1,
      },
      tickText: {
        color: readAxisTextColor(),
        family: chartNumberFontFamily,
        marginEnd: 10,
        marginStart: 7,
        size: readAxisTextSize(),
        weight: chartNumberFontWeight,
      },
      type: YAxisType.Normal,
    },
  })
}

type SettingsSwatchValue = {
  hex?: string
  lineStyle?: string
  opacity?: number
  thickness?: number
}

function resolveSwatchColor(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object' || !('hex' in value)) return fallback
  const swatch = value as SettingsSwatchValue
  const hex = typeof swatch.hex === 'string' ? swatch.hex : fallback
  const opacity = typeof swatch.opacity === 'number' && Number.isFinite(swatch.opacity)
    ? Math.max(0, Math.min(swatch.opacity, 1))
    : 1
  if (opacity >= 0.999) return hex
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

function readCandleBarStyle() {
  const state = readSettingsSymbolState()

  const bodyUp = resolveSwatchColor(state['candle.body.up'], '#26a69a')
  const bodyDown = resolveSwatchColor(state['candle.body.down'], '#ef5350')
  const borderUp = resolveSwatchColor(state['candle.border.up'], bodyUp)
  const borderDown = resolveSwatchColor(state['candle.border.down'], bodyDown)
  const wickUp = resolveSwatchColor(state['candle.wick.up'], bodyUp)
  const wickDown = resolveSwatchColor(state['candle.wick.down'], bodyDown)

  return {
    upColor: bodyUp,
    downColor: bodyDown,
    noChangeColor: '#888888',
    upBorderColor: borderUp,
    downBorderColor: borderDown,
    noChangeBorderColor: '#888888',
    upWickColor: wickUp,
    downWickColor: wickDown,
    noChangeWickColor: '#888888',
  }
}

function resolveCandleValueColor(data: KLineData, barStyle: ReturnType<typeof readCandleBarStyle>) {
  const open = Number(data.open)
  const close = Number(data.close)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close === open) return barStyle.noChangeColor
  return close > open ? barStyle.upColor : barStyle.downColor
}

function readPricePrecision() {
  const raw = readSettingsNumberStringValue(chartSettingKeys.pricePrecision, chartSettingDefaults.pricePrecision)
  if (raw === 'system') return 3
  const precision = typeof raw === 'string' ? Number(raw) : 6
  return Number.isFinite(precision) ? Math.max(0, Math.min(Math.round(precision), 7)) : 6
}

function readHighLowTextSize() {
  const raw = readSettingsStringValue('coordinates.highLow.textSize', '12')
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 24)) : 12
}

function applyCandleBarStyle(chart: Chart) {
  chart.setStyles({
    candle: {
      bar: readCandleBarStyle(),
    },
  })
}

function applyPriceVolumePrecision(chart: Chart) {
  chart.setPriceVolumePrecision(readPricePrecision(), 0)
}

function applyGridStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const mode = typeof state['layout.grid.mode'] === 'string' ? state['layout.grid.mode'] : 'both'
  const verticalColor = resolveSwatchColor(state['layout.grid.vertical.color'], '#eef2f7')
  const horizontalColor = resolveSwatchColor(state['layout.grid.horizontal.color'], '#eef2f7')
  const showVertical = mode === 'both' || mode === 'vertical'
  const showHorizontal = mode === 'both' || mode === 'horizontal'

  chart.setStyles({
    grid: {
      show: showVertical || showHorizontal,
      horizontal: {
        color: horizontalColor,
        dashedValue: [2, 2],
        show: showHorizontal,
        size: 1,
        style: LineType.Solid,
      },
      vertical: {
        color: verticalColor,
        dashedValue: [2, 2],
        show: showVertical,
        size: 1,
        style: LineType.Solid,
      },
    },
  })
}

function resolveLineStyle(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsSwatchValue : null
  const lineStyle = swatch?.lineStyle
  if (lineStyle === 'dashed') return { dashedValue: [6, 4], style: LineType.Dashed }
  if (lineStyle === 'dotted') return { dashedValue: [1, 3], style: LineType.Dashed }
  return { dashedValue: [2, 2], style: LineType.Solid }
}

function resolveLineThickness(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsSwatchValue : null
  const thickness = typeof swatch?.thickness === 'number' && Number.isFinite(swatch.thickness) ? swatch.thickness : 1
  return Math.max(1, Math.min(Math.round(thickness), 4))
}

function applyCrosshairLineStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const swatch = state['layout.crosshair.color']
  const color = resolveSwatchColor(swatch, '#e91e63')
  const line = resolveLineStyle(swatch)
  const size = resolveLineThickness(swatch)

  chart.setStyles({
    crosshair: {
      horizontal: {
        line: {
          color,
          dashedValue: line.dashedValue,
          show: true,
          size,
          style: line.style,
        },
      },
      vertical: {
        line: {
          color,
          dashedValue: line.dashedValue,
          show: true,
          size,
          style: line.style,
        },
      },
    },
  })
}

function applyAxisTextStyle(chart: Chart) {
  const color = readAxisTextColor()
  const size = readAxisTextSize()

  chart.setStyles({
    xAxis: {
      tickText: {
        color,
        family: chartNumberFontFamily,
        marginEnd: 4,
        marginStart: 4,
        size,
        weight: chartNumberFontWeight,
      },
    },
    yAxis: {
      tickText: {
        color,
        family: chartNumberFontFamily,
        marginEnd: 10,
        marginStart: 7,
        size,
        weight: chartNumberFontWeight,
      },
    },
  })
}

function applyAxisLineStyle(chart: Chart) {
  const color = readAxisLineColor()

  chart.setStyles({
    xAxis: {
      axisLine: {
        color,
        show: true,
        size: 1,
      },
      tickLine: {
        color,
        length: 3,
        show: true,
        size: 1,
      },
    },
    yAxis: {
      axisLine: {
        color,
        show: true,
        size: 1,
      },
      tickLine: {
        color,
        length: 3,
        show: true,
        size: 1,
      },
    },
  })
}

function applyLastPriceLineStyle(chart: Chart) {
  const selectedParts = readSymbolLabelVisibleParts()
  const barStyle = readCandleBarStyle()
  const highLowParts = readSettingsSymbolState()['coordinates.highLow.visibleParts']
  const selectedHighLowParts = Array.isArray(highLowParts)
    ? highLowParts.filter((value): value is string => typeof value === 'string')
    : []
  const highLowTextSize = readHighLowTextSize()

  chart.setStyles({
    candle: {
      priceMark: {
        high: {
          color: '#131722',
          show: selectedHighLowParts.includes('high'),
          textFamily: chartNumberFontFamily,
          textSize: highLowTextSize,
          textWeight: String(chartNumberFontWeight),
        },
        last: {
          downColor: barStyle.downColor,
          line: {
            dashedValue: [2, 2],
            show: selectedParts.includes('line'),
            size: 1,
            style: LineType.Dashed,
          },
          noChangeColor: barStyle.noChangeColor,
          text: {
            borderRadius: 0,
            family: chartNumberFontFamily,
            show: selectedParts.includes('value'),
            paddingBottom: 2,
            paddingLeft: 6,
            paddingRight: 7,
            paddingTop: 4,
            weight: chartNumberFontWeight,
          },
          upColor: barStyle.upColor,
        },
        low: {
          color: '#131722',
          show: selectedHighLowParts.includes('low'),
          textFamily: chartNumberFontFamily,
          textSize: highLowTextSize,
          textWeight: String(chartNumberFontWeight),
        },
      },
    },
  })
}

function mergeKLineData(...sets: KLineData[][]): KLineData[] {
  const rowsByTimestamp = new Map<number, KLineData>()
  sets.forEach((rows) => {
    rows.forEach((row) => {
      const timestamp = Number(row.timestamp)
      if (!Number.isFinite(timestamp)) return
      rowsByTimestamp.set(timestamp, { ...row, timestamp })
    })
  })
  return [...rowsByTimestamp.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}

function resolveStatusTitle(symbol: string, displayName?: string) {
  const mode = readSettingsStringValue(chartSettingKeys.statusTitleMode, chartSettingDefaults.statusTitleMode)
  const name = displayName?.trim() || symbol
  if (mode === 'symbol') return symbol
  if (mode === 'name') return name
  return `${symbol} · ${name}`
}

function applyCandleTooltipStyle(chart: Chart, symbol: string, period: string, displayName?: string) {
  const settings = readSettingsSymbolState()
  const chartValuesVisible = settings[chartSettingKeys.statusChartValuesVisible] !== false
  const candleChangeVisible = settings[chartSettingKeys.statusCandleChangeVisible] !== false
  const candleTimeVisible = settings[chartSettingKeys.statusCandleTimeVisible] !== false
  const barStyle = readCandleBarStyle()

  chart.setStyles({
    candle: {
      bar: barStyle,
      tooltip: {
        custom: ({ current }: CandleTooltipCustomCallbackData) => {
          const priceColor = resolveCandleValueColor(current, barStyle)
          return [
            {
              title: `${resolveStatusTitle(symbol, displayName)} ${period}${chartValuesVisible ? '  O: ' : ''}`,
              value: chartValuesVisible ? { text: '{open}', color: priceColor } : '',
            },
            ...(chartValuesVisible
              ? [
                  { title: 'H: ', value: { text: '{high}', color: priceColor } },
                  { title: 'L: ', value: { text: '{low}', color: priceColor } },
                  { title: 'C: ', value: { text: '{close}', color: priceColor } },
                ]
              : []),
            ...(candleChangeVisible ? [{ title: 'Chg: ', value: '{change}' }] : []),
            { title: 'Volume: ', value: '{volume}' },
            ...(candleTimeVisible ? [{ title: 'Time: ', value: '{time}' }] : []),
          ]
        },
      },
    },
  })
}

export function ChartCoreHost({ displayName, jump, limit, onLoadStateChange, period, reloadId, stepLoad, symbol, totalRows }: ChartCoreHostProps) {
  const chartInstanceRef = useRef<Chart | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const requestSeqRef = useRef(0)
  const realtimeTailRefreshInFlightRef = useRef(false)
  const realtimeTailRefreshBucketRef = useRef<number | null>(null)
  const [loadState, setLoadState] = useState({
    error: false,
    loadingMore: false,
    loading: false,
    requestedRows: resolveInitialLimit(limit),
    rows: 0,
  })

  useEffect(() => {
    onLoadStateChange?.({
      ...loadState,
      period,
      symbol,
      totalRows,
    })
  }, [loadState, onLoadStateChange, period, symbol, totalRows])

  useEffect(() => {
    if (!chartRef.current) return

    const container = chartRef.current
    const chart = init(container, {
      customApi: {
        formatDate: formatChartDate,
      },
      timezone: readChartTimezone(),
      styles: {
        grid: {
          horizontal: {
            color: '#eef2f7',
            dashedValue: [2, 2],
            show: true,
            size: 1,
            style: LineType.Solid,
          },
          vertical: {
            color: '#eef2f7',
            dashedValue: [2, 2],
            show: true,
            size: 1,
            style: LineType.Solid,
          },
        },
        crosshair: {
          horizontal: {
            text: {
              backgroundColor: '#131722',
              borderColor: '#131722',
              borderRadius: 0,
              color: '#ffffff',
              family: chartNumberFontFamily,
              paddingBottom: 2,
              paddingLeft: 6,
              paddingRight: 7,
              paddingTop: 4,
              weight: chartNumberFontWeight,
            },
          },
          vertical: {
            text: {
              backgroundColor: '#131722',
              borderColor: '#131722',
              borderRadius: 0,
              color: '#ffffff',
              family: chartNumberFontFamily,
              paddingBottom: 3,
              paddingLeft: 9,
              paddingRight: 9,
              paddingTop: 8,
              weight: chartNumberFontWeight,
            },
          },
        },
        xAxis: {
          axisLine: {
            color: readAxisLineColor(),
            show: true,
            size: 1,
          },
          size: 27,
          tickLine: {
            color: readAxisLineColor(),
            length: 3,
            show: true,
            size: 1,
          },
          tickText: {
            color: readAxisTextColor(),
            family: chartNumberFontFamily,
            marginEnd: 4,
            marginStart: 4,
            size: readAxisTextSize(),
            weight: chartNumberFontWeight,
          },
        },
        yAxis: {
          axisLine: {
            color: readAxisLineColor(),
            show: true,
            size: 1,
          },
          size: 'auto',
          tickLine: {
            color: readAxisLineColor(),
            length: 3,
            show: true,
            size: 1,
          },
          tickText: {
            color: readAxisTextColor(),
            family: chartNumberFontFamily,
            marginEnd: 10,
            marginStart: 7,
            size: readAxisTextSize(),
            weight: chartNumberFontWeight,
          },
        },
      },
    })

    if (chart) {
      applyPriceVolumePrecision(chart)
      applyGridStyle(chart)
      applyCrosshairLineStyle(chart)
      applyAxisTextStyle(chart)
      applyAxisLineStyle(chart)
      applyCandleBarStyle(chart)
      applyLastPriceLineStyle(chart)
      applySessionBreakIndicator(chart, symbol, period)
    }
    chartInstanceRef.current = chart ?? null

    const resize = () => {
      chart?.resize()
    }

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(resize)
    })

    resizeObserver.observe(container)
    window.addEventListener('resize', resize)
    window.requestAnimationFrame(() => {
      resize()
    })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
      chartInstanceRef.current = null

      if (chart) {
        dispose(chart)
      }
    }
  }, [])

  useEffect(() => {
    const apply = () => {
      const chart = chartInstanceRef.current
        if (chart) {
          chart.setTimezone(readChartTimezone())
          chart.setCustomApi({ formatDate: formatChartDate })
          applyPriceVolumePrecision(chart)
          applyGridStyle(chart)
          applyCrosshairLineStyle(chart)
          applyAxisTextStyle(chart)
          applyAxisLineStyle(chart)
          applyCandleTooltipStyle(chart, symbol, period, displayName)
          applyLastPriceLineStyle(chart)
          applySessionBreakIndicator(chart, symbol, period)
        }
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

  useEffect(() => {
    let disposed = false
    const chart = chartInstanceRef.current
    const requestSeq = requestSeqRef.current + 1
    const requestedRows = resolveInitialLimit(limit)
    let fallbackTimer: number | undefined
    requestSeqRef.current = requestSeq

    if (!chart) return

    const finishLoaded = () => {
      if (disposed || requestSeqRef.current !== requestSeq) return

        setLoadState({
          error: false,
          loadingMore: false,
          loading: false,
          requestedRows,
          rows: chart.getDataList().length,
        })
      }

    chart.unsubscribeAction(ActionType.OnDataReady)
    chart.subscribeAction(ActionType.OnDataReady, finishLoaded)

    setLoadState({
      error: false,
      loadingMore: false,
      loading: true,
      requestedRows,
      rows: 0,
    })

    chart.setLoadDataCallback(({ type, data, callback }) => {
      if (disposed || requestSeqRef.current !== requestSeq) {
        callback([], false)
        return
      }

      if (type !== LoadDataType.Forward || !data) {
        callback([], false)
        return
      }

      setLoadState((current) => ({
        ...current,
        error: false,
        loadingMore: true,
      }))

      const timeTo = Math.floor(data.timestamp / 1000) - 1
      chartInfo('[StoreV5Datafeed] request older start', {
        symbol,
        period,
        limit: historyPageSize,
        timeTo,
      })

      loadStoreV5KLineData({ symbol, period, limit: historyPageSize, timeTo })
        .then((olderData) => {
          if (disposed || requestSeqRef.current !== requestSeq) {
            callback([], false)
            return
          }

          const loadedRows = chart.getDataList().length + olderData.length
          const hasMoreOlder = resolveHasMoreOlder({
            loadedRows,
            pageSize: historyPageSize,
            receivedRows: olderData.length,
            totalRows,
          })

          chartInfo('[StoreV5Datafeed] callback older done', {
            rows: olderData.length,
            hasMoreOlder,
          })
          callback(olderData, hasMoreOlder)

          window.setTimeout(() => {
            if (disposed || requestSeqRef.current !== requestSeq) return
            applySessionBreakIndicator(chart, symbol, period)
            setLoadState({
              error: false,
              loading: false,
              loadingMore: false,
              requestedRows,
              rows: chart.getDataList().length,
            })
          }, 0)
        })
        .catch((error: unknown) => {
          if (disposed || requestSeqRef.current !== requestSeq) {
            callback([], false)
            return
          }

          chartError('[StoreV5Datafeed] request older failed', error)
          callback([], false)
          setLoadState((current) => ({
            ...current,
            error: true,
            loading: false,
            loadingMore: false,
            rows: chart.getDataList().length,
          }))
        })
    })

    if (jump?.timestamp != null) {
      const periodSeconds = resolvePeriodSeconds(period)
      const halfWindowSeconds = Math.floor(jumpWindowBars / 2) * periodSeconds
      const targetSeconds = Math.floor(jump.timestamp / 1000)
      const timeFrom = targetSeconds - halfWindowSeconds
      const timeTo = targetSeconds + halfWindowSeconds

      chartInfo('[StoreV5Datafeed] request jump start', {
        symbol,
        period,
        limit: jumpWindowBars,
        timeFrom,
        timeTo,
      })

      loadStoreV5KLineData({ symbol, period, limit: jumpWindowBars, timeFrom, timeTo })
        .then((data) => {
          if (disposed || requestSeqRef.current !== requestSeq) return

          const hasMoreOlder = data.length >= jumpWindowBars
          chartInfo('[StoreV5Datafeed] callback jump done', {
            rows: data.length,
            target: jump.timestamp,
            hasMoreOlder,
          })
          chart.applyNewData(data, hasMoreOlder)
          fallbackTimer = window.setTimeout(() => {
            if (disposed || requestSeqRef.current !== requestSeq) return
            resetYAxisAutoScale(chart)
            chart.scrollToTimestamp(jump.timestamp as number, 0)
            applySessionBreakIndicator(chart, symbol, period)
            window.setTimeout(() => {
              if (disposed || requestSeqRef.current !== requestSeq) return
              resetYAxisAutoScale(chart)
              applySessionBreakIndicator(chart, symbol, period)
            }, 0)
            setLoadState({
              error: false,
              loadingMore: false,
              loading: false,
              requestedRows: jumpWindowBars,
              rows: chart.getDataList().length || data.length,
            })
          }, 0)
        })
        .catch((error: unknown) => {
          if (disposed || requestSeqRef.current !== requestSeq) return

          chartError('[StoreV5Datafeed] request jump failed', error)
          chart.applyNewData([], false)
          setLoadState({
            error: true,
            loadingMore: false,
            loading: false,
            requestedRows: jumpWindowBars,
            rows: 0,
          })
        })

      return () => {
        disposed = true
        chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
        chart.setLoadDataCallback(({ callback }) => callback([], false))
        if (fallbackTimer !== undefined) {
          window.clearTimeout(fallbackTimer)
        }
      }
    }

    chartInfo('[StoreV5Datafeed] request init start', {
      symbol,
      period,
      limit: requestedRows,
    })

    loadStoreV5KLineData({ symbol, period, limit: requestedRows })
      .then((data) => {
        if (disposed || requestSeqRef.current !== requestSeq) return

        const hasMoreOlder = resolveHasMoreOlder({
          loadedRows: data.length,
          pageSize: requestedRows,
          receivedRows: data.length,
          totalRows,
        })
        chartInfo('[StoreV5Datafeed] callback init done', {
          rows: data.length,
          hasMoreOlder,
        })
        chart.applyNewData(data, hasMoreOlder)
        fallbackTimer = window.setTimeout(() => {
          if (disposed || requestSeqRef.current !== requestSeq) return
          resetYAxisAutoScale(chart)
          applySessionBreakIndicator(chart, symbol, period)

          setLoadState({
            error: false,
            loadingMore: false,
            loading: false,
            requestedRows,
            rows: chart.getDataList().length || data.length,
          })
        }, 0)
      })
      .catch(() => {
        if (disposed || requestSeqRef.current !== requestSeq) return

        chart.applyNewData([], false)
        setLoadState({
          error: true,
          loadingMore: false,
          loading: false,
          requestedRows,
          rows: 0,
        })
      })

    return () => {
      disposed = true
      chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
      chart.setLoadDataCallback(({ callback }) => callback([], false))
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer)
      }
    }
  }, [jump?.id, jump?.timestamp, limit, period, reloadId, symbol, totalRows])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    realtimeTailRefreshInFlightRef.current = false
    realtimeTailRefreshBucketRef.current = null

    const refreshRealtimeTail = async (bucketTimestamp: number) => {
      if (period.trim().toUpperCase() !== '1M' && period.trim().toUpperCase() !== 'M1') return
      if (realtimeTailRefreshInFlightRef.current) return

      realtimeTailRefreshInFlightRef.current = true
      try {
        await repairStoreV5M1Gaps(symbol, {
          lookbackMinutes: realtimeTailRepairLookbackMinutes,
          maxGapMinutes: realtimeTailRepairMaxGapMinutes,
        })

        const timeTo = Math.floor(bucketTimestamp / 1000) + 60
        const timeFrom = timeTo - realtimeTailRepairLookbackMinutes * 60
        const tailData = await loadStoreV5KLineData({
          symbol,
          period,
          limit: realtimeTailRepairLookbackMinutes + 5,
          timeFrom,
          timeTo,
        })
        if (!tailData.length) return

        const currentData = chart.getDataList()
        const merged = mergeKLineData(currentData, tailData)
        const hasMoreOlder = typeof totalRows === 'number' && Number.isFinite(totalRows)
          ? merged.length < totalRows
          : currentData.length >= historyPageSize
        chart.applyNewData(merged, hasMoreOlder)
      } catch (error) {
        chartWarn('[StoreV5Datafeed] realtime tail refresh failed', error)
      } finally {
        realtimeTailRefreshInFlightRef.current = false
      }
    }

    const handleRealtimeTick = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as Partial<Mt5RealtimeTickEventDetail> : null
      if (!detail || detail.symbol !== symbol) return

      const last = typeof detail.last === 'number' && Number.isFinite(detail.last)
        ? detail.last
        : typeof detail.bid === 'number' && typeof detail.ask === 'number'
          ? (detail.bid + detail.ask) / 2
          : detail.bid ?? detail.ask
      if (typeof last !== 'number' || !Number.isFinite(last)) return

      const tickSeconds = typeof detail.time === 'number' && Number.isFinite(detail.time)
        ? Math.floor(detail.time)
        : Math.floor(Date.now() / 1000)
      const periodSeconds = resolvePeriodSeconds(period)
      const bucketTimestamp = Math.floor(tickSeconds / periodSeconds) * periodSeconds * 1000
      const currentData = chart.getDataList()
      const latest = currentData[currentData.length - 1]
      const volume = typeof detail.volume === 'number' && Number.isFinite(detail.volume) ? detail.volume : 0

      if (!latest || bucketTimestamp > latest.timestamp) {
        if (realtimeTailRefreshBucketRef.current !== bucketTimestamp) {
          realtimeTailRefreshBucketRef.current = bucketTimestamp
          void refreshRealtimeTail(bucketTimestamp)
        }
          chart.updateData({
            timestamp: bucketTimestamp,
            open: latest?.close ?? last,
            high: last,
            low: last,
            close: last,
            volume,
          })
          return
        }

        if (bucketTimestamp === latest.timestamp) {
          chart.updateData({
          ...latest,
          high: Math.max(Number(latest.high), last),
          low: Math.min(Number(latest.low), last),
            close: last,
            volume: Math.max(Number(latest.volume ?? 0), volume),
          })
        }
      }

    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    return () => window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
  }, [period, symbol, totalRows])

  useEffect(() => {
    if (!stepLoad) return

    const chart = chartInstanceRef.current
    if (!chart) return

    let disposed = false
    const currentData = chart.getDataList()
    if (!currentData.length) return

    setLoadState((current) => ({
      ...current,
      error: false,
      loadingMore: true,
    }))

    const oldest = currentData[0]
    const newest = currentData[currentData.length - 1]
    const options = stepLoad.direction === 'left'
      ? {
          limit: historyPageSize,
          period,
          symbol,
          timeTo: Math.floor(oldest.timestamp / 1000) - 1,
        }
      : {
          limit: historyPageSize,
          period,
          symbol,
          timeFrom: Math.floor(newest.timestamp / 1000) + 1,
        }

    chartInfo('[StoreV5Datafeed] request manual step start', {
      direction: stepLoad.direction,
      ...options,
    })

    loadStoreV5KLineData(options)
      .then((data) => {
        if (disposed) return

        const merged = stepLoad.direction === 'left'
          ? mergeKLineData(data, chart.getDataList())
          : mergeKLineData(chart.getDataList(), data)
        const hasMoreOlder = resolveHasMoreOlder({
          loadedRows: merged.length,
          pageSize: historyPageSize,
          receivedRows: stepLoad.direction === 'left' ? data.length : historyPageSize,
          totalRows,
        })

        chartInfo('[StoreV5Datafeed] callback manual step done', {
          direction: stepLoad.direction,
          rows: data.length,
          mergedRows: merged.length,
        })
        const targetTimestamp = stepLoad.direction === 'left'
          ? data[Math.floor(data.length / 2)]?.timestamp
          : data[Math.max(0, data.length - Math.floor(data.length / 2) - 1)]?.timestamp
        chart.applyNewData(merged, hasMoreOlder)
        window.setTimeout(() => {
          if (disposed) return
          resetYAxisAutoScale(chart)
          applySessionBreakIndicator(chart, symbol, period)
          if (typeof targetTimestamp === 'number') {
            chart.scrollToTimestamp(targetTimestamp, 0)
          }
          setLoadState((current) => ({
            ...current,
            error: false,
            loading: false,
            loadingMore: false,
            requestedRows: current.requestedRows,
            rows: chart.getDataList().length || merged.length,
          }))
        }, 0)
      })
      .catch((error: unknown) => {
        if (disposed) return

        chartError('[StoreV5Datafeed] request manual step failed', error)
        setLoadState((current) => ({
          ...current,
          error: true,
          loading: false,
          loadingMore: false,
          rows: chart.getDataList().length,
        }))
      })

    return () => {
      disposed = true
    }
  }, [period, stepLoad, symbol, totalRows])

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
    </section>
  )
}




