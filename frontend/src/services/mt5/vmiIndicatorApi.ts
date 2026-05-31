import { buildMt5ApiUrl } from './mt5ApiClient'

export type VmiBackendRow = {
  crossDownZero?: boolean
  crossUpZero?: boolean
  delta?: number | null
  direction?: number | null
  fastMa?: number | null
  histogram?: number | null
  slowMa?: number | null
}

export async function calculateVmiIndicatorRows(options: {
  rows: Array<{
    barKey?: string
    close: number
    high: number
    low: number
    open: number
    sourceIndex?: number
    time: number
    volume?: number
  }>
  settings?: Record<string, unknown>
  symbol: string
  timeframe: string
}): Promise<{ rows: VmiBackendRow[]; rowsCount: number }> {
  const response = await fetch(buildMt5ApiUrl('/api/indicators/v1/vmi/calculate'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
    cache: 'no-store',
  })
  const payload = await response.json() as { ok?: boolean; rows?: VmiBackendRow[]; rowsCount?: number; status?: string; error?: string }
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    rowsCount: Number(payload.rowsCount) || 0,
  }
}
