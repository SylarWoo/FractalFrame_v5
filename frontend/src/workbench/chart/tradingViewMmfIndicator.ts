import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultDpoIndicatorSettings, defaultMmfIndicatorSettings, defaultStochIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { calculateMorganRangeSegments, getMorganRangeLevel } from './morganRangeModel'
import type { MorganRangeSegment } from './morganRangeModel'
import { calculateTradingViewDpoRows } from './tradingViewDpoIndicator'
import { calculateTradingViewStochRows } from './tradingViewStochIndicator'

export type MmfIndicatorRow = {
  highMarker?: number
  highMarkerPrice?: number
}

type MmfHighActiveState = {
  confirmCrossIndex: number | null
  confirmThreshold: number | null
  highestHigh: number
  highestHighIndex: number
  startIndex: number
}

let registered = false

function normalizeMmfSettings(input?: Partial<MmfIndicatorSettings>): MmfIndicatorSettings {
  return { ...defaultMmfIndicatorSettings, ...(input ?? {}) }
}

function clampMarkerSize(value: unknown) {
  const size = Math.round(Number(value))
  return Number.isFinite(size) ? Math.max(8, Math.min(size, 96)) : defaultMmfIndicatorSettings.highSize
}

function resolveAdjustedMorganRatio(settings: MmfIndicatorSettings) {
  const selected = Number(settings.highMorganRatio)
  if (!Number.isFinite(selected)) return 0.118
  const offset = Math.max(-99, Math.min(Math.round(Number(settings.highOffsetPercent)), 99))
  if (offset === 0) return selected

  const upperRatios = [0.059, 0.118, 0.177, 0.236, 0.309]
  const index = upperRatios.findIndex((ratio) => Math.abs(ratio - selected) < 0.0005)
  if (index < 0) return selected
  const target = offset > 0
    ? upperRatios[Math.max(0, index - 1)]
    : upperRatios[Math.min(upperRatios.length - 1, index + 1)]

  return selected + (target - selected) * (Math.abs(offset) / 100)
}

function resolveConfirmThresholdByBearishCross(k: number, d: number) {
  const crossLevel = Math.max(k, d)
  if (crossLevel >= 80) return 75
  if (crossLevel >= 70 && crossLevel < 80) return 65
  if (crossLevel >= 60 && crossLevel < 70) return 55
  return null
}

function isBearishStochCross(
  previousK: number | undefined,
  previousD: number | undefined,
  k: number | undefined,
  d: number | undefined,
) {
  return Number.isFinite(previousK)
    && Number.isFinite(previousD)
    && Number.isFinite(k)
    && Number.isFinite(d)
    && (previousK as number) >= (previousD as number)
    && (k as number) < (d as number)
}

function isFastLineBreaksBelow(
  previousK: number | undefined,
  k: number | undefined,
  threshold: number,
) {
  return Number.isFinite(previousK)
    && Number.isFinite(k)
    && (previousK as number) > threshold
    && (k as number) <= threshold
}

function isCrossesAbove(
  previousValue: number | undefined,
  currentValue: number | undefined,
  previousThreshold: number | undefined,
  currentThreshold: number | undefined,
) {
  return Number.isFinite(previousValue)
    && Number.isFinite(currentValue)
    && Number.isFinite(previousThreshold)
    && Number.isFinite(currentThreshold)
    && (previousValue as number) < (previousThreshold as number)
    && (currentValue as number) >= (currentThreshold as number)
}

