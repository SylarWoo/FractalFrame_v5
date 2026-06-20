import type { Chart } from 'klinecharts'
import { readString, writeString } from '../../persistence/jsonStorage'
import {
  storeV6AoPaneIdV2,
  storeV6DpoPaneIdV2,
  storeV6MacdPaneIdV2,
  storeV6RsiPaneIdV2,
  storeV6SqzmomPaneIdV2,
  storeV6StochPaneIdV2,
  storeV6TsiPaneIdV2,
  storeV6VdoPaneIdV2,
  storeV6ViPaneIdV2,
  storeV6VmiPaneIdV2,
} from '../indicatorRequestV2'

const defaultPaneHeight = 128
const minPaneHeight = 80
const maxStoredPaneHeight = 720

export const kLineChartSubPaneHeightStorageEntriesV2 = [
  [storeV6RsiPaneIdV2, 'fractalframe.chart.rsiPaneHeight'],
  [storeV6StochPaneIdV2, 'fractalframe.chart.stochPaneHeight'],
  [storeV6SqzmomPaneIdV2, 'fractalframe.chart.sqzmomPaneHeight'],
  [storeV6MacdPaneIdV2, 'fractalframe.chart.macdPaneHeight'],
  [storeV6DpoPaneIdV2, 'fractalframe.chart.dpoPaneHeight'],
  [storeV6TsiPaneIdV2, 'fractalframe.chart.tsiPaneHeight'],
  [storeV6AoPaneIdV2, 'fractalframe.chart.aoPaneHeight'],
  [storeV6VdoPaneIdV2, 'fractalframe.chart.vdoPaneHeight'],
  [storeV6VmiPaneIdV2, 'fractalframe.chart.vmiPaneHeight'],
  [storeV6ViPaneIdV2, 'fractalframe.chart.viPaneHeight'],
] as const

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

export function writeVisibleKLineChartSubPaneHeightsV2(chart: Chart) {
  kLineChartSubPaneHeightStorageEntriesV2.forEach(([paneId, storageKey]) => {
    writeKLineChartSubPaneHeightV2(chart, paneId, storageKey)
  })
}

export function isKLineChartPaneSeparatorTargetV2(target: EventTarget | null, chartRoot: HTMLElement | null) {
  if (!(target instanceof HTMLElement) || !chartRoot?.contains(target)) return false
  const style = window.getComputedStyle(target)
  if (style.cursor !== 'ns-resize') return false
  const rect = target.getBoundingClientRect()
  return rect.height > 0 && rect.height <= 16 && rect.width > 80
}

export function installKLineChartSubPaneHeightResizePersistenceV2(chart: Chart, chartRoot: HTMLElement) {
  let paneResizeActive = false
  let paneResizeEndTimer = 0

  const clearPaneResizeEndTimer = () => {
    if (paneResizeEndTimer === 0) return
    window.clearTimeout(paneResizeEndTimer)
    paneResizeEndTimer = 0
  }

  const persistVisiblePaneHeights = () => {
    writeVisibleKLineChartSubPaneHeightsV2(chart)
  }

  const startPaneResize = (event: Event) => {
    if (!isKLineChartPaneSeparatorTargetV2(event.target, chartRoot)) return
    paneResizeActive = true
    clearPaneResizeEndTimer()
  }

  const finishPaneResize = () => {
    if (!paneResizeActive) return
    paneResizeActive = false
    persistVisiblePaneHeights()
    paneResizeEndTimer = window.setTimeout(() => {
      paneResizeEndTimer = 0
      persistVisiblePaneHeights()
    }, 80)
  }

  chartRoot.addEventListener('pointerdown', startPaneResize, true)
  chartRoot.addEventListener('mousedown', startPaneResize, true)
  window.addEventListener('pointerup', finishPaneResize, true)
  window.addEventListener('mouseup', finishPaneResize, true)
  window.addEventListener('blur', finishPaneResize)
  window.addEventListener('beforeunload', persistVisiblePaneHeights)
  window.addEventListener('pagehide', persistVisiblePaneHeights)

  return {
    destroy() {
      clearPaneResizeEndTimer()
      paneResizeActive = false
      chartRoot.removeEventListener('pointerdown', startPaneResize, true)
      chartRoot.removeEventListener('mousedown', startPaneResize, true)
      window.removeEventListener('pointerup', finishPaneResize, true)
      window.removeEventListener('mouseup', finishPaneResize, true)
      window.removeEventListener('blur', finishPaneResize)
      window.removeEventListener('beforeunload', persistVisiblePaneHeights)
      window.removeEventListener('pagehide', persistVisiblePaneHeights)
    },
  }
}

export const kLineChartSubPaneMinHeightV2 = minPaneHeight
