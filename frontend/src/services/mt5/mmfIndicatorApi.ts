import { getMt5Json } from './mt5ApiClient'
import { buildMt5ApiUrl } from './mt5ApiClient'

export type MmfIndicatorMarker = {
  type: 'MMF_HIGH' | 'MMF_LOW'
  index: number
  time: number
  price: number
  startIndex: number
  startTime: number
  endIndex: number
  endTime: number
  confirmThreshold: number
  confirmCrossIndex: number
}

export type MmfIndicatorPayload = {
  ok: boolean
  status?: string
  symbol?: string
  timeframe?: string
  mode?: string
  rowsCount: number
  markersCount: number
  markers: MmfIndicatorMarker[]
  error?: string
  metadata?: Record<string, unknown>
}

export async function fetchMmfIndicatorMarkers(options: {
  symbol: string
  timeframe?: string
  mode?: string
  baseTimeframe?: string
  anchor?: string
  timeFrom?: number
  timeTo?: number
  limit?: number
  dpoValue?: number
  highMorganRatio?: number | string
  highOffsetPercent?: number
  lowDpoValue?: number
  lowMorganRatio?: number | string
  lowOffsetPercent?: number
  showHigh?: boolean
  showLow?: boolean
  stochDSmoothing?: number
  stochKSmoothing?: number
  stochLength?: number
}): Promise<MmfIndicatorPayload> {
  const params = new URLSearchParams()
  params.set('symbol', options.symbol)
  params.set('timeframe', options.timeframe ?? 'M5')
  params.set('mode', options.mode ?? 'direct')
  if (options.baseTimeframe) params.set('baseTimeframe', options.baseTimeframe)
  if (options.anchor) params.set('anchor', options.anchor)
  if (typeof options.timeFrom === 'number') params.set('timeFrom', String(options.timeFrom))
  if (typeof options.timeTo === 'number') params.set('timeTo', String(options.timeTo))
  if (typeof options.limit === 'number') params.set('limit', String(options.limit))
  if (typeof options.dpoValue === 'number') params.set('dpoValue', String(options.dpoValue))
  if (options.highMorganRatio != null) params.set('highMorganRatio', String(options.highMorganRatio))
  if (typeof options.highOffsetPercent === 'number') params.set('highOffsetPercent', String(options.highOffsetPercent))
  if (typeof options.lowDpoValue === 'number') params.set('lowDpoValue', String(options.lowDpoValue))
  if (options.lowMorganRatio != null) params.set('lowMorganRatio', String(options.lowMorganRatio))
  if (typeof options.lowOffsetPercent === 'number') params.set('lowOffsetPercent', String(options.lowOffsetPercent))
  if (typeof options.showHigh === 'boolean') params.set('showHigh', options.showHigh ? '1' : '0')
  if (typeof options.showLow === 'boolean') params.set('showLow', options.showLow ? '1' : '0')
  if (typeof options.stochDSmoothing === 'number') params.set('stochDSmoothing', String(options.stochDSmoothing))
  if (typeof options.stochKSmoothing === 'number') params.set('stochKSmoothing', String(options.stochKSmoothing))
  if (typeof options.stochLength === 'number') params.set('stochLength', String(options.stochLength))

  return getMt5Json<MmfIndicatorPayload>(
    '/api/indicators/v1/mmf',
    params,
    { requirePayloadOk: true },
  )
}

export async function calculateMmfIndicatorMarkers(options: {
  rows: Array<{
    time: number
    open: number
    high: number
    low: number
    close: number
    volume?: number
  }>
  symbol: string
  timeframe: string
  settings: {
    dpoValue?: number
    highMorganRatio?: number | string
    highOffsetPercent?: number
    lowDpoValue?: number
    lowMorganRatio?: number | string
    lowOffsetPercent?: number
    showHigh?: boolean
    showLow?: boolean
    stochDSmoothing?: number
    stochKSmoothing?: number
    stochLength?: number
  }
}): Promise<MmfIndicatorPayload> {
  const response = await fetch(buildMt5ApiUrl('/api/indicators/v1/mmf/calculate'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
    cache: 'no-store',
  })
  const payload = (await response.json()) as MmfIndicatorPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}
