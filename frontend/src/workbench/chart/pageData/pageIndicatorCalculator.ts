import {
  alignMorganRangeSegmentsToDisplayRows,
  calculateMorganRangeSegmentsForModeCached,
  resolveMorganRangeBucketSeconds,
} from '../morganRangeModel'
import { resolvePeriodSeconds } from '../chartTimeFormatting'
import { updatePageDataPackage } from './pageDataCache'
import type { PageDataIndicatorCalculationRequest, PageDataPackage, PageDataPackageRequest } from './pageDataTypes'

function calculateMorganRangeTable(entry: PageDataPackage, mode: 'D1_M30' | 'H4_M5') {
  const periodSeconds = resolvePeriodSeconds(entry.period)
  const futureBars = Number.isFinite(periodSeconds) && periodSeconds > 0
    ? Math.round(resolveMorganRangeBucketSeconds(mode) / periodSeconds)
    : 0
  if (futureBars <= 0) return []
  return alignMorganRangeSegmentsToDisplayRows({
    calculationRows: entry.calculationRows,
    displayRows: entry.displayRows,
    segments: calculateMorganRangeSegmentsForModeCached(entry.calculationRows, mode, futureBars),
  })
}

export function calculatePageIndicatorTables(entry: PageDataPackage, request: PageDataIndicatorCalculationRequest = {}) {
  const indicators = new Set(request.indicators ?? [])
  const mode = request.morganRangeMode ?? 'H4_M5'
  const indicatorTables = { ...entry.indicatorTables }

  if (indicators.has('MR_M5') || mode === 'H4_M5') {
    indicatorTables.MR_M5 = calculateMorganRangeTable(entry, 'H4_M5')
  }
  if (indicators.has('MR_M30') || mode === 'D1_M30') {
    indicatorTables.MR_M30 = calculateMorganRangeTable(entry, 'D1_M30')
  }

  return {
    ...entry,
    calculatedAt: new Date().toISOString(),
    indicatorTables,
    status: 'ready' as const,
  }
}

export function calculateAndStorePageIndicatorTables(key: string, request: PageDataIndicatorCalculationRequest = {}) {
  return updatePageDataPackage(key, (entry) => calculatePageIndicatorTables(entry, request))
}

export function createPageDataIndicatorRequest(_: PageDataPackageRequest): PageDataIndicatorCalculationRequest {
  return {}
}
