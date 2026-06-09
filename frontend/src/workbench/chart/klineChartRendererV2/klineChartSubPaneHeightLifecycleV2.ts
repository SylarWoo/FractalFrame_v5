import type { Chart } from 'klinecharts'

const defaultPaneHeight = 120
const minPaneHeight = 80
const maxStoredPaneHeight = 360

function normalizePaneHeight(value: number) {
  return Math.max(minPaneHeight, Math.min(Math.round(value), maxStoredPaneHeight))
}

export function readKLineChartSubPaneHeightV2(storageKey: string) {
  if (typeof window === 'undefined') return defaultPaneHeight
  const stored = Number(window.localStorage.getItem(storageKey))
  return Number.isFinite(stored) ? normalizePaneHeight(stored) : defaultPaneHeight
}

export function writeKLineChartSubPaneHeightV2(chart: Chart, paneId: string, storageKey: string) {
  if (typeof window === 'undefined') return
  const size = chart.getSize(paneId)
  if (!size?.height) return
  window.localStorage.setItem(storageKey, String(normalizePaneHeight(size.height)))
}

export const kLineChartSubPaneMinHeightV2 = minPaneHeight
