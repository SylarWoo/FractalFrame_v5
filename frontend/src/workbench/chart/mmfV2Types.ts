import type { MaIndicatorSettings, MmfIndicatorSettings, VdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfV2IndicatorMarker } from '../../services/mt5/mmfV2IndicatorApi'

export type MmfV2IndicatorRow = {
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
  lowConfirmPointMarker?: number
  lowConfirmPointMarkerPrice?: number
  lowConfirmPointDistance?: number
  supportMarker?: number
  supportMarkerPrice?: number
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
}

export type MmfV2CalcContext = {
  maSettings?: Partial<MaIndicatorSettings>
  period?: string
  settings?: Partial<MmfIndicatorSettings>
  symbol?: string
  vdoSettings?: Partial<VdoIndicatorSettings>
}

export type MmfV2MarkerSpec = {
  color: (settings: MmfIndicatorSettings) => string
  distanceKey?: keyof Pick<MmfV2IndicatorRow, 'highConfirmPointDistance' | 'lowConfirmPointDistance'>
  markerKey: keyof Pick<MmfV2IndicatorRow, 'highMarker' | 'deadCrossMarker' | 'lowMarker' | 'goldenCrossMarker' | 'highConfirmPointMarker' | 'lowConfirmPointMarker' | 'supportMarker' | 'resistanceMarker' | 'expectedSupportMarker' | 'expectedResistanceMarker' | 'trendDownReboundMarker' | 'trendUpPullbackMarker' | 'trendDownReturnMarker' | 'trendUpReturnMarker' | 'trendDownDivergenceMarker' | 'trendUpDivergenceMarker' | 'supportDownBreakMarker' | 'supportUpBreakMarker' | 'resistanceDownBreakMarker' | 'resistanceUpBreakMarker'>
  markerType: MmfV2IndicatorMarker['type']
  offsetMultiplier: number
  priceKey: keyof Pick<MmfV2IndicatorRow, 'highMarkerPrice' | 'deadCrossMarkerPrice' | 'lowMarkerPrice' | 'goldenCrossMarkerPrice' | 'highConfirmPointMarkerPrice' | 'lowConfirmPointMarkerPrice' | 'supportMarkerPrice' | 'resistanceMarkerPrice' | 'expectedSupportMarkerPrice' | 'expectedResistanceMarkerPrice' | 'trendDownReboundMarkerPrice' | 'trendUpPullbackMarkerPrice' | 'trendDownReturnMarkerPrice' | 'trendUpReturnMarkerPrice' | 'trendDownDivergenceMarkerPrice' | 'trendUpDivergenceMarkerPrice' | 'supportDownBreakMarkerPrice' | 'supportUpBreakMarkerPrice' | 'resistanceDownBreakMarkerPrice' | 'resistanceUpBreakMarkerPrice'>
  show: (settings: MmfIndicatorSettings) => boolean
  size: (settings: MmfIndicatorSettings) => number
  symbol: (settings: MmfIndicatorSettings) => string
  textBaseline: CanvasTextBaseline
  title: string
  yDirection: -1 | 1
}
