type ApiPayload = {
  ok?: boolean
  status?: string
  error?: string
}

const defaultMt5ApiBase = 'http://127.0.0.1:8765'

export function resolveMt5ApiBase() {
  return String(
    import.meta.env.VITE_FRACTALFRAME_MARKET_DATA_HTTP_BASE || defaultMt5ApiBase,
  ).replace(/\/+$/, '')
}

export function buildMt5ApiUrl(path: string, params?: URLSearchParams) {
  const query = params?.toString()
  return `${resolveMt5ApiBase()}${path}${query ? `?${query}` : ''}`
}

export async function getMt5Json<T extends ApiPayload>(
  path: string,
  params?: URLSearchParams,
  options: { requirePayloadOk?: boolean } = {},
): Promise<T> {
  const response = await fetch(buildMt5ApiUrl(path, params), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = (await response.json()) as T
  if (!response.ok || (options.requirePayloadOk && payload.ok !== true)) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function postMt5Json<T extends ApiPayload>(
  path: string,
  params?: URLSearchParams,
  options: { requirePayloadOk?: boolean } = {},
): Promise<T> {
  const response = await fetch(buildMt5ApiUrl(path, params), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = (await response.json()) as T
  if (!response.ok || (options.requirePayloadOk && payload.ok !== true)) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export function createMt5EventSource(path: string, params?: URLSearchParams): EventSource {
  return new EventSource(buildMt5ApiUrl(path, params))
}
