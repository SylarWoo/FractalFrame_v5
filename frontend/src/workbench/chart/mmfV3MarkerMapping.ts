import type { KLineData } from 'klinecharts'
import type { MmfV3IndicatorMarker } from '../../services/mt5/mmfV3IndicatorApi'
import { createBarIndexResolver } from './barIdentity'
import { mmfV3SignalCatalog } from './mmfV3SignalCatalog'
import type { MmfV3IndicatorRow } from './mmfV3Types'

type MmfV3RowKey = keyof MmfV3IndicatorRow

type MmfV3MarkerPriorityRule = {
  removeKeys: MmfV3RowKey[]
  triggerKeys: MmfV3RowKey[]
}

const mmfV3PriorityOrder = [
  'MMF_V3_TREND_DOWN_RETURN',
  'MMF_V3_TREND_UP_RETURN',
  'MMF_V3_TREND_DOWN_DIVERGENCE',
  'MMF_V3_TREND_UP_DIVERGENCE',
  'MMF_V3_TOP_DIVERGENCE',
  'MMF_V3_BOTTOM_DIVERGENCE',
  'MMF_V3_TREND_DOWN_REBOUND',
  'MMF_V3_TREND_UP_PULLBACK',
  'MMF_V3_RESISTANCE',
  'MMF_V3_SUPPORT',
  'MMF_V3_EXPECTED_RESISTANCE',
  'MMF_V3_EXPECTED_SUPPORT',
  'MMF_V3_SUPPORT_DOWN_BREAK',
  'MMF_V3_SUPPORT_UP_BREAK',
  'MMF_V3_RESISTANCE_UP_BREAK',
  'MMF_V3_RESISTANCE_DOWN_BREAK',
]

export const mmfV3MarkerPriorityRules: MmfV3MarkerPriorityRule[] = mmfV3SignalCatalog
  .filter((entry) => entry.replaces.length > 0)
  .sort((left, right) => mmfV3PriorityOrder.indexOf(left.id) - mmfV3PriorityOrder.indexOf(right.id))
  .map((entry) => ({
    triggerKeys: [entry.markerKey],
    removeKeys: entry.replaces,
  }))

export function createEmptyMmfV3Rows(length: number): MmfV3IndicatorRow[] {
  return Array.from({ length }, () => ({}))
}

