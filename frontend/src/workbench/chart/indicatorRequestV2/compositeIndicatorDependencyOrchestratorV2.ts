import { createIndicatorSettingsHash } from '../indicatorPageSnapshotStore'
import type { StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export type StoreV6CompositeIndicatorPlanV2 = {
  computeRequests: StoreV6IndicatorRequestSpecV2[]
  visibleRequestKeys: Set<string>
}

function normalizeIndicatorId(id: string) {
  return id.trim().toUpperCase()
}

export function createStoreV6IndicatorComputeKeyV2(request: StoreV6IndicatorRequestSpecV2) {
  return [
    normalizeIndicatorId(request.id),
    request.paneId ?? '',
    createIndicatorSettingsHash(request.params ?? null),
  ].join(':')
}

function mergeRequestMetadata(
  left: StoreV6IndicatorRequestSpecV2,
  right: StoreV6IndicatorRequestSpecV2,
): StoreV6IndicatorRequestSpecV2 {
  const visible = left.visible !== false || right.visible !== false
  return {
    ...left,
    ...right,
    dependencyOf: [...new Set([...(left.dependencyOf ?? []), ...(right.dependencyOf ?? [])])],
    requestedBy: [...new Set([...(left.requestedBy ?? []), ...(right.requestedBy ?? [])])],
    visible,
  }
}

export function planCompositeIndicatorDependenciesV2(
  requests: StoreV6IndicatorRequestSpecV2[] | null | undefined,
): StoreV6CompositeIndicatorPlanV2 {
  const visibleRequests = (requests ?? [])
    .filter((request) => request.enabled !== false)
    .map((request) => ({
      ...request,
      requestedBy: [...new Set(['user', ...(request.requestedBy ?? [])])],
      visible: request.visible !== false,
    }))
  const visibleRequestKeys = new Set(visibleRequests.map(createStoreV6IndicatorComputeKeyV2))
  const byKey = new Map<string, StoreV6IndicatorRequestSpecV2>()
  visibleRequests.forEach((request) => {
    const key = createStoreV6IndicatorComputeKeyV2(request)
    const existing = byKey.get(key)
    byKey.set(key, existing ? mergeRequestMetadata(existing, request) : request)
  })

  return {
    computeRequests: [...byKey.values()],
    visibleRequestKeys,
  }
}
