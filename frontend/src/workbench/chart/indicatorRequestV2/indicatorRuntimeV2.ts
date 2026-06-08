import type { StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

function normalizeIndicatorId(id: string) {
  return id.trim().toUpperCase()
}

function normalizeRequest(request: StoreV6IndicatorRequestSpecV2): StoreV6IndicatorRequestSpecV2 {
  return {
    ...request,
    id: normalizeIndicatorId(request.id),
  }
}

export type StoreV6IndicatorRuntimeV2 = {
  clear: () => void
  list: () => StoreV6IndicatorRequestSpecV2[]
  mount: (request: StoreV6IndicatorRequestSpecV2) => StoreV6IndicatorRequestSpecV2[]
  unmount: (id: string) => StoreV6IndicatorRequestSpecV2[]
  update: (request: StoreV6IndicatorRequestSpecV2) => StoreV6IndicatorRequestSpecV2[]
}

export function createStoreV6IndicatorRuntimeV2(initialRequests: StoreV6IndicatorRequestSpecV2[] = []): StoreV6IndicatorRuntimeV2 {
  const requests = new Map<string, StoreV6IndicatorRequestSpecV2>()
  initialRequests.forEach((request) => {
    const normalized = normalizeRequest(request)
    if (normalized.id) requests.set(normalized.id, normalized)
  })
  return {
    clear: () => requests.clear(),
    list: () => [...requests.values()].filter((request) => request.enabled !== false),
    mount: (request) => {
      const normalized = normalizeRequest({
        ...request,
        enabled: request.enabled ?? true,
      })
      if (normalized.id) requests.set(normalized.id, normalized)
      return [...requests.values()]
    },
    unmount: (id) => {
      requests.delete(normalizeIndicatorId(id))
      return [...requests.values()]
    },
    update: (request) => {
      const normalized = normalizeRequest(request)
      if (normalized.id) requests.set(normalized.id, normalized)
      return [...requests.values()]
    },
  }
}

export const storeV6IndicatorRuntimeV2 = createStoreV6IndicatorRuntimeV2()
