import type { ChartPageWindow } from './chartPageWindow'

export type PageWindowManagerState = {
  activeWindowKey: string | null
  historyWindows: Record<string, ChartPageWindow>
  realtimeWindows: Record<string, ChartPageWindow>
}

export function createPageWindowManagerState(): PageWindowManagerState {
  return {
    activeWindowKey: null,
    historyWindows: {},
    realtimeWindows: {},
  }
}

export function activatePageWindow(state: PageWindowManagerState, window: ChartPageWindow): PageWindowManagerState {
  const bucket = window.mode === 'realtime' ? 'realtimeWindows' : 'historyWindows'
  return {
    ...state,
    activeWindowKey: window.key,
    [bucket]: {
      ...state[bucket],
      [window.key]: window,
    },
  }
}

export function readActivePageWindow(state: PageWindowManagerState) {
  if (!state.activeWindowKey) return null
  return state.realtimeWindows[state.activeWindowKey] ?? state.historyWindows[state.activeWindowKey] ?? null
}
