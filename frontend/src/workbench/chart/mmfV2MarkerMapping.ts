import type { KLineData } from 'klinecharts'
import type { MmfV2IndicatorMarker } from '../../services/mt5/mmfV2IndicatorApi'
import { createBarIndexResolver } from './barIdentity'
import { mmfV2SignalCatalog } from './mmfV2SignalCatalog'
import type { MmfV2IndicatorRow } from './mmfV2Types'

type MmfV2RowKey = keyof MmfV2IndicatorRow

type MmfV2MarkerPriorityRule = {
  removeKeys: MmfV2RowKey[]
  triggerKeys: MmfV2RowKey[]
}

const mmfV2PriorityOrder = [
  'MMF_V2_TREND_DOWN_RETURN',
  'MMF_V2_TREND_UP_RETURN',
  'MMF_V2_TREND_DOWN_DIVERGENCE',
  'MMF_V2_TREND_UP_DIVERGENCE',
  'MMF_V2_TREND_DOWN_REBOUND',
  'MMF_V2_TREND_UP_PULLBACK',
  'MMF_V2_EXPECTED_RESISTANCE',
  'MMF_V2_EXPECTED_SUPPORT',
  'MMF_V2_SUPPORT_DOWN_BREAK',
  'MMF_V2_SUPPORT_UP_BREAK',
  'MMF_V2_RESISTANCE_UP_BREAK',
  'MMF_V2_RESISTANCE_DOWN_BREAK',
]

export const mmfV2MarkerPriorityRules: MmfV2MarkerPriorityRule[] = mmfV2SignalCatalog
  .filter((entry) => entry.replaces.length > 0)
  .sort((left, right) => mmfV2PriorityOrder.indexOf(left.id) - mmfV2PriorityOrder.indexOf(right.id))
  .map((entry) => ({
    triggerKeys: [entry.markerKey],
    removeKeys: entry.replaces,
  }))

export function createEmptyMmfV2Rows(length: number): MmfV2IndicatorRow[] {
  return Array.from({ length }, () => ({}))
}

