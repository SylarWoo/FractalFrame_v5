import type { KLineData } from 'klinecharts'
import {
  defaultDpoIndicatorSettings,
  defaultMaIndicatorSettings,
  defaultMrIndicatorSettings,
  defaultStochIndicatorSettings,
  defaultVdoIndicatorSettings,
} from '../rightDrawer/indicatorPersistence'
import type {
  DpoIndicatorSettings,
  MaIndicatorSettings,
  MrIndicatorSettings,
  StochIndicatorSettings,
  VdoIndicatorSettings,
} from '../rightDrawer/indicatorPersistence'
import { calculateMorganRangeSegments } from './morganRangeModel'
import type { MorganRangeSegment } from './morganRangeModel'
import { calculateTradingViewDpoRows } from './tradingViewDpoIndicator'
import type { DpoIndicatorRow } from './tradingViewDpoIndicator'
import { calculateTradingViewMaShiftRows } from './tradingViewMaShiftIndicator'
import type { MaShiftRow } from './tradingViewMaShiftIndicator'
import { calculateTradingViewStochRows } from './tradingViewStochIndicator'
import type { StochIndicatorRow } from './tradingViewStochIndicator'
import { calculateTradingViewVdoRows } from './tradingViewVdoIndicator'
import type { VdoIndicatorRow } from './tradingViewVdoIndicator'

export type CoreIndicatorKey = 'Stoch' | 'MR' | 'MA' | 'DPO' | 'VDO'

export type CoreIndicatorSettings = {
  DPO?: Partial<DpoIndicatorSettings>
  MA?: Partial<MaIndicatorSettings>
  MR?: Partial<MrIndicatorSettings>
  Stoch?: Partial<StochIndicatorSettings>
  VDO?: Partial<VdoIndicatorSettings>
}

export type CoreIndicatorRows = {
  dpo: DpoIndicatorRow[]
  ma: MaShiftRow[]
  mr: MorganRangeSegment[]
  stoch: StochIndicatorRow[]
  vdo: VdoIndicatorRow[]
}

export type CoreIndicatorRowAtIndex = {
  data: KLineData | undefined
  dataIndex: number
  dpo: DpoIndicatorRow | undefined
  ma: MaShiftRow | undefined
  mr: MorganRangeSegment | null
  stoch: StochIndicatorRow | undefined
  vdo: VdoIndicatorRow | undefined
}

export function calculateCoreIndicatorRows(
  dataList: KLineData[],
  settings: CoreIndicatorSettings = {},
  options: { morganFutureBars?: number } = {},
): CoreIndicatorRows {
  return {
    dpo: calculateDpoIndicatorRows(dataList, settings.DPO),
    ma: calculateMaIndicatorRows(dataList, settings.MA),
    mr: calculateMorganRangeIndicatorSegments(dataList, options.morganFutureBars),
    stoch: calculateStochIndicatorRows(dataList, settings.Stoch),
    vdo: calculateVdoIndicatorRows(dataList, settings.VDO),
  }
}

export function calculateStochIndicatorRows(dataList: KLineData[], settings?: Partial<StochIndicatorSettings>) {
  return calculateTradingViewStochRows(dataList, { ...defaultStochIndicatorSettings, ...(settings ?? {}) })
}

export function calculateMorganRangeIndicatorSegments(dataList: KLineData[], futureBars = 0) {
  return calculateMorganRangeSegments(dataList, futureBars)
}

export function calculateMaIndicatorRows(dataList: KLineData[], settings?: Partial<MaIndicatorSettings>) {
  return calculateTradingViewMaShiftRows(dataList, {
    ...defaultMaIndicatorSettings,
    ...(settings ?? {}),
    colors: settings?.colors && settings.colors.length > 0 ? settings.colors : defaultMaIndicatorSettings.colors,
  })
}

export function calculateDpoIndicatorRows(dataList: KLineData[], settings?: Partial<DpoIndicatorSettings>) {
  return calculateTradingViewDpoRows(dataList, { ...defaultDpoIndicatorSettings, ...(settings ?? {}) })
}

export function calculateVdoIndicatorRows(dataList: KLineData[], settings?: Partial<VdoIndicatorSettings>) {
  return calculateTradingViewVdoRows(dataList, { ...defaultVdoIndicatorSettings, ...(settings ?? {}) })
}

export function getCoreIndicatorRowAtIndex(rows: CoreIndicatorRows, dataList: KLineData[], dataIndex: number): CoreIndicatorRowAtIndex {
  const index = Number.isFinite(dataIndex) ? Math.max(0, Math.min(Math.round(dataIndex), Math.max(0, dataList.length - 1))) : 0
  return {
    data: dataList[index],
    dataIndex: index,
    dpo: rows.dpo[index],
    ma: rows.ma[index],
    mr: rows.mr.find((segment) => index >= segment.startIndex && index <= segment.endIndex) ?? null,
    stoch: rows.stoch[index],
    vdo: rows.vdo[index],
  }
}

export function getLatestCoreIndicatorRow(rows: CoreIndicatorRows, dataList: KLineData[]) {
  return getCoreIndicatorRowAtIndex(rows, dataList, dataList.length - 1)
}

export {
  defaultDpoIndicatorSettings,
  defaultMaIndicatorSettings,
  defaultMrIndicatorSettings,
  defaultStochIndicatorSettings,
  defaultVdoIndicatorSettings,
}

export type {
  DpoIndicatorRow,
  DpoIndicatorSettings,
  MaIndicatorSettings,
  MaShiftRow,
  MorganRangeSegment,
  MrIndicatorSettings,
  StochIndicatorRow,
  StochIndicatorSettings,
  VdoIndicatorRow,
  VdoIndicatorSettings,
}
