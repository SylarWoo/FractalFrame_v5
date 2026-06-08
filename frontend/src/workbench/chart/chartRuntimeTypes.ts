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
