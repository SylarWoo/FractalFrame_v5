export const horizontalLineOverlayName = 'ffHorizontalLine'
export const trendLineOverlayName = 'ffTrendLine'
export const rulerOverlayName = 'ffRuler'

export const drawingOverlayNames = new Set([horizontalLineOverlayName, trendLineOverlayName, rulerOverlayName])

export const horizontalLineVisibilityRangeKey = 'drawing:horizontalLine'
export const trendLineVisibilityRangeKey = 'drawing:trendLine'
export const rulerVisibilityRangeKey = 'drawing:ruler'

const horizontalLineVisibilityRangeKeyPrefix = `${horizontalLineVisibilityRangeKey}:`
const trendLineVisibilityRangeKeyPrefix = `${trendLineVisibilityRangeKey}:`
const rulerVisibilityRangeKeyPrefix = `${rulerVisibilityRangeKey}:`

export function horizontalLineObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${horizontalLineVisibilityRangeKeyPrefix}${objectId}` : horizontalLineVisibilityRangeKey
}

export function trendLineObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${trendLineVisibilityRangeKeyPrefix}${objectId}` : trendLineVisibilityRangeKey
}

export function rulerObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${rulerVisibilityRangeKeyPrefix}${objectId}` : rulerVisibilityRangeKey
}

export function isDrawingVisibilityRangeKey(key: string | undefined) {
  return key === horizontalLineVisibilityRangeKey ||
    key === trendLineVisibilityRangeKey ||
    key === rulerVisibilityRangeKey ||
    key?.startsWith(horizontalLineVisibilityRangeKeyPrefix) === true ||
    key?.startsWith(trendLineVisibilityRangeKeyPrefix) === true ||
    key?.startsWith(rulerVisibilityRangeKeyPrefix) === true
}
