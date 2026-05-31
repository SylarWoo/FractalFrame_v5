import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import { defaultMrIndicatorSettings } from '../rightDrawer/indicatorPersistence'

type MrIndicatorRow = Record<string, never>

const registered = new Set<string>()

export type TradingViewMrIndicatorName = 'MR_M5' | 'MR_M30'

export function resolveTradingViewMrIndicatorName(name: 'MR-M5' | 'MR-M30'): TradingViewMrIndicatorName {
  return name === 'MR-M30' ? 'MR_M30' : 'MR_M5'
}

export function calculateTradingViewMrRows(dataList: KLineData[]): MrIndicatorRow[] {
  return dataList.map(() => ({}))
}

export function ensureTradingViewMrIndicator(name: TradingViewMrIndicatorName = 'MR_M5') {
  if (registered.has(name)) return
  registered.add(name)

  registerIndicator<MrIndicatorRow>({
    name,
    shortName: name,
    calcParams: [defaultMrIndicatorSettings],
    series: IndicatorSeries.Price,
    createTooltipDataSource: () => ({ name, calcParamsText: '', icons: [], values: [] }),
    calc: (dataList) => calculateTradingViewMrRows(dataList),
  })
}
