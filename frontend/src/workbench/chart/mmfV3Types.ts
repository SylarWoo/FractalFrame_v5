import type { MaIndicatorSettings, MmfIndicatorSettings, StochIndicatorSettings, TsiIndicatorSettings, VdoIndicatorSettings, VmiIndicatorSettings, VwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfV3IndicatorMarker } from '../../services/mt5/mmfV3IndicatorApi'

export type MmfV3IndicatorRow = {
  highMarker?: number
  highMarkerPrice?: number
  deadCrossMarker?: number
  deadCrossMarkerPrice?: number
  lowMarker?: number
  lowMarkerPrice?: number
  goldenCrossMarker?: number
  goldenCrossMarkerPrice?: number
  highConfirmPointMarker?: number
  highConfirmPointMarkerPrice?: number
  highConfirmPointDistance?: number
  resistanceMarker?: number
  resistanceMarkerPrice?: number
  topDivergenceMarker?: number
  topDivergenceMarkerPrice?: number
  lowConfirmPointMarker?: number
  lowConfirmPointMarkerPrice?: number
  lowConfirmPointDistance?: number
  supportMarker?: number
  supportMarkerPrice?: number
  bottomDivergenceMarker?: number
  bottomDivergenceMarkerPrice?: number
  expectedSupportMarker?: number
  expectedSupportMarkerPrice?: number
  expectedResistanceMarker?: number
  expectedResistanceMarkerPrice?: number
  trendDownReboundMarker?: number
  trendDownReboundMarkerPrice?: number
  trendUpPullbackMarker?: number
  trendUpPullbackMarkerPrice?: number
  trendDownReturnMarker?: number
  trendDownReturnMarkerPrice?: number
  trendUpReturnMarker?: number
  trendUpReturnMarkerPrice?: number
  trendDownDivergenceMarker?: number
  trendDownDivergenceMarkerPrice?: number
  trendUpDivergenceMarker?: number
  trendUpDivergenceMarkerPrice?: number
  supportDownBreakMarker?: number
  supportDownBreakMarkerPrice?: number
  supportUpBreakMarker?: number
  supportUpBreakMarkerPrice?: number
  resistanceDownBreakMarker?: number
  resistanceDownBreakMarkerPrice?: number
  resistanceUpBreakMarker?: number
  resistanceUpBreakMarkerPrice?: number
  trueCloseDownMarker?: number
  trueCloseDownMarkerPrice?: number
  trueCloseUpMarker?: number
  trueCloseUpMarkerPrice?: number
  bullMarketMarker?: number
  bullMarketMarkerPrice?: number
  bearMarketMarker?: number
  bearMarketMarkerPrice?: number
  overboughtMarker?: number
  overboughtMarkerPrice?: number
  overboughtCloseMarker?: number
  overboughtCloseMarkerPrice?: number
  oversoldMarker?: number
  oversoldMarkerPrice?: number
  oversoldCloseMarker?: number
  oversoldCloseMarkerPrice?: number
  tsiDeadCrossMarker?: number
  tsiDeadCrossMarkerPrice?: number
  tsiDeadCrossConfirmMarker?: number
  tsiDeadCrossConfirmMarkerPrice?: number
  tsiGoldenCrossMarker?: number
  tsiGoldenCrossMarkerPrice?: number
  tsiGoldenCrossConfirmMarker?: number
  tsiGoldenCrossConfirmMarkerPrice?: number
}

export type MmfV3CalcContext = {
  maSettings?: Partial<MaIndicatorSettings>
  morganRangeMode?: 'D1_M30' | 'H4_M5'
  period?: string
  settings?: Partial<MmfIndicatorSettings>
  pageKey?: string
  settingsHash?: string
  staticRows?: MmfV3IndicatorRow[]
  stochSettings?: Partial<StochIndicatorSettings>
  symbol?: string
  tsiSettings?: Partial<TsiIndicatorSettings>
  vdoSettings?: Partial<VdoIndicatorSettings>
  visibleFrom?: number
  visibleTo?: number
  vmiSettings?: Partial<VmiIndicatorSettings>
  vwapSettings?: Partial<VwapIndicatorSettings>
}

export type MmfV3MarkerSpec = {
  color: (settings: MmfIndicatorSettings) => string
  distanceKey?: keyof Pick<MmfV3IndicatorRow, 'highConfirmPointDistance' | 'lowConfirmPointDistance'>
  markerKey: keyof Pick<MmfV3IndicatorRow, 'highMarker' | 'deadCrossMarker' | 'lowMarker' | 'goldenCrossMarker' | 'highConfirmPointMarker' | 'lowConfirmPointMarker' | 'supportMarker' | 'resistanceMarker' | 'topDivergenceMarker' | 'bottomDivergenceMarker' | 'expectedSupportMarker' | 'expectedResistanceMarker' | 'trendDownReboundMarker' | 'trendUpPullbackMarker' | 'trendDownReturnMarker' | 'trendUpReturnMarker' | 'trendDownDivergenceMarker' | 'trendUpDivergenceMarker' | 'supportDownBreakMarker' | 'supportUpBreakMarker' | 'resistanceDownBreakMarker' | 'resistanceUpBreakMarker' | 'trueCloseDownMarker' | 'trueCloseUpMarker' | 'bullMarketMarker' | 'bearMarketMarker' | 'overboughtMarker' | 'overboughtCloseMarker' | 'oversoldMarker' | 'oversoldCloseMarker' | 'tsiDeadCrossMarker' | 'tsiDeadCrossConfirmMarker' | 'tsiGoldenCrossMarker' | 'tsiGoldenCrossConfirmMarker'>
  markerType: MmfV3IndicatorMarker['type']
  offsetMultiplier: number
  priceKey: keyof Pick<MmfV3IndicatorRow, 'highMarkerPrice' | 'deadCrossMarkerPrice' | 'lowMarkerPrice' | 'goldenCrossMarkerPrice' | 'highConfirmPointMarkerPrice' | 'lowConfirmPointMarkerPrice' | 'supportMarkerPrice' | 'resistanceMarkerPrice' | 'topDivergenceMarkerPrice' | 'bottomDivergenceMarkerPrice' | 'expectedSupportMarkerPrice' | 'expectedResistanceMarkerPrice' | 'trendDownReboundMarkerPrice' | 'trendUpPullbackMarkerPrice' | 'trendDownReturnMarkerPrice' | 'trendUpReturnMarkerPrice' | 'trendDownDivergenceMarkerPrice' | 'trendUpDivergenceMarkerPrice' | 'supportDownBreakMarkerPrice' | 'supportUpBreakMarkerPrice' | 'resistanceDownBreakMarkerPrice' | 'resistanceUpBreakMarkerPrice' | 'trueCloseDownMarkerPrice' | 'trueCloseUpMarkerPrice' | 'bullMarketMarkerPrice' | 'bearMarketMarkerPrice' | 'overboughtMarkerPrice' | 'overboughtCloseMarkerPrice' | 'oversoldMarkerPrice' | 'oversoldCloseMarkerPrice' | 'tsiDeadCrossMarkerPrice' | 'tsiDeadCrossConfirmMarkerPrice' | 'tsiGoldenCrossMarkerPrice' | 'tsiGoldenCrossConfirmMarkerPrice'>
  show: (settings: MmfIndicatorSettings) => boolean
  size: (settings: MmfIndicatorSettings) => number
  symbol: (settings: MmfIndicatorSettings) => string
  textBaseline: CanvasTextBaseline
  title: string
  yDirection: -1 | 1
}
