import type {
  MaIndicatorSettings,
  MmfIndicatorSettings,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  VmiIndicatorSettings,
  VwapIndicatorSettings,
} from '../../rightDrawer/indicatorSettingsSchema'

export type MmfV3NormalizedContextV2 = {
  maSettings: MaIndicatorSettings
  morganRangeMode: 'D1_M30' | 'H4_M5'
  period: string
  settings: MmfIndicatorSettings
  stochSettings: StochIndicatorSettings
  symbol: string
  tsiSettings: TsiIndicatorSettings
  vdoSettings: VdoIndicatorSettings
  vmiSettings: VmiIndicatorSettings
  vwapSettings: VwapIndicatorSettings
}

export type MmfV3FeatureRowV2 = {
  barKey: string
  close: number
  high: number
  index: number
  low: number
  open: number
  time: number
  tsi?: number
  tsiCrossDownSignal?: boolean
  tsiCrossUpSignal?: boolean
  tsiHistogram?: number
  tsiSignal?: number
  vdo?: number
  vdoBase2Ma?: number
  vdoBaseMa?: number
  vdoBearMarketActive?: boolean
  vdoBullMarketActive?: boolean
  vdoCrossDownBaseMa?: boolean
  vdoCrossUpBaseMa?: boolean
  vdoDownLine2Value: number
  vdoDownLineValue: number
  vdoEnterOverbought?: boolean
  vdoEnterOversold?: boolean
  vdoExitOverbought?: boolean
  vdoExitOversold?: boolean
  vdoOverboughtActive?: boolean
  vdoOverboughtEpoch?: number | null
  vdoOversoldActive?: boolean
  vdoOversoldEpoch?: number | null
  vdoUpLine2Value: number
  vdoUpLineValue: number
  vmiHistogram?: number
  stochD?: number
  stochK?: number
}
