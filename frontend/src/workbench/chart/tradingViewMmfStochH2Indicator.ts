import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams } from 'klinecharts'
import {
  defaultMmfStochH2IndicatorSettings,
  type MmfStochH2IndicatorSettings,
} from '../rightDrawer/indicatorPersistence'
import { normalizeMmfStochH2Settings } from '../rightDrawer/indicatorSettingsSchema'
import type { MmfStochH2IndicatorRow } from './indicatorRequestV2/mmfStochH2IndicatorV2'

export type { MmfStochH2IndicatorRow }

export const tradingViewMmfStochH2IndicatorName = 'MMF_STOCH_H2'

let registered = false

type MmfStochH2RuntimeContext = {
  settings?: Partial<MmfStochH2IndicatorSettings>
  staticRows?: MmfStochH2IndicatorRow[]
}

type MarkerSpec = {
  color: (settings: MmfStochH2IndicatorSettings) => string
  markerKey: keyof Pick<MmfStochH2IndicatorRow, 'enterOverboughtMarker' | 'closeOverboughtMarker' | 'enterOversoldMarker' | 'closeOversoldMarker'>
  priceKey: keyof Pick<MmfStochH2IndicatorRow, 'enterOverboughtMarkerPrice' | 'closeOverboughtMarkerPrice' | 'enterOversoldMarkerPrice' | 'closeOversoldMarkerPrice'>
  show: (settings: MmfStochH2IndicatorSettings) => boolean
  size: (settings: MmfStochH2IndicatorSettings) => number
  symbol: (settings: MmfStochH2IndicatorSettings) => string
  textBaseline: CanvasTextBaseline
  title: string
  yDirection: -1 | 1
}

const markerSpecs: MarkerSpec[] = [
  {
    color: (settings) => settings.enterOverboughtColor,
    markerKey: 'enterOverboughtMarker',
    priceKey: 'enterOverboughtMarkerPrice',
    show: (settings) => settings.showEnterOverbought,
    size: (settings) => settings.enterOverboughtSize,
    symbol: (settings) => settings.enterOverboughtSymbol,
    textBaseline: 'bottom',
    title: '进入超买 ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.closeOverboughtColor,
    markerKey: 'closeOverboughtMarker',
    priceKey: 'closeOverboughtMarkerPrice',
    show: (settings) => settings.showCloseOverbought,
    size: (settings) => settings.closeOverboughtSize,
    symbol: (settings) => settings.closeOverboughtSymbol,
    textBaseline: 'bottom',
    title: '关闭超买 ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.enterOversoldColor,
    markerKey: 'enterOversoldMarker',
    priceKey: 'enterOversoldMarkerPrice',
    show: (settings) => settings.showEnterOversold,
    size: (settings) => settings.enterOversoldSize,
    symbol: (settings) => settings.enterOversoldSymbol,
    textBaseline: 'top',
    title: '进入超卖 ',
    yDirection: 1,
  },
  {
    color: (settings) => settings.closeOversoldColor,
    markerKey: 'closeOversoldMarker',
    priceKey: 'closeOversoldMarkerPrice',
    show: (settings) => settings.showCloseOversold,
    size: (settings) => settings.closeOversoldSize,
    symbol: (settings) => settings.closeOversoldSymbol,
    textBaseline: 'top',
    title: '关闭超卖 ',
    yDirection: 1,
  },
]

function normalizeRuntimeContext(input: unknown) {
  const context = input && typeof input === 'object' ? input as MmfStochH2RuntimeContext : {}
  return {
    settings: normalizeMmfStochH2Settings(context.settings),
    staticRows: Array.isArray(context.staticRows) ? context.staticRows : null,
  }
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<MmfStochH2IndicatorRow>) {
  const crosshairIndex = Number(params.crosshair?.dataIndex)
  if (Number.isFinite(crosshairIndex)) return Math.max(0, Math.min(params.indicator.result.length - 1, Math.round(crosshairIndex)))
  return Math.max(0, params.indicator.result.length - 1)
}