export function createMmfV3RowsFromMarkers(realRows: KLineData[], markers: MmfV3IndicatorMarker[]) {
  const rows = createEmptyMmfV3Rows(realRows.length)
  const resolveRowIndex = createBarIndexResolver(realRows)

  markers.forEach((marker) => {
    const index = resolveRowIndex(marker.markerBarKey, marker.time, marker.index ?? marker.markerIndex)
    const price = Number(marker.price)
    if (!Number.isFinite(index) || index < 0 || index >= rows.length || !Number.isFinite(price)) return
    const entryIndex = resolveRowIndex(marker.entryBarKey ?? marker.confirmBarKey, marker.entryTime ?? marker.confirmTime, marker.entryIndex ?? marker.confirmIndex)
    const eventIndex = resolveRowIndex(marker.eventBarKey, marker.eventTime, marker.eventIndex)
    const entryPrice = Number(marker.entryPrice)
    const pointDistance = Number(marker.pointDistance)

    if (marker.type === 'MMF_V3_SUPPORT_DOWN_BREAK') {
      rows[index] = { ...rows[index], supportDownBreakMarker: price, supportDownBreakMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_SUPPORT_UP_BREAK') {
      rows[index] = { ...rows[index], supportUpBreakMarker: price, supportUpBreakMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_RESISTANCE_UP_BREAK') {
      rows[index] = { ...rows[index], resistanceUpBreakMarker: price, resistanceUpBreakMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_RESISTANCE_DOWN_BREAK') {
      rows[index] = { ...rows[index], resistanceDownBreakMarker: price, resistanceDownBreakMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TRUE_CLOSE_UP') {
      rows[index] = { ...rows[index], trueCloseUpMarker: price, trueCloseUpMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TRUE_CLOSE_DOWN') {
      rows[index] = { ...rows[index], trueCloseDownMarker: price, trueCloseDownMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_BULL_MARKET') {
      rows[index] = { ...rows[index], bullMarketMarker: price, bullMarketMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_BEAR_MARKET') {
      rows[index] = { ...rows[index], bearMarketMarker: price, bearMarketMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_OVERBOUGHT') {
      rows[index] = { ...rows[index], overboughtMarker: price, overboughtMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_OVERBOUGHT_CLOSE') {
      rows[index] = { ...rows[index], overboughtCloseMarker: price, overboughtCloseMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_OVERSOLD') {
      rows[index] = { ...rows[index], oversoldMarker: price, oversoldMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_OVERSOLD_CLOSE') {
      rows[index] = { ...rows[index], oversoldCloseMarker: price, oversoldCloseMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TSI_DEAD_CROSS') {
      rows[index] = { ...rows[index], tsiDeadCrossMarker: price, tsiDeadCrossMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TSI_DEAD_CROSS_CONFIRM') {
      rows[index] = { ...rows[index], tsiDeadCrossConfirmMarker: price, tsiDeadCrossConfirmMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TSI_GOLDEN_CROSS') {
      rows[index] = { ...rows[index], tsiGoldenCrossMarker: price, tsiGoldenCrossMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TSI_GOLDEN_CROSS_CONFIRM') {
      rows[index] = { ...rows[index], tsiGoldenCrossConfirmMarker: price, tsiGoldenCrossConfirmMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_EXPECTED_RESISTANCE') {
      rows[index] = { ...rows[index], expectedResistanceMarker: price, expectedResistanceMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_EXPECTED_SUPPORT') {
      rows[index] = { ...rows[index], expectedSupportMarker: price, expectedSupportMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TREND_DOWN_REBOUND') {
      rows[index] = { ...rows[index], trendDownReboundMarker: price, trendDownReboundMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TREND_UP_PULLBACK') {
      rows[index] = { ...rows[index], trendUpPullbackMarker: price, trendUpPullbackMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TREND_DOWN_RETURN') {
      rows[index] = { ...rows[index], trendDownReturnMarker: price, trendDownReturnMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TREND_UP_RETURN') {
      rows[index] = { ...rows[index], trendUpReturnMarker: price, trendUpReturnMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TREND_DOWN_DIVERGENCE') {
      rows[index] = { ...rows[index], trendDownDivergenceMarker: price, trendDownDivergenceMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TREND_UP_DIVERGENCE') {
      rows[index] = { ...rows[index], trendUpDivergenceMarker: price, trendUpDivergenceMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_TOP_DIVERGENCE') {
      rows[index] = { ...rows[index], topDivergenceMarker: price, topDivergenceMarkerPrice: price }
      return
    }
    if (marker.type === 'MMF_V3_BOTTOM_DIVERGENCE') {
      rows[index] = { ...rows[index], bottomDivergenceMarker: price, bottomDivergenceMarkerPrice: price }
      return
    }

    if (marker.type === 'MMF_V3_HIGH' || marker.type === 'MMF_V3_RESISTANCE') {
      const markerPatch = marker.type === 'MMF_V3_RESISTANCE'
        ? { resistanceMarker: price, resistanceMarkerPrice: price }
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

    if (marker.type === 'MMF_V3_LOW' || marker.type === 'MMF_V3_SUPPORT') {
      const markerPatch = marker.type === 'MMF_V3_SUPPORT'
        ? { supportMarker: price, supportMarkerPrice: price }
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

  applyMmfV3MarkerPriorityRules(rows)
  return rows
}

function applyMmfV3MarkerPriorityRules(rows: MmfV3IndicatorRow[]) {
  rows.forEach((row) => {
    for (const rule of mmfV3MarkerPriorityRules) {
      if (!rule.triggerKeys.some((key) => Number.isFinite(row[key]))) {
        continue
      }
      rule.removeKeys.forEach((key) => {
        delete row[key]
      })
    }
  })
}
