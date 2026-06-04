import type { KLineData } from 'klinecharts'
import type { MmfV3IndicatorRow } from '../mmfV3Types'
import type { MorganRangeMode, MorganRangeSegment } from '../morganRangeModel'

export type PageDataStatus = 'calculating' | 'failed' | 'loading' | 'ready'

export type PageDataBarRow = KLineData & {
  barKey: string
  sourceIndex: number
  time: number
}

export type PageDataIndicatorTables = {
  MMF_V3?: MmfV3IndicatorRow[]
  MR_M5?: MorganRangeSegment[]
  MR_M30?: MorganRangeSegment[]
}

export type PageDataPackage = {
  calculatedAt?: string
  calculationRows: PageDataBarRow[]
  displayOffset: number
  displayRows: PageDataBarRow[]
  error?: string
  indicatorTables: PageDataIndicatorTables
  key: string
  lookaheadRows: PageDataBarRow[]
  pageIndex: number
  period: string
  realtime: boolean
  status: PageDataStatus
  symbol: string
  warmupRows: PageDataBarRow[]
}

export type PageDataPackageRequest = {
  fromGlobalIndex?: number | null
  lookaheadRows?: number
  pageIndex: number
  period: string
  realtime: boolean
  rows?: number | null
  symbol: string
  timeFrom?: number | null
  timeTo?: number | null
  toGlobalIndex?: number | null
  warmupRows?: number
}

export type PageDataIndicatorCalculationRequest = {
  indicators?: Array<'MMF_V3' | 'MR_M5' | 'MR_M30'>
  morganRangeMode?: MorganRangeMode
}