export function createMmfV2RowsFromMarkers(realRows: KLineData[], markers: MmfV2IndicatorMarker[]) {
  const rows = createEmptyMmfV2Rows(realRows.length)
  const resolveRowIndex = createBarIndexResolver(realRows)

  markers.forEach((marker) => {
    const index = resolveRowIndex(marker.markerBarKey, marker.time, marker.index ?? marker.markerIndex)
    const price = Number(marker.price)
    if (!Number.isFinite(index) || index < 0 || index >= rows.length || !Number.isFinite(price)) return
    const entryIndex = resolveRowIndex(marker.entryBarKey ?? marker.confirmBarKey, marker.entryTime ?? marker.confirmTime, marker.entryIndex ?? marker.confirmIndex)
    const eventIndex = resolveRowIndex(marker.eventBarKey, marker.eventTime, marker.eventIndex)
    const entryPrice = Number(marker.entryPrice)
    const pointDistance = Number(marker.pointDistance)

    if (marker.type === 'MMF_V2_SUPPORT_DOWN_BREAK') {
      rows[index] = { ...rows[index], supportDownBreakMarker: price, supportDownBreakMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_SUPPORT_UP_BREAK') {
      rows[index] = { ...rows[index], supportUpBreakMarker: price, supportUpBreakMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_RESISTANCE_UP_BREAK') {
      rows[index] = { ...rows[index], resistanceUpBreakMarker: price, resistanceUpBreakMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_RESISTANCE_DOWN_BREAK') {
      rows[index] = { ...rows[index], resistanceDownBreakMarker: price, resistanceDownBreakMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_EXPECTED_RESISTANCE') {
      rows[index] = { ...rows[index], expectedResistanceMarker: price, expectedResistanceMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_EXPECTED_SUPPORT') {
      rows[index] = { ...rows[index], expectedSupportMarker: price, expectedSupportMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_TREND_DOWN_REBOUND') {
      rows[index] = { ...rows[index], trendDownReboundMarker: price, trendDownReboundMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_TREND_UP_PULLBACK') {
      rows[index] = { ...rows[index], trendUpPullbackMarker: price, trendUpPullbackMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_TREND_DOWN_RETURN') {
      rows[index] = { ...rows[index], trendDownReturnMarker: price, trendDownReturnMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_TREND_UP_RETURN') {
      rows[index] = { ...rows[index], trendUpReturnMarker: price, trendUpReturnMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_TREND_DOWN_DIVERGENCE') {
      rows[index] = { ...rows[index], trendDownDivergenceMarker: price, trendDownDivergenceMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V2_TREND_UP_DIVERGENCE') {
      rows[index] = { ...rows[index], trendUpDivergenceMarker: price, trendUpDivergenceMarkerPrice: price }
      return
    }

    if (marker.type === 'MMF_V2_HIGH' || marker.type === 'MMF_V2_RESISTANCE') {
      const markerPatch = marker.type === 'MMF_V2_RESISTANCE'
        ? { highMarker: price, highMarkerPrice: price, resistanceMarker: price, resistanceMarkerPrice: price }
        : { highMarker: price, highMarkerPrice: price }
      rows[index] = { ...rows[index], ...markerPatch }
      if (Number.isFinite(eventIndex) && eventIndex >= 0 && eventIndex < rows.length) {
        const deadCrossY = Number(realRows[eventIndex]?.high)
        rows[eventIndex] = {
          ...rows[eventIndex],
          deadCrossMarker: Number.isFinite(deadCrossY) ? deadCrossY : price,
          deadCrossMarkerPrice: Number.isFinite(deadCrossY) ? deadCrossY : price,
        }
      }
      if (Number.isFinite(entryIndex) && entryIndex >= 0 && entryIndex < rows.length && Number.isFinite(entryPrice)) {
        const highConfirmPointY = Number(realRows[entryIndex]?.high)
        rows[entryIndex] = {
          ...rows[entryIndex],
          highConfirmPointMarker: Number.isFinite(highConfirmPointY) ? highConfirmPointY : entryPrice,
          highConfirmPointMarkerPrice: entryPrice,
          highConfirmPointDistance: pointDistance,
        }
      }
    }

    if (marker.type === 'MMF_V2_LOW' || marker.type === 'MMF_V2_SUPPORT') {
      const markerPatch = marker.type === 'MMF_V2_SUPPORT'
        ? { lowMarker: price, lowMarkerPrice: price, supportMarker: price, supportMarkerPrice: price }
        : { lowMarker: price, lowMarkerPrice: price }
      rows[index] = { ...rows[index], ...markerPatch }
      if (Number.isFinite(eventIndex) && eventIndex >= 0 && eventIndex < rows.length) {
        const goldenCrossY = Number(realRows[eventIndex]?.low)
        rows[eventIndex] = {
          ...rows[eventIndex],
          goldenCrossMarker: Number.isFinite(goldenCrossY) ? goldenCrossY : price,
          goldenCrossMarkerPrice: Number.isFinite(goldenCrossY) ? goldenCrossY : price,
        }
      }
      if (Number.isFinite(entryIndex) && entryIndex >= 0 && entryIndex < rows.length && Number.isFinite(entryPrice)) {
        const lowConfirmPointY = Number(realRows[entryIndex]?.low)
        rows[entryIndex] = {
          ...rows[entryIndex],
          lowConfirmPointMarker: Number.isFinite(lowConfirmPointY) ? lowConfirmPointY : entryPrice,
          lowConfirmPointMarkerPrice: entryPrice,
          lowConfirmPointDistance: pointDistance,
        }
      }
    }
  })

  applyMmfV2MarkerPriorityRules(rows)
  return rows
}

function applyMmfV2MarkerPriorityRules(rows: MmfV2IndicatorRow[]) {
  rows.forEach((row) => {
    for (const rule of mmfV2MarkerPriorityRules) {
      if (!rule.triggerKeys.some((key) => Number.isFinite(row[key]))) {
        continue
      }
      rule.removeKeys.forEach((key) => {
        delete row[key]
      })
    }
  })
}
