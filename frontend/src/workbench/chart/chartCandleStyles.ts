import { LineType } from 'klinecharts'
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

export function applyCandleBarStyle(chart: Chart) {
  chart.setStyles({ candle: { bar: readCandleBarStyle() } })
}

export function applyPriceVolumePrecision(chart: Chart) {
  chart.setPriceVolumePrecision(readPricePrecision(), 0)
}

export function applyLastPriceLineStyle(chart: Chart) {
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
          line: { dashedValue: [2, 2], show: selectedParts.includes('line'), size: 1, style: LineType.Dashed },
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

export function applyCandleTooltipStyle(chart: Chart, symbol: string, period: string, displayName?: string) {
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
