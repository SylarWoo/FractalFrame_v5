import type { Chart } from 'klinecharts'
import { readString, writeString } from '../../persistence/jsonStorage'

const defaultPaneHeight = 120
const minPaneHeight = 80
const maxStoredPaneHeight = 360

function normalizePaneHeight(value: number) {
  return Math.max(minPaneHeight, Math.min(Math.round(value), maxStoredPaneHeight))
}

export function readKLineChartSubPaneHeightV2(storageKey: string) {
  if (typeof window === 'undefined') return defaultPaneHeight
  const stored = Number(readString(storageKey, ''))
  return Number.isFinite(stored) ? normalizePaneHeight(stored) : defaultPaneHeight
}

export function writeKLineChartSubPaneHeightV2(chart: Chart, paneId: string, storageKey: string) {
  if (typeof window === 'undefined') return
  const size = chart.getSize(paneId)
  if (!size?.height) return
  writeString(storageKey, String(normalizePaneHeight(size.height)))
}

export const kLineChartSubPaneMinHeightV2 = minPaneHeight
