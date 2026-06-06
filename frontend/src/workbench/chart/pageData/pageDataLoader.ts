import { writePageDataPackage } from './pageDataCache'
import type { PageDataPackage, PageDataPackageRequest } from './pageDataTypes'
import { loadPageDataSlice } from './pageDataProvider'

export const defaultHistoricalPageWarmupRows = 1_200
export const defaultHistoricalPageLookaheadRows = 300

export async function loadPageDataPackage(request: PageDataPackageRequest): Promise<PageDataPackage> {
  const slice = await loadPageDataSlice({
    fromGlobalIndex: request.fromGlobalIndex,
    lookaheadRows: request.lookaheadRows ?? defaultHistoricalPageLookaheadRows,
    mode: request.realtime ? 'realtime' : 'history',
    pageIndex: request.pageIndex,
    period: request.period,
    rows: request.rows,
    symbol: request.symbol,
    timeFrom: request.timeFrom,
    timeTo: request.timeTo,
    toGlobalIndex: request.toGlobalIndex,
    warmupRows: request.warmupRows ?? defaultHistoricalPageWarmupRows,
  })
  return writePageDataPackage({
    calculatedAt: undefined,
    calculationRows: slice.calculationRows,
    displayOffset: slice.displayOffset,
    displayRows: slice.displayRows,
    indicatorTables: {},
    key: slice.key,
    lookaheadRows: slice.lookaheadRows,
    pageIndex: slice.pageIndex,
    period: slice.period,
    realtime: slice.mode === 'realtime',
    status: 'loading',
    symbol: slice.symbol,
    warmupRows: slice.warmupRows,
  })
}
