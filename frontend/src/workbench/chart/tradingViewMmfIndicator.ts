import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import { defaultMmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'

export type MmfIndicatorRow = {
  highMarker?: number
  highMarkerPrice?: number
}

let registered = false

function calculateTradingViewMmfRowsInternal(dataList: KLineData[]): MmfIndicatorRow[] {
  return dataList.map(() => ({}))
}

export function calculateTradingViewMmfRows(dataList: KLineData[], inputSettings?: Partial<MmfIndicatorSettings>): MmfIndicatorRow[] {
  void inputSettings
  return calculateTradingViewMmfRowsInternal(dataList)
}

export function ensureTradingViewMmfIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MmfIndicatorRow>({
    name: 'MMF',
    shortName: 'MMF',
    calcParams: [defaultMmfIndicatorSettings],
    series: IndicatorSeries.Price,
    createTooltipDataSource: () => ({
      name: 'MMF',
      calcParamsText: '',
      icons: [],
      values: [],
    }),
    draw: () => true,
    calc: (dataList) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewMmfRowsInternal(realRows),
    ),
  })
}
