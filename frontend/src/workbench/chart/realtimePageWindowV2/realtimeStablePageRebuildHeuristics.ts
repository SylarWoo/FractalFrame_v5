import type { StoreV6RealtimePageWindow } from './realtimePageWindowTypes'
import type { RealtimePageMonitorSnapshotV2 } from './realtimePageMonitorV2'

export type RealtimeStablePageAutoRebuildReason =
  | 'window_structure_inconsistent'
  | 'monitor_rows_ahead'
  | 'monitor_stable_time_ahead'
  | 'monitor_tail_ahead'

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function lastStableTime(window: StoreV6RealtimePageWindow) {
  return finiteNumber(window.stableRows[window.stableRows.length - 1]?.time)
}

function tailTime(window: StoreV6RealtimePageWindow) {
  return finiteNumber(window.tailRow?.time)
}

export function isRealtimeWindowStructurallyInconsistent(window: StoreV6RealtimePageWindow | null | undefined) {
  if (!window) return false
  const expectedRows = window.stableRows.length + (window.tailRow ? 1 : 0)
  if (window.activeRows.length !== expectedRows) return true
  if (!window.tailRow) return false
  const lastActive = window.activeRows[window.activeRows.length - 1]
  if (!lastActive) return true
  if (String(lastActive.barKey ?? '') !== String(window.tailRow.barKey ?? '')) return true
  if (finiteNumber(lastActive.time) !== tailTime(window)) return true
  const stableTailTime = lastStableTime(window)
  const currentTailTime = tailTime(window)
  return stableTailTime != null && currentTailTime != null && stableTailTime >= currentTailTime
}

export function shouldAutoRebuildRealtimeStablePage(options: {
  monitor: RealtimePageMonitorSnapshotV2 | null
  window: StoreV6RealtimePageWindow | null
}) {
  return resolveAutoRebuildRealtimeStablePageReason(options) != null
}

export function resolveAutoRebuildRealtimeStablePageReason(options: {
  monitor: RealtimePageMonitorSnapshotV2 | null
  window: StoreV6RealtimePageWindow | null
}): RealtimeStablePageAutoRebuildReason | null {
  const window = options.window
  if (!window || window.sessionTimeFrom == null) return null
  if (isRealtimeWindowStructurallyInconsistent(window)) return 'window_structure_inconsistent'
  const monitor = options.monitor
  if (!monitor) return null
  if (monitor.rows > window.stableRows.length) return 'monitor_rows_ahead'
  const monitorStableTime = finiteNumber(monitor.rangeTimeTo)
  const currentStableTime = lastStableTime(window)
  if (monitorStableTime != null && currentStableTime != null && monitorStableTime > currentStableTime) return 'monitor_stable_time_ahead'
  const monitorTail = finiteNumber(monitor.tailTime)
  const currentTail = tailTime(window)
  return monitorTail != null && currentTail != null && monitorTail > currentTail
    ? 'monitor_tail_ahead'
    : null
}