function createMorganSegmentByIndex(dataLength: number, segments: MorganRangeSegment[]) {
  const output: Array<MorganRangeSegment | null> = Array.from({ length: dataLength }, () => null)
  segments.forEach((segment) => {
    const start = Math.max(0, segment.startIndex)
    const end = Math.min(dataLength - 1, segment.endIndex)
    for (let index = start; index <= end; index += 1) {
      output[index] = segment
    }
  })
  return output
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<MmfIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function calculateTradingViewMmfRowsInternal(dataList: KLineData[], inputSettings?: Partial<MmfIndicatorSettings>): MmfIndicatorRow[] {
  const settings = normalizeMmfSettings(inputSettings)
  const rows: MmfIndicatorRow[] = dataList.map(() => ({}))
  if (!settings.showHigh) return rows

  const stochRows = calculateTradingViewStochRows(dataList, defaultStochIndicatorSettings)
  const dpoRows = calculateTradingViewDpoRows(dataList, defaultDpoIndicatorSettings)
  const morganSegments = calculateMorganRangeSegments(dataList)
  const morganSegmentByIndex = createMorganSegmentByIndex(dataList.length, morganSegments)
  const morganRatio = resolveAdjustedMorganRatio(settings)
  const dpoThreshold = Math.max(0, Number(settings.dpoValue))
  let active: MmfHighActiveState | null = null

  for (let index = 1; index < dataList.length; index += 1) {
    const candle = dataList[index]
    const previousCandle = dataList[index - 1]
    const high = Number(candle?.high)
    const previousHigh = Number(previousCandle?.high)
    const segment = morganSegmentByIndex[index]
    const previousSegment = morganSegmentByIndex[index - 1]
    const morganLevel = getMorganRangeLevel(segment, morganRatio)?.price
    const previousMorganLevel = getMorganRangeLevel(previousSegment, morganRatio)?.price
    const dpo = dpoRows[index]?.dpo
    const previousDpo = dpoRows[index - 1]?.dpo
    const stoch = stochRows[index]
    const previousStoch = stochRows[index - 1]
    const k = stoch?.k
    const d = stoch?.d
    const previousK = previousStoch?.k
    const previousD = previousStoch?.d
    const priceBreaksMorganLevel = isCrossesAbove(previousHigh, high, previousMorganLevel, morganLevel)
    const dpoBreaksThreshold = isCrossesAbove(previousDpo, dpo, dpoThreshold, dpoThreshold)
    const startSignal = priceBreaksMorganLevel || dpoBreaksThreshold

    if (!active && startSignal && Number.isFinite(high)) {
      active = {
        confirmCrossIndex: null,
        confirmThreshold: null,
        highestHigh: high,
        highestHighIndex: index,
        startIndex: index,
      }
    }

    if (!active) continue

    if (Number.isFinite(high) && high > active.highestHigh) {
      active.highestHigh = high
      active.highestHighIndex = index
    }

    if (
      active.confirmThreshold == null
      && isBearishStochCross(previousK, previousD, k, d)
    ) {
      const threshold = resolveConfirmThresholdByBearishCross(k as number, d as number)
      if (threshold != null) {
        active.confirmThreshold = threshold
        active.confirmCrossIndex = index
      }
    }

    if (
      active.confirmThreshold != null
      && active.confirmCrossIndex != null
      && index > active.confirmCrossIndex
      && isFastLineBreaksBelow(previousK, k, active.confirmThreshold)
    ) {
      const markerIndex = active.highestHighIndex
      rows[markerIndex] = {
        ...rows[markerIndex],
        highMarker: active.highestHigh,
        highMarkerPrice: active.highestHigh,
      }
      active = null
    }
  }

  return rows
}

export function calculateTradingViewMmfRows(dataList: KLineData[], inputSettings?: Partial<MmfIndicatorSettings>): MmfIndicatorRow[] {
  return calculateTradingViewMmfRowsInternal(dataList, inputSettings)
}

function drawMmfHighMarkers({
  ctx,
  indicator,
  visibleRange,
  xAxis,
  yAxis,
}: {
  ctx: CanvasRenderingContext2D
  indicator: { calcParams: unknown[]; result: MmfIndicatorRow[] }
  visibleRange: { from: number; to: number }
  xAxis: { convertToPixel: (value: number) => number }
  yAxis: { convertToPixel: (value: number) => number }
}) {
  const settings = normalizeMmfSettings(indicator.calcParams[0] as Partial<MmfIndicatorSettings>)
  if (!settings.showHigh) return
  const size = clampMarkerSize(settings.highSize)
  const symbol = settings.highSymbol || defaultMmfIndicatorSettings.highSymbol
  const start = Math.max(0, Math.floor(visibleRange.from) - 2)
  const end = Math.min(indicator.result.length - 1, Math.ceil(visibleRange.to) + 2)

  ctx.save()
  ctx.fillStyle = settings.highColor || defaultMmfIndicatorSettings.highColor
  ctx.font = `${size}px Arial, Tahoma, 'Segoe UI Symbol', 'Segoe UI', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'

  for (let index = start; index <= end; index += 1) {
    const marker = indicator.result[index]?.highMarker
    if (!Number.isFinite(marker)) continue
    const x = xAxis.convertToPixel(index)
    const y = yAxis.convertToPixel(marker as number) - Math.max(4, Math.round(size * 0.25))
    ctx.fillText(symbol, x, y)
  }

  ctx.restore()
}

export function ensureTradingViewMmfIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MmfIndicatorRow>({
    name: 'MMF',
    shortName: 'MMF',
    calcParams: [defaultMmfIndicatorSettings],
    series: IndicatorSeries.Price,
    createTooltipDataSource: (params) => {
      const row = params.indicator.result[resolveTooltipIndex(params)]
      return {
        name: 'MMF',
        calcParamsText: '',
        icons: [],
        values: Number.isFinite(row?.highMarkerPrice)
          ? [{
              title: { text: 'High ', color: params.defaultStyles.tooltip.text.color },
              value: { text: String(row?.highMarkerPrice), color: defaultMmfIndicatorSettings.highColor },
            }]
          : [],
      }
    },
    draw: (params) => {
      drawMmfHighMarkers(params)
      return true
    },
    calc: (dataList, indicator) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewMmfRowsInternal(realRows, indicator.calcParams[0] as Partial<MmfIndicatorSettings>),
    ),
  })
}
