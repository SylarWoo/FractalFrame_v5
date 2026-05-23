export const horizontalLineOverlayName = 'ffHorizontalLine'
export const trendLineOverlayName = 'ffTrendLine'

export const drawingOverlayNames = new Set([horizontalLineOverlayName, trendLineOverlayName])

export const horizontalLineVisibilityRangeKey = 'drawing:horizontalLine'
export const trendLineVisibilityRangeKey = 'drawing:trendLine'

const horizontalLineVisibilityRangeKeyPrefix = `${horizontalLineVisibilityRangeKey}:`
const trendLineVisibilityRangeKeyPrefix = `${trendLineVisibilityRangeKey}:`

export function horizontalLineObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${horizontalLineVisibilityRangeKeyPrefix}${objectId}` : horizontalLineVisibilityRangeKey
}

export function trendLineObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${trendLineVisibilityRangeKeyPrefix}${objectId}` : trendLineVisibilityRangeKey
}

export function isDrawingVisibilityRangeKey(key: string | undefined) {
  return key === horizontalLineVisibilityRangeKey ||
    key === trendLineVisibilityRangeKey ||
    key?.startsWith(horizontalLineVisibilityRangeKeyPrefix) === true ||
    key?.startsWith(trendLineVisibilityRangeKeyPrefix) === true
}
