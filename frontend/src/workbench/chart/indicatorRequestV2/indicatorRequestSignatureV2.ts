import { createIndicatorSettingsHash } from '../indicatorPageSnapshotStore'
import type { StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export function createStoreV6IndicatorRequestSignatureV2(
  requests: StoreV6IndicatorRequestSpecV2[] | null | undefined,
) {
  if (!requests || requests.length === 0) return 'no-indicators'
  return requests
    .filter((request) => request.enabled !== false)
    .map((request) => [
      request.id.trim().toUpperCase(),
      request.enabled === false ? 'off' : 'on',
      request.paneId ?? '',
      createIndicatorSettingsHash(request.params ?? null),
    ].join(':'))
    .join('|')
}
