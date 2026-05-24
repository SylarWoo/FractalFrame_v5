import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import { defaultMrIndicatorSettings } from '../rightDrawer/indicatorPersistence'

type MrIndicatorRow = Record<string, never>

let registered = false

export function calculateTradingViewMrRows(dataList: KLineData[]): MrIndicatorRow[] {
  return dataList.map(() => ({}))
}

export function ensureTradingViewMrIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MrIndicatorRow>({
    name: 'MR',
    shortName: 'MR',
    calcParams: [defaultMrIndicatorSettings],
    series: IndicatorSeries.Price,
    createTooltipDataSource: () => ({ name: 'MR', calcParamsText: '', icons: [], values: [] }),
    calc: (dataList) => calculateTradingViewMrRows(dataList),
  })
}
