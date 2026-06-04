export const workbenchEvents = {
  settingsSymbolChanged: 'fractalframe:settingsSymbolPanelChanged',
  realtimeEnabledChanged: 'fractalframe:mt5ImportCenterRealtimeEnabledChanged',
  realtimePageBufferChanged: 'fractalframe:chartRealtimePageBufferChanged',
  realtimePageRolloverRequested: 'fractalframe:chartRealtimePageRolloverRequested',
  realtimePageSnapshotChanged: 'fractalframe:chartRealtimePageSnapshotChanged',
  marketStatusTitleChanged: 'fractalframe:marketStatusTitleChanged',
  shortcutMenuChanged: 'fractalframe:mt5ImportCenterShortcutMenuChanged',
  sharedSelectionChanged: 'fractalframe:mt5ImportCenterSharedSelectionChanged',
  storeV6StatusChanged: 'fractalframe:mt5ImportCenterStoreV6StatusChanged',
  watchlistChanged: 'fractalframe:mt5ImportCenterWatchlistChanged',
} as const

export function dispatchWorkbenchEvent(name: string) {
  window.dispatchEvent(new Event(name))
}

export function dispatchSharedSelectionChanged(detail: { symbol: string; period: string }) {
  window.dispatchEvent(new CustomEvent(workbenchEvents.sharedSelectionChanged, { detail }))
}
