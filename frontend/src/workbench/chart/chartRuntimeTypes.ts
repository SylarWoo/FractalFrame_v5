import type {
  AoIndicatorSettings,
  DpoIndicatorSettings,
  MacdIndicatorSettings,
  MaIndicatorSettings,
  MmfIndicatorSettings,
  MrIndicatorSettings,
  RsiIndicatorSettings,
  SqzmomIndicatorSettings,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  VmiIndicatorSettings,
  VolIndicatorSettings,
  VwapIndicatorSettings,
} from '../rightDrawer/indicatorPersistence'

export type ChartIndicatorCommand = {
  action: 'load' | 'unload'
  id: number
  resetAxisOnCreate?: boolean
} & (
  | { name: 'MA'; settings?: MaIndicatorSettings }
  | { name: 'MACD'; settings?: MacdIndicatorSettings }
  | { name: 'MMF'; settings?: MmfIndicatorSettings }
  | { name: 'MMF_V2'; settings?: MmfIndicatorSettings }
  | { name: 'MMF_V3'; settings?: MmfIndicatorSettings }
  | { name: 'DPO'; settings?: DpoIndicatorSettings }
  | { name: 'MR-M5'; settings?: MrIndicatorSettings }
  | { name: 'MR-M30'; settings?: MrIndicatorSettings }
  | { name: 'MR-H2'; settings?: MrIndicatorSettings }
  | { name: 'RSI'; settings?: RsiIndicatorSettings }
  | { name: 'SQZMOM'; settings?: SqzmomIndicatorSettings }
  | { name: 'Stoch'; settings?: StochIndicatorSettings }
  | { name: 'TSI'; settings?: TsiIndicatorSettings }
  | { name: 'VDO'; settings?: VdoIndicatorSettings }
  | { name: 'VI'; settings?: ViIndicatorSettings }
  | { name: 'AO'; settings?: AoIndicatorSettings }
  | { name: 'VMI'; settings?: VmiIndicatorSettings }
  | { name: 'VWAP'; settings?: VwapIndicatorSettings }
  | { name: 'Vol'; settings?: VolIndicatorSettings }
)

export type ChartLoadState = {
  error: boolean
  loadedPeriod?: string
  loadedSymbol?: string
  loading: boolean
  loadingMore: boolean
  period: string
  requestedRows: number
  rows: number
  symbol: string
  totalRows?: number | null
}

export type ChartPageTarget = {
  blank?: boolean
  fromGlobalIndex?: number | null
  identity?: string | null
  index: number
  limit: number
  realtime: boolean
  rows?: number | null
  timeFrom?: number | null
  timeTo?: number | null
  toGlobalIndex?: number | null
}

export type ChartPageNavigationTarget = {
  index: number
  labelFrom?: string | null
  labelTo?: string | null
  timeFrom?: number | null
  timeTo?: number | null
}

export type ChartPageNavigation = {
  current: ChartPageNavigationTarget
  newer?: ChartPageNavigationTarget | null
  older?: ChartPageNavigationTarget | null
  onSelectPage?: (pageIndex: number) => void
  realtimeStartLabel?: string | null
  realtimeStart?: number | null
}
