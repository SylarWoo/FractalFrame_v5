import { readSettingsNumberStringValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'

const systemTotalDigits = 7

export type GlobalPricePrecisionContext = {
  assetType?: string | null
  market?: string | null
  symbol?: string | null
}

function integerDigitCount(value: number) {
  const abs = Math.abs(value)
  if (!Number.isFinite(abs) || abs < 1) return 1
  return Math.floor(abs).toString().length
}

function isIndexContext(context?: GlobalPricePrecisionContext) {
  const symbol = String(context?.symbol ?? '').trim().toUpperCase()
  const assetType = String(context?.assetType ?? '').trim()
  const market = String(context?.market ?? '').trim().toLowerCase()
  return symbol.startsWith('DXY') ||
    symbol.startsWith('USDX') ||
    assetType.includes('指数') ||
    market.includes('index') ||
    market.includes('indices')
}

export function readGlobalPricePrecisionSetting() {
  return readSettingsNumberStringValue(chartSettingKeys.pricePrecision, chartSettingDefaults.pricePrecision)
}

export function resolveGlobalPricePrecision(value: number | null | undefined, fallback = 3, context?: GlobalPricePrecisionContext) {
  const raw = readGlobalPricePrecisionSetting()
  if (raw !== 'system') {
    const precision = Number(raw)
    return Number.isFinite(precision) ? Math.max(0, Math.min(Math.round(precision), 7)) : fallback
  }
  if (isIndexContext(context)) return 3
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(systemTotalDigits - integerDigitCount(value), 7))
}

export function formatGlobalPrice(value: number | null | undefined, fallback = '-', context?: GlobalPricePrecisionContext) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return value.toFixed(resolveGlobalPricePrecision(value, 3, context))
}

export function formatGlobalPriceDelta(
  value: number | null | undefined,
  referencePrice: number | null | undefined,
  fallback = '-',
  context?: GlobalPricePrecisionContext,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const precision = resolveGlobalPricePrecision(referencePrice, 3, context)
  return value.toFixed(precision)
}
