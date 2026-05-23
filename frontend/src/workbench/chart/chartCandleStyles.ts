import { LineType, TooltipShowRule } from 'klinecharts'
import type { CandleTooltipCustomCallbackData, Chart } from 'klinecharts'
import { readSettingsSymbolState } from '../settingsSymbolState'
import { chartSettingKeys } from '../settings/chartSettingsSchema'
import {
  chartNumberFontFamily,
  chartNumberFontWeight,
  readCandleBarStyle,
  readHighLowTextSize,
  readPricePrecision,
  readSymbolLabelVisibleParts,
  resolveCandleValueColor,
  resolveStatusTitle,
} from './chartStyleReaders'
import { lastRealKLine } from './chartFuturePlaceholders'
import { createPriceAxisLabelTextStyle } from './chartPriceLabelStyles'
import { domPaneTitleOverlayEnabled } from './paneTitleOverlayConfig'
import { readCurrentCandleCountdownActive } from './currentCandleCountdownVisibility'

export function applyCandleBarStyle(chart: Chart) {
  chart.setStyles({ candle: { bar: readCandleBarStyle() } })
}

export function applyPriceVolumePrecision(chart: Chart, symbol?: string) {
  const dataList = chart.getDataList()
  const latest = lastRealKLine(dataList)
  const close = latest ? Number(latest.close) : null
  chart.setPriceVolumePrecision(readPricePrecision(close, { symbol }), 0)
}

export function applyLastPriceLineStyle(chart: Chart, symbol = '') {
  const selectedParts = readSymbolLabelVisibleParts()
  const barStyle = readCandleBarStyle()
  const countdownVisible = readCurrentCandleCountdownActive(symbol)
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
          line: { dashedValue: [2, 2], show: selectedParts.includes('line'), size: 1, style: LineType.Dashed },
          noChangeColor: barStyle.noChangeColor,
          text: createPriceAxisLabelTextStyle(selectedParts.includes('value') && !countdownVisible),
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

export function applyCandleTooltipStyle(chart: Chart, symbol: string, period: string, displayName?: string) {
  const settings = readSettingsSymbolState()
  const chartValuesVisible = settings[chartSettingKeys.statusChartValuesVisible] !== false
  const candleChangeVisible = settings[chartSettingKeys.statusCandleChangeVisible] !== false
  const candleVolumeVisible = settings[chartSettingKeys.statusCandleVolumeVisible] !== false
  const candleTimeVisible = settings[chartSettingKeys.statusCandleTimeVisible] !== false
  const barStyle = readCandleBarStyle()
  const statusTitle = resolveStatusTitle(symbol, displayName)

  chart.setStyles({
    candle: {
      bar: barStyle,
      tooltip: {
        showRule: domPaneTitleOverlayEnabled ? TooltipShowRule.None : undefined,
        custom: ({ current }: CandleTooltipCustomCallbackData) => {
          const priceColor = resolveCandleValueColor(current, barStyle)
          return [
            {
              title: statusTitle ? `${statusTitle} ${period}${chartValuesVisible ? '  O: ' : ''}` : '',
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
            ...(candleVolumeVisible ? [{ title: 'Volume: ', value: '{volume}' }] : []),
            ...(candleTimeVisible ? [{ title: 'Time: ', value: '{time}' }] : []),
          ]
        },
      },
    },
  })
}
