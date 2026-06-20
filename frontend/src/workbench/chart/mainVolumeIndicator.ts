import { registerIndicator } from 'klinecharts'
import type { Chart, IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultVolIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { VolIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { mapPageIndicatorSnapshotToDataList } from './pageIndicatorRuntime'

const candlePaneId = 'candle_pane'
export const mainVolumeIndicatorName = 'FF_MAIN_VOL'

type MainVolumeOverlay = {
  destroy: () => void
  updateSettings: (settings?: Partial<VolIndicatorSettings>) => void
}

export type MainVolumeLegendRow = {
  volume?: number
  volumeColorIndex?: 0 | 1
  volumeMa?: number
}

declare global {
  interface Window {
    __ffMainVolumeOverlayDebug?: unknown
  }
}

let legendRegistered = false

function clampOpacity(value: unknown, fallback = 1) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 1)) : fallback
}

function clampLineWidth(value: unknown, fallback = 1) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(next, 4)) : fallback
}

function colorWithAlpha(hex: string, opacity: number) {
  const normalized = hex.trim().replace('#', '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return hex
  const value = Number.parseInt(normalized, 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${clampOpacity(opacity)})`
}

function normalizeSettings(settings?: Partial<VolIndicatorSettings>): VolIndicatorSettings {
  return { ...defaultVolIndicatorSettings, ...(settings ?? {}) }
}

function readVolSnapshotContext(input: unknown) {
  const context = input && typeof input === 'object'
    ? input as Partial<VolIndicatorSettings> & {
      pageKey?: string
      period?: string
      runtimeOnly?: boolean
      settingsHash?: string
      symbol?: string
    }
    : {}
  return {
    pageKey: typeof context.pageKey === 'string' ? context.pageKey : '',
    period: typeof context.period === 'string' ? context.period.trim().toUpperCase() : '',
    runtimeOnly: context.runtimeOnly === true,
    settingsHash: typeof context.settingsHash === 'string' ? context.settingsHash : '',
    symbol: typeof context.symbol === 'string' ? context.symbol.trim() : '',
  }
}

function readVolume(row: KLineData) {
  const source = row as KLineData & {
    Volume?: number
    realVolume?: number
    real_volume?: number
    tickVolume?: number
    tick_volume?: number
    vol?: number
  }
  const value = Number(source.volume ?? source.tick_volume ?? source.tickVolume ?? source.real_volume ?? source.realVolume ?? source.vol ?? source.Volume)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function getVolumeColorIndex(dataList: KLineData[], index: number, settings: VolIndicatorSettings): 0 | 1 {
  const current = dataList[index]
  const previous = dataList[index - 1]
  if (settings.colorBasedOnPreviousClose && previous) {
    return Number(current.close) >= Number(previous.close) ? 0 : 1
  }
  return Number(current.close) >= Number(current.open) ? 0 : 1
}

function calculateSma(values: number[], period: number) {
  const result: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index]
    if (index >= period) sum -= values[index - period]
    if (index >= period - 1) result[index] = sum / period
  }
  return result
}

function lineDashForStyle(style: VolIndicatorSettings['maLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function resolveIndicatorVolumeMax(rows: MainVolumeLegendRow[], from: number, to: number) {
  let max = 0
  for (let index = from; index <= to; index += 1) {
    const volume = rows[index]?.volume
    if (typeof volume === 'number' && Number.isFinite(volume)) max = Math.max(max, volume)
    const ma = rows[index]?.volumeMa
    if (Number.isFinite(ma)) max = Math.max(max, ma as number)
  }
  return max > 0 ? max : 1
}

function formatVolume(value: number | undefined) {
  if (!Number.isFinite(value)) return '--'
  const next = value as number
  if (Math.abs(next) >= 1_000_000_000) return `${(next / 1_000_000_000).toFixed(3).replace(/\.?0+$/, '')}B`
  if (Math.abs(next) >= 1_000_000) return `${(next / 1_000_000).toFixed(3).replace(/\.?0+$/, '')}M`
  if (Math.abs(next) >= 1_000) return `${(next / 1_000).toFixed(3).replace(/\.?0+$/, '')}K`
  return String(Math.round(next * 100) / 100)
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function calculateLegendRows(dataList: KLineData[], inputSettings?: Partial<VolIndicatorSettings>): MainVolumeLegendRow[] {
  const settings = normalizeSettings(inputSettings)
  const maLength = Math.max(1, Math.min(Math.round(Number(settings.maLength)), 500))
  const volumes = dataList.map(readVolume)
  const maValues = calculateSma(volumes, maLength)
  return dataList.map((_row, index) => ({
    volume: volumes[index],
    volumeColorIndex: getVolumeColorIndex(dataList, index, settings),
    volumeMa: maValues[index],
  }))
}

export function calculateMainVolumeRowsForKLineChart(dataList: KLineData[], inputContext: unknown): MainVolumeLegendRow[] {
  const context = readVolSnapshotContext(inputContext)
  if (context.pageKey && context.symbol && context.period) {
    const rows = mapPageIndicatorSnapshotToDataList<MainVolumeLegendRow>({
      dataList,
      indicator: 'vol',
      pageKey: context.pageKey,
      period: context.period,
      settingsHashKey: 'VOL',
      settingsHash: context.settingsHash,
      symbol: context.symbol,
    })
    if (rows) {
      return calculateWithoutFuturePlaceholders(dataList, () => rows)
    }
    if (context.runtimeOnly) {
      return calculateWithoutFuturePlaceholders(dataList, (realRows) => realRows.map(() => ({})))
    }
  }
  return calculateWithoutFuturePlaceholders(
    dataList,
    (realRows) => calculateLegendRows(realRows, inputContext as Partial<VolIndicatorSettings>),
  )
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<MainVolumeLegendRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

export function ensureMainVolumeLegendIndicator() {
  if (legendRegistered) return
  legendRegistered = true
  registerIndicator<MainVolumeLegendRow>({
    name: mainVolumeIndicatorName,
    shortName: 'Vol',
    zLevel: -20,
    calcParams: [defaultVolIndicatorSettings],
    figures: [],
    regenerateFigures: () => [],
    draw: ({ barSpace, bounding, ctx, indicator, kLineDataList, visibleRange, xAxis }) => {
      drawMainVolumeIndicator({
        barSpace,
        bounding,
        ctx,
        kLineDataList,
        rows: indicator.result,
        settings: normalizeSettings(indicator.calcParams[0]),
        visibleRange,
        xAxis,
      })
      return true
    },
    createTooltipDataSource: (params) => {
      const settings = normalizeSettings(params.indicator.calcParams[0])
      const index = resolveTooltipIndex(params)
      const row = params.indicator.result[index]
      const valueColor = row?.volumeColorIndex === 0
        ? colorWithAlpha(settings.volumeUpColor, 1)
        : colorWithAlpha(settings.volumeDownColor, 1)
      const inputsText = readIndicatorInputsVisible() ? ` ${Math.max(1, Math.min(Math.round(Number(settings.maLength)), 500))}` : ''
      const values = []
      if (readIndicatorValuesVisible()) {
        values.push({
          title: { text: '', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatVolume(row?.volume), color: valueColor },
        })
        if (settings.maChecked) {
          values.push({
            title: { text: 'MA ', color: params.defaultStyles.tooltip.text.color },
            value: { text: formatVolume(row?.volumeMa), color: colorWithAlpha(settings.maColor, settings.maOpacity) },
          })
        }
      }
      return {
        name: 'Vol',
        calcParamsText: inputsText,
        icons: [],
        values,
      }
    },
    calc: (dataList, indicator) => calculateMainVolumeRowsForKLineChart(dataList, indicator.calcParams[0]),
  })
}

function publishMainVolumeOverlayDebug(value: unknown) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  window.__ffMainVolumeOverlayDebug = value
}

function drawMainVolumeIndicator(options: {
  barSpace: { bar?: number; gapBar?: number }
  bounding: { height: number; left: number; top: number; width: number }
  ctx: CanvasRenderingContext2D
  kLineDataList: KLineData[]
  rows: MainVolumeLegendRow[]
  settings: VolIndicatorSettings
  visibleRange: { from: number; to: number }
  xAxis: { convertToPixel: (value: number) => number }
}) {
  const { barSpace, bounding, ctx, kLineDataList, rows, settings, visibleRange, xAxis } = options
  if (bounding.width <= 0 || bounding.height <= 0) {
    publishMainVolumeOverlayDebug({ reason: 'invalid-main-size', size: [bounding.width, bounding.height] })
    return
  }
  if (kLineDataList.length === 0 || !settings.volumeChecked) {
    publishMainVolumeOverlayDebug({
      dataLength: kLineDataList.length,
      reason: kLineDataList.length === 0 ? 'empty-data' : 'volume-disabled',
      volumeChecked: settings.volumeChecked,
    })
    return
  }
  const from = Math.max(0, Math.floor(visibleRange.from) - 1)
  const to = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)
  if (to < from) {
    publishMainVolumeOverlayDebug({ dataLength: kLineDataList.length, from, reason: 'empty-visible-range', to })
    return
  }

  const maxVolume = resolveIndicatorVolumeMax(rows, from, to)
  const bandHeight = Math.max(42, Math.min(112, Math.round(bounding.height * 0.24)))
  const bottomPadding = 0
  const top = bounding.top + bounding.height - bandHeight - bottomPadding
  const bottom = bounding.top + bounding.height - bottomPadding
  const resolvedBarSpace = Number(barSpace.gapBar ?? barSpace.bar ?? 1)
  const barWidth = Math.max(1, Math.floor(resolvedBarSpace * 0.82))
  const points: Array<{ index: number; x: number }> = []
  for (let index = from; index <= to; index += 1) {
    const x = xAxis.convertToPixel(index)
    if (!Number.isFinite(x)) continue
    if (x < bounding.left - barWidth || x > bounding.left + bounding.width + barWidth) continue
    points.push({ index, x })
  }
  if (points.length === 0) {
    publishMainVolumeOverlayDebug({
      barSpace: resolvedBarSpace,
      barWidth,
      dataLength: kLineDataList.length,
      from,
      reason: 'no-visible-volume-points',
      range: visibleRange,
      size: [bounding.width, bounding.height],
      to,
    })
    return
  }

  ctx.save()
  ctx.beginPath()
  ctx.rect(bounding.left, top - 2, bounding.width, bandHeight + 4)
  ctx.clip()

  for (const { index, x: xCenter } of points) {
    const volume = rows[index]?.volume
    if (typeof volume !== 'number' || !Number.isFinite(volume)) continue

    const height = Math.max(1, (volume / maxVolume) * (bandHeight - 8))
    const x = Math.round(xCenter - barWidth / 2)
    const y = Math.round(bottom - height)
    ctx.fillStyle = rows[index]?.volumeColorIndex === 0
      ? colorWithAlpha(settings.volumeUpColor, settings.volumeUpOpacity)
      : colorWithAlpha(settings.volumeDownColor, settings.volumeDownOpacity)
    ctx.fillRect(x, y, barWidth, Math.round(height))
  }

  if (settings.maChecked) {
    ctx.beginPath()
    ctx.strokeStyle = colorWithAlpha(settings.maColor, settings.maOpacity)
    ctx.lineWidth = clampLineWidth(settings.maLineWidth, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.setLineDash(lineDashForStyle(settings.maLineStyle))
    let started = false
    for (const { index, x } of points) {
      const ma = rows[index]?.volumeMa
      if (!Number.isFinite(ma)) {
        if (started) {
          ctx.stroke()
          ctx.beginPath()
          started = false
        }
        continue
      }
      const y = bottom - ((ma as number) / maxVolume) * (bandHeight - 8)
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    if (started) ctx.stroke()
  }

  ctx.restore()
  publishMainVolumeOverlayDebug({
    dataLength: kLineDataList.length,
    from,
    points: points.length,
    range: visibleRange,
    reason: 'rendered',
    to,
  })
}

export function installMainVolumeOverlay(chart: Chart, inputSettings?: Partial<VolIndicatorSettings>): MainVolumeOverlay | null {
  ensureMainVolumeLegendIndicator()
  let settings = normalizeSettings(inputSettings)
  const apply = () => {
    const indicator = { name: mainVolumeIndicatorName, calcParams: [settings], zLevel: -20 }
    if (chart.getIndicatorByPaneId(candlePaneId, mainVolumeIndicatorName)) {
      chart.overrideIndicator(indicator, candlePaneId)
      return
    }
    chart.createIndicator(indicator, true, { id: candlePaneId })
  }
  apply()

  return {
    destroy: () => {
      chart.removeIndicator(candlePaneId, mainVolumeIndicatorName)
    },
    updateSettings: (nextSettings) => {
      settings = normalizeSettings(nextSettings)
      apply()
    },
  }
}
