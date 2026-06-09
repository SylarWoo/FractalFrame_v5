import { createIndicatorSettingsHash } from '../indicatorPageSnapshotStore'
import type { StoreV6HistoryPageWindow, StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

const styleFieldPattern = /(?:Color|Opacity|LineStyle|LineWidth|Visible|Width)$/
const styleFieldNames = new Set([
  'inputsInStatusLine',
  'inputStatusLineVisible',
  'labelsOnPriceScale',
  'priceScaleLabelsVisible',
  'precision',
  'statusLineValuesVisible',
  'valuesInStatusLine',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stripStyleOnlySettings(value: unknown): unknown {
  if (!isPlainObject(value)) return value
  const next: Record<string, unknown> = {}
  Object.entries(value).forEach(([key, child]) => {
    if (styleFieldPattern.test(key) || styleFieldNames.has(key)) return
    next[key] = stripStyleOnlySettings(child)
  })
  return next
}

function normalizeIndicatorId(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function createStoreV6CalculationIndicatorRequestsV2(
  requests: StoreV6IndicatorRequestSpecV2[] | null | undefined,
): StoreV6IndicatorRequestSpecV2[] {
  if (!requests || requests.length === 0) return []
  return requests.map((request) => ({
    ...request,
    params: stripStyleOnlySettings(request.params),
  }))
}

export function createStoreV6IndicatorRenderSettingsSignatureV2(
  requests: StoreV6IndicatorRequestSpecV2[] | null | undefined,
) {
  if (!requests || requests.length === 0) return 'no-render-settings'
  return requests
    .filter((request) => request.enabled !== false)
    .map((request) => [
      request.id.trim().toUpperCase(),
      request.paneId ?? '',
      createIndicatorSettingsHash(request.params ?? null),
    ].join(':'))
    .join('|')
}

function renderSettingsByIndicatorId(requests: StoreV6IndicatorRequestSpecV2[]) {
  const settingsById = new Map<string, unknown>()
  requests.forEach((request) => {
    if (request.enabled === false) return
    settingsById.set(normalizeIndicatorId(request.id), request.params ?? null)
  })
  return settingsById
}

function applyRenderSettingsToIndicators(
  indicators: StoreV6HistoryPageWindowIndicators,
  requests: StoreV6IndicatorRequestSpecV2[],
) {
  const settingsById = renderSettingsByIndicatorId(requests)
  let changed = false
  const nextIndicators: StoreV6HistoryPageWindowIndicators = {}
  Object.entries(indicators).forEach(([key, series]) => {
    const settings = settingsById.get(normalizeIndicatorId(series.id ?? key)) ?? settingsById.get(normalizeIndicatorId(key))
    if (settings === undefined) {
      nextIndicators[key] = series
      return
    }
    nextIndicators[key] = {
      ...series,
      settings,
      key: `${series.key}:render-settings:${createIndicatorSettingsHash(settings)}`,
    }
    changed = true
  })
  return changed ? nextIndicators : indicators
}

export function applyStoreV6IndicatorRenderSettingsToHistoryWindowV2(
  historyWindow: StoreV6HistoryPageWindow | null,
  requests: StoreV6IndicatorRequestSpecV2[],
  renderSettingsSignature: string,
) {
  if (!historyWindow || requests.length === 0) return historyWindow
  const indicators = applyRenderSettingsToIndicators(historyWindow.indicators, requests)
  if (indicators === historyWindow.indicators) return historyWindow
  return {
    ...historyWindow,
    indicators,
    key: `${historyWindow.key}:render-settings:${renderSettingsSignature}`,
    renderData: {
      ...historyWindow.renderData,
      indicators,
    },
  }
}

export function applyStoreV6IndicatorRenderSettingsToRealtimeWindowV2(
  realtimeWindow: StoreV6RealtimePageWindow | null,
  requests: StoreV6IndicatorRequestSpecV2[],
  renderSettingsSignature: string,
) {
  if (!realtimeWindow || requests.length === 0) return realtimeWindow
  const indicators = applyRenderSettingsToIndicators(realtimeWindow.indicators, requests)
  if (indicators === realtimeWindow.indicators) return realtimeWindow
  return {
    ...realtimeWindow,
    indicators,
    key: `${realtimeWindow.key}:render-settings:${renderSettingsSignature}`,
    renderData: {
      ...realtimeWindow.renderData,
      indicators,
    },
  }
}
