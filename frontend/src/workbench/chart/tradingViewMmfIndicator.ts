import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import { defaultMmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'

export type MmfIndicatorRow = Record<string, never>

let registered = false

export function calculateTradingViewMmfRows(dataList: KLineData[]): MmfIndicatorRow[] {
  return dataList.map(() => ({}))
}

export function ensureTradingViewMmfIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MmfIndicatorRow>({
    name: 'MMF',
    shortName: 'MMF',
    calcParams: [defaultMmfIndicatorSettings],
    series: IndicatorSeries.Price,
    createTooltipDataSource: () => ({ name: 'MMF', calcParamsText: '', icons: [], values: [] }),
    calc: (dataList) => calculateTradingViewMmfRows(dataList),
  })
}
