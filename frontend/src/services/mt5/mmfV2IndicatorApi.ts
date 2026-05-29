import { buildMt5ApiUrl } from './mt5ApiClient'

export type MmfV2IndicatorMarker = {
  signalId?: string
  catalogId?: string
  label?: string
  category?: string
  direction?: string
  role?: string
  timing?: string
  layer?: string
  strategyIntent?: string
  defaultStyle?: {
    color?: string
    placement?: string
    size?: number
    symbol?: string
  }
  replaces?: string[]
  preserves?: string[]
  indicator?: 'MMF_V2' | string
  type: 'MMF_V2_HIGH' | 'MMF_V2_LOW' | 'MMF_V2_SUPPORT' | 'MMF_V2_RESISTANCE' | 'MMF_V2_EXPECTED_SUPPORT' | 'MMF_V2_EXPECTED_RESISTANCE' | 'MMF_V2_TREND_DOWN_REBOUND' | 'MMF_V2_TREND_UP_PULLBACK' | 'MMF_V2_TREND_DOWN_RETURN' | 'MMF_V2_TREND_UP_RETURN' | 'MMF_V2_TREND_DOWN_DIVERGENCE' | 'MMF_V2_TREND_UP_DIVERGENCE' | 'MMF_V2_SUPPORT_DOWN_BREAK' | 'MMF_V2_SUPPORT_UP_BREAK' | 'MMF_V2_RESISTANCE_DOWN_BREAK' | 'MMF_V2_RESISTANCE_UP_BREAK' | 'MMF_V2_LOW_POSITION_HIGH' | 'MMF_V2_HIGH_POSITION_LOW'
  eventIndex: number
  eventBarKey?: string
  eventTime?: number
  confirmIndex: number
  confirmBarKey?: string
  confirmTime?: number
  markerIndex: number
  markerBarKey?: string
  index: number
  time: number
  price: number
  entryIndex?: number
  entryBarKey?: string
  entryTime?: number
  entryPrice?: number
  pointDistance?: number
  windowStartIndex: number
  windowStartBarKey?: string
  windowStartTime?: number
  windowEndIndex: number
  windowEndBarKey?: string
  windowEndTime?: number
  metrics?: Record<string, number>
  reason: string[]
}

export type MmfV2SignalRecord = {
  signalId: string
  indicator: string
  type: MmfV2IndicatorMarker['type'] | string
  catalogId?: string
  label?: string
  category?: string
  direction?: string
  role?: string
  timing?: string
  layer?: string
  strategyIntent?: string
  defaultStyle?: MmfV2IndicatorMarker['defaultStyle']
  replaces?: string[]
  preserves?: string[]
  eventBarKey: string
  eventTime: number
  eventIndex: number
  confirmBarKey: string
  confirmTime: number
  confirmIndex: number
  markerBarKey: string
  markerTime: number
  markerIndex: number
  markerPrice: number
  entryBarKey: string
  entryTime: number
  entryIndex: number
  entryPrice: number
  windowStartBarKey: string
  windowStartTime: number
  windowStartIndex: number
  windowEndBarKey: string
  windowEndTime: number
  windowEndIndex: number
  pointDistance?: number
  metrics?: Record<string, number>
  reason: string[]
}

export type MmfV2IndicatorPayload = {
  ok: boolean
  status?: string
  symbol?: string
  timeframe?: string
  mode?: string
  version: 'MMF_V2'
  rowsCount: number
  markersCount: number
  markers: MmfV2IndicatorMarker[]
  signalCatalog?: Array<Record<string, unknown>>
  signals?: MmfV2SignalRecord[]
  signalsCount?: number
  debug?: {
    alignment?: {
      requestedBars?: number
      normalizedBars?: number
      droppedBars?: number
      droppedSourceIndexes?: number[]
      duplicateTimes?: number[]
      hasBarKey?: boolean
      barKeyUnique?: boolean
    }
    signals?: {
      records?: number
      signalIds?: string[]
      signalIdsUnique?: boolean
    }
    rows?: unknown[]
  } | null
  error?: string
  metadata?: Record<string, unknown>
}

export async function calculateMmfV2IndicatorMarkers(options: {
  includeDebug?: boolean
  rows: Array<{
    barKey?: string
    time: number
    open: number
    high: number
    low: number
    close: number
    sourceIndex?: number
    volume?: number
  }>
  settings?: Record<string, unknown>
  symbol: string
  timeframe: string
}): Promise<MmfV2IndicatorPayload> {
  const response = await fetch(buildMt5ApiUrl('/api/indicators/v2/mmf/calculate'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
    cache: 'no-store',
  })
  const payload = (await response.json()) as MmfV2IndicatorPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}
