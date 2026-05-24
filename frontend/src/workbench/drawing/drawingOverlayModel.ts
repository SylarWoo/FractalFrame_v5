export const horizontalLineOverlayName = 'ffHorizontalLine'
export const trendLineOverlayName = 'ffTrendLine'
export const rulerOverlayName = 'ffRuler'
export const fibRetracementOverlayName = 'ffFibRetracement'

export const drawingOverlayNames = new Set([horizontalLineOverlayName, trendLineOverlayName, rulerOverlayName, fibRetracementOverlayName])

export const horizontalLineVisibilityRangeKey = 'drawing:horizontalLine'
export const trendLineVisibilityRangeKey = 'drawing:trendLine'
export const rulerVisibilityRangeKey = 'drawing:ruler'
export const fibRetracementVisibilityRangeKey = 'drawing:fibRetracement'

const horizontalLineVisibilityRangeKeyPrefix = `${horizontalLineVisibilityRangeKey}:`
const trendLineVisibilityRangeKeyPrefix = `${trendLineVisibilityRangeKey}:`
const rulerVisibilityRangeKeyPrefix = `${rulerVisibilityRangeKey}:`
const fibRetracementVisibilityRangeKeyPrefix = `${fibRetracementVisibilityRangeKey}:`

export function horizontalLineObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${horizontalLineVisibilityRangeKeyPrefix}${objectId}` : horizontalLineVisibilityRangeKey
}

export function trendLineObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${trendLineVisibilityRangeKeyPrefix}${objectId}` : trendLineVisibilityRangeKey
}

export function rulerObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${rulerVisibilityRangeKeyPrefix}${objectId}` : rulerVisibilityRangeKey
}

export function fibRetracementObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${fibRetracementVisibilityRangeKeyPrefix}${objectId}` : fibRetracementVisibilityRangeKey
}

export function isDrawingVisibilityRangeKey(key: string | undefined) {
  return key === horizontalLineVisibilityRangeKey ||
    key === trendLineVisibilityRangeKey ||
    key === rulerVisibilityRangeKey ||
    key === fibRetracementVisibilityRangeKey ||
    key?.startsWith(horizontalLineVisibilityRangeKeyPrefix) === true ||
    key?.startsWith(trendLineVisibilityRangeKeyPrefix) === true ||
    key?.startsWith(rulerVisibilityRangeKeyPrefix) === true ||
    key?.startsWith(fibRetracementVisibilityRangeKeyPrefix) === true
}
