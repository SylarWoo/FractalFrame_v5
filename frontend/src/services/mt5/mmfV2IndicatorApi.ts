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
  type: 'MMF_V2_HIGH' | 'MMF_V2_LOW' | 'MMF_V2_SUPPORT' | 'MMF_V2_RESISTANCE' | 'MMF_V2_TOP_DIVERGENCE' | 'MMF_V2_BOTTOM_DIVERGENCE' | 'MMF_V2_EXPECTED_SUPPORT' | 'MMF_V2_EXPECTED_RESISTANCE' | 'MMF_V2_TREND_DOWN_REBOUND' | 'MMF_V2_TREND_UP_PULLBACK' | 'MMF_V2_TREND_DOWN_RETURN' | 'MMF_V2_TREND_UP_RETURN' | 'MMF_V2_TREND_DOWN_DIVERGENCE' | 'MMF_V2_TREND_UP_DIVERGENCE' | 'MMF_V2_SUPPORT_DOWN_BREAK' | 'MMF_V2_SUPPORT_UP_BREAK' | 'MMF_V2_RESISTANCE_DOWN_BREAK' | 'MMF_V2_RESISTANCE_UP_BREAK' | 'MMF_V2_TRUE_CLOSE_DOWN' | 'MMF_V2_TRUE_CLOSE_UP' | 'MMF_V2_BULL_MARKET' | 'MMF_V2_BEAR_MARKET' | 'MMF_V2_OVERBOUGHT' | 'MMF_V2_OVERBOUGHT_CLOSE' | 'MMF_V2_OVERSOLD' | 'MMF_V2_OVERSOLD_CLOSE' | 'MMF_V2_TSI_DEAD_CROSS' | 'MMF_V2_TSI_DEAD_CROSS_CONFIRM' | 'MMF_V2_TSI_GOLDEN_CROSS' | 'MMF_V2_TSI_GOLDEN_CROSS_CONFIRM' | 'MMF_V2_LOW_POSITION_HIGH' | 'MMF_V2_HIGH_POSITION_LOW'
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

export type MmfV2SignalFrameSignal = {
  signalId: string
  type: MmfV2IndicatorMarker['type'] | string
  catalogId?: string
  label?: string
  category?: string
  direction?: string
  role?: string
  timing?: string
  layer?: string
  strategyIntent?: string
  markerIndex: number
  markerBarKey?: string
  markerTime: number
  markerPrice: number
  entryIndex: number
  entryBarKey?: string
  entryTime: number
  entryPrice: number
  eventIndex: number
  confirmIndex: number
  pointDistance?: number
  metrics?: Record<string, number | null>
  momentum?: {
    bars?: number | null
    direction: string
    endIndex: number
    kind: 'breakout' | 'close' | 'high_low' | string
    previousSignalId?: string | null
    previousType?: string | null
    startIndex: number
    value?: number | null
  }
  reason: string[]
}

export type MmfV2SignalFrameRow = {
  index: number
  barKey: string
  sourceIndex?: number | null
  time: number
  open: number
  high: number
  low: number
  close: number
  stoch: {
    d?: number | null
    k?: number | null
  }
  vdo: {
    base2Ma?: number | null
    baseMa?: number | null
    crossDownLower: boolean
    crossDownLower2: boolean
    crossDownLower3: boolean
    crossDownUpper: boolean
    crossDownUpper2: boolean
    crossDownUpper3: boolean
    crossDownZero: boolean
    crossUpLower: boolean
    crossUpLower2: boolean
    crossUpLower3: boolean
    crossUpUpper: boolean
    crossUpUpper2: boolean
    crossUpUpper3: boolean
    crossUpZero: boolean
    delta?: number | null
    direction?: number | null
    value?: number | null
    zoneCode?: number | null
  }
  vmi?: {
    crossDownZero: boolean
    crossUpZero: boolean
    delta?: number | null
    direction?: number | null
    fastMa?: number | null
    histogram?: number | null
    slowMa?: number | null
  }
  ma: {
    length: number
    source: string
    type: string
    value?: number | null
  }
  morgan: {
    center?: number | null
    levels: Record<string, number | null>
    positionRatio?: number | null
    segmentIndex?: number | null
    trueRange?: number | null
  }
  signalCount: number
  signalFlags: Record<string, boolean>
  signalIds: string[]
  signals: MmfV2SignalFrameSignal[]
  signalTypes: string[]
}

export type MmfV2BackendMomentumSample = {
  bars?: number | null
  direction: string
  endIndex: number
  entryIndex: number
  kind: 'breakout' | 'close' | 'high_low' | string
  markerBarKey?: string
  markerIndex: number
  markerTime?: number
  momentum: number
  previousSignalId?: string | null
  previousType?: string | null
  signalId?: string
  startIndex: number
  type?: MmfV2IndicatorMarker['type'] | string
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
  momentumSamples?: MmfV2BackendMomentumSample[]
  momentumSamplesCount?: number
  momentumSummary?: Record<string, unknown>
  signalCatalog?: Array<Record<string, unknown>>
  signals?: MmfV2SignalRecord[]
  signalsCount?: number
  signalFrame?: MmfV2SignalFrameRow[]
  signalFrameCount?: number
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

export type MmfV2IndicatorRequest = {
  includeDebug?: boolean
  includeSignalFrame?: boolean
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
}

type MmfV2IndicatorJobStartPayload = {
  ok: boolean
  status: 'ready' | 'pending' | 'running' | 'failed' | string
  jobId?: string | null
  result?: MmfV2IndicatorPayload
  error?: string
}

type MmfV2IndicatorJobResultPayload = MmfV2IndicatorJobStartPayload

async function postMmfV2IndicatorCalculate(path: string, options: MmfV2IndicatorRequest): Promise<unknown> {
  const response = await fetch(buildMt5ApiUrl('/api/indicators/v2/mmf/calculate'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
    cache: 'no-store',
  })
  if (path !== '/api/indicators/v2/mmf/calculate') {
    throw new Error('invalid_mmf_v2_post_path')
  }
  const payload = await response.json()
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

async function postMmfV2IndicatorJob(path: string, options: MmfV2IndicatorRequest): Promise<MmfV2IndicatorJobStartPayload> {
  const response = await fetch(buildMt5ApiUrl(path), {
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
  return payload as unknown as MmfV2IndicatorJobStartPayload
}

async function fetchMmfV2IndicatorJob(jobId: string): Promise<MmfV2IndicatorJobResultPayload> {
  const response = await fetch(buildMt5ApiUrl(`/api/indicators/v2/mmf/jobs/result?jobId=${encodeURIComponent(jobId)}`), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = (await response.json()) as MmfV2IndicatorJobResultPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

export async function calculateMmfV2IndicatorMarkers(options: MmfV2IndicatorRequest): Promise<MmfV2IndicatorPayload> {
  try {
    const started = await postMmfV2IndicatorJob('/api/indicators/v2/mmf/jobs/start', options)
    if (started.status === 'ready' && started.result) return started.result
    const jobId = started.jobId
    if (!jobId) throw new Error(started.error || started.status || 'mmf_v2_job_id_missing')
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await delay(attempt < 10 ? 80 : 160)
      const payload = await fetchMmfV2IndicatorJob(jobId)
      if (payload.status === 'ready' && payload.result) return payload.result
      if (payload.status === 'failed') throw new Error(payload.error || 'mmf_v2_job_failed')
    }
    throw new Error('mmf_v2_job_timeout')
  } catch {
    return postMmfV2IndicatorCalculate('/api/indicators/v2/mmf/calculate', options) as Promise<MmfV2IndicatorPayload>
  }
}