function clampMarkerSize(value: unknown, fallback = 16) {
  const size = Math.round(Number(value))
  return Number.isFinite(size) ? Math.max(8, Math.min(size, 96)) : fallback
}

function resolveBaseMarkerOffset(size: number) {
  return Math.max(4, Math.round(size * 0.75))
}

function resolveMarkerOffset(size: number, direction: -1 | 1, stackIndex: number) {
  return direction * (resolveBaseMarkerOffset(size) + Math.round(size * 0.85 * stackIndex))
}

function drawMmfStochH2Markers({
  ctx,
  indicator,
  visibleRange,
  xAxis,
  yAxis,
}: {
  ctx: CanvasRenderingContext2D
  indicator: { calcParams: unknown[]; result: MmfStochH2IndicatorRow[] }
  visibleRange: { from: number; to: number }
  xAxis: { convertToPixel: (value: number) => number }
  yAxis: { convertToPixel: (value: number) => number }
}) {
  const context = normalizeRuntimeContext(indicator.calcParams[0])
  const settings = context.settings
  const start = Math.max(0, Math.floor(visibleRange.from) - 2)
  const end = Math.min(indicator.result.length - 1, Math.ceil(visibleRange.to) + 2)
  const visibleSpecs = markerSpecs.filter((spec) => spec.show(settings))

  for (let index = start; index <= end; index += 1) {
    const row = indicator.result[index]
    if (!row) continue
    const stackByDirection: Record<-1 | 1, number> = { [-1]: 0, 1: 0 }
    visibleSpecs.forEach((spec) => {
      const marker = row[spec.markerKey]
      if (!Number.isFinite(marker)) return
      const size = clampMarkerSize(spec.size(settings))
      const x = xAxis.convertToPixel(index)
      const stackIndex = stackByDirection[spec.yDirection]
      stackByDirection[spec.yDirection] += 1
      const y = yAxis.convertToPixel(marker as number) + resolveMarkerOffset(size, spec.yDirection, stackIndex)

      ctx.save()
      ctx.fillStyle = spec.color(settings)
      ctx.font = `${size}px Arial, Tahoma, 'Segoe UI Symbol', 'Segoe UI', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = spec.textBaseline
      ctx.fillText(spec.symbol(settings), x, y)
      ctx.restore()
    })
  }
}

function createTooltipValues(row: MmfStochH2IndicatorRow | undefined, settings: MmfStochH2IndicatorSettings, textColor: string) {
  return markerSpecs.flatMap((spec) => {
    const price = row?.[spec.priceKey]
    if (!spec.show(settings) || !Number.isFinite(price)) return []
    return [{
      title: { text: spec.title, color: textColor },
      value: { text: String(price), color: spec.color(settings) },
    }]
  })
}

export function ensureTradingViewMmfStochH2Indicator() {
  if (registered) return
  registered = true

  registerIndicator<MmfStochH2IndicatorRow>({
    name: tradingViewMmfStochH2IndicatorName,
    shortName: 'MMF-Stoch-H2',
    calcParams: [{ settings: defaultMmfStochH2IndicatorSettings }],
    series: IndicatorSeries.Price,
    createTooltipDataSource: (params) => {
      const context = normalizeRuntimeContext(params.indicator.calcParams[0])
      const row = params.indicator.result[resolveTooltipIndex(params)]
      return {
        name: 'MMF-Stoch-H2',
        calcParamsText: '',
        icons: [],
        values: createTooltipValues(row, context.settings, params.defaultStyles.tooltip.text.color),
      }
    },
    draw: (params) => {
      drawMmfStochH2Markers(params)
      return true
    },
    calc: (dataList, indicator) => {
      const context = normalizeRuntimeContext(indicator.calcParams[0])
      if (context.staticRows && context.staticRows.length === dataList.length) return context.staticRows
      return dataList.map(() => ({}))
    },
  })
}
