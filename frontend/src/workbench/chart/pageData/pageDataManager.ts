import { readPageDataPackage, writePageDataPackage } from './pageDataCache'
import { calculatePageIndicatorTables } from './pageIndicatorCalculator'
import { createPageDataKey } from './pageDataKey'
import { loadPageDataPackage } from './pageDataLoader'
import type { PageDataIndicatorCalculationRequest, PageDataPackageRequest } from './pageDataTypes'

export async function preparePageDataPackage(
  request: PageDataPackageRequest,
  indicatorRequest: PageDataIndicatorCalculationRequest = {},
) {
  const loaded = await loadPageDataPackage(request)
  return writePageDataPackage(calculatePageIndicatorTables(loaded, indicatorRequest))
}

export function readPreparedPageDataPackage(key: string) {
  return readPageDataPackage(key)
}

export const createPreparedPageDataKey = createPageDataKey
