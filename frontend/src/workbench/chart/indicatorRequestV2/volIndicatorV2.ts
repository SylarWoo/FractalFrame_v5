import { normalizeVolSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { VolIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export const storeV6VolIndicatorIdV2 = 'VOL'
export const storeV6VolPaneIdV2 = 'main-volume-overlay'

type VolIndicatorRowV2 = {
  barKey: string
  close: number
  globalIndex: number | null
  open: number
  time: number
  timestamp: number
  volume: number
  volumeColorIndex: 0 | 1
  volumeMa?: number
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function calculateSma(values: number[], period: number) {
  const result: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index]
    if (index >= period) sum -= values[index - period]
    if (index >= period - 1) result[index] = sum / period
  }
  return result
}

function colorIndex(rows: StoreV6WindowKLine[], index: number, settings: VolIndicatorSettings): 0 | 1 {
  const current = rows[index]
  const previous = rows[index - 1]
  if (settings.colorBasedOnPreviousClose && previous) {
    return finiteNumber(current.close) >= finiteNumber(previous.close) ? 0 : 1
  }
  return finiteNumber(current.close) >= finiteNumber(current.open) ? 0 : 1
}

function rowsFromKLines(rows: StoreV6WindowKLine[], settings: VolIndicatorSettings): VolIndicatorRowV2[] {
  const volumes = rows.map((row) => Math.max(0, finiteNumber(row.volume)))
  const maLength = Math.max(1, Math.min(Math.round(Number(settings.maLength)), 500))
  const maValues = calculateSma(volumes, maLength)
  return rows.map((row, index) => ({
    barKey: row.barKey,
    close: finiteNumber(row.close),
    globalIndex: row.globalIndex,
    open: finiteNumber(row.open),
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
    volume: volumes[index],
    volumeColorIndex: colorIndex(rows, index, settings),
    volumeMa: maValues[index],
  }))
}

function normalizeRequestSettings(request: StoreV6IndicatorRequestSpecV2) {
  return normalizeVolSettings(request.params as Partial<VolIndicatorSettings> | undefined)
}

export const storeV6VolIndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<Partial<VolIndicatorSettings>> = {
  calculationMode: 'mixed',
  calculateHistory: (context) => {
    const settings = normalizeRequestSettings(context.request)
    return {
      [storeV6VolIndicatorIdV2]: {
        displayRows: rowsFromKLines(context.displayRows, settings),
        key: `${storeV6VolIndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
        rows: rowsFromKLines(context.calculationRows, settings),
        settings,
        source: 'store-v6-vol-indicator-v2',
      },
    }
  },
  calculateRealtime: (context) => {
    const settings = normalizeRequestSettings(context.request)
    return {
      [storeV6VolIndicatorIdV2]: {
        displayRows: rowsFromKLines(context.activeRows, settings),
        key: `${storeV6VolIndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
        rows: rowsFromKLines([...context.historyRows, ...context.activeRows], settings),
        settings,
        source: 'store-v6-vol-indicator-v2',
      },
    }
  },
  id: storeV6VolIndicatorIdV2,
  paneId: storeV6VolPaneIdV2,
  paneRole: 'main',
  renderRole: 'main-overlay',
  warmup: {
    historyRows: (request) => normalizeRequestSettings(request).maChecked ? normalizeRequestSettings(request).maLength : 0,
    mode: 'fixedRows',
    realtimeRows: (request) => normalizeRequestSettings(request).maChecked ? normalizeRequestSettings(request).maLength : 0,
  },
}
