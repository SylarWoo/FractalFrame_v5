import type { Chart } from 'klinecharts'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { readJson, writeJson } from '../../persistence/jsonStorage'
import { kLineChartSubPaneAxisConfigV2 } from './klineChartSubPaneAxisConfigV2'
import {
  installKLineChartYAxisInteractionCoreV2,
  normalizeKLineChartYAxisRangeV2,
  readKLineChartYAxisV2,
  setKLineChartYAxisAutoV2,
  setKLineChartYAxisManualRangeV2,
  uniqueKLineChartYAxisPaneIdsV2,
} from './klineChartYAxisLifecycleCoreV2'

const storagePrefix = 'fractalframe:klinechart-v2:subPaneYAxisRestore'

export type KLineChartSubPaneYAxisModeV2 = 'auto' | 'manual'

export type KLineChartSubPaneYAxisRangeV2 = {
  from: number
  range: number
  realFrom: number
  realRange: number
  realTo: number
  to: number
}

export type KLineChartSubPaneYAxisSnapshotV2 = {
  mode: KLineChartSubPaneYAxisModeV2
  paneId: string
  range: KLineChartSubPaneYAxisRangeV2 | null
  savedAt: string
}

type ChartWithPaneAxisAccessV2 = Chart & {
  adjustPaneViewport?: (
    shouldMeasureHeight?: boolean,
    shouldMeasureWidth?: boolean,
    shouldUpdate?: boolean,
    shouldAdjustYAxis?: boolean,
    shouldForceAdjustYAxis?: boolean,
  ) => void
}

function storageKey(symbol: string, period: string, paneId: string) {
  return `${storagePrefix}:${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}:${paneId}`
}

export function resolveKLineChartSubPaneAxisPaneIdsV2(frame: KLineChartRenderFrameV2) {
  const configured = new Set(kLineChartSubPaneAxisConfigV2.paneIds)
  return uniqueKLineChartYAxisPaneIdsV2(Object.values(frame.panes)
    .filter((pane) => pane.renderRole === 'sub-pane' && pane.paneId && configured.has(pane.paneId))
    .map((pane) => pane.paneId as string))
}

export function readKLineChartSubPaneYAxisSnapshotV2(
  symbol: string,
  period: string,
  paneId: string,
): KLineChartSubPaneYAxisSnapshotV2 | null {
  try {
    const parsed = readJson<Partial<KLineChartSubPaneYAxisSnapshotV2> | null>(storageKey(symbol, period, paneId), null)
    if (!parsed) return null
    const mode = parsed.mode === 'manual' ? 'manual' : 'auto'
    return {
      mode,
      paneId,
      range: mode === 'manual' ? normalizeKLineChartYAxisRangeV2(parsed.range) : null,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    }
  } catch {
    return null
  }
}

export function writeKLineChartSubPaneYAxisSnapshotV2(
  symbol: string,
  period: string,
  paneId: string,
  snapshot: KLineChartSubPaneYAxisSnapshotV2,
) {
  writeJson(storageKey(symbol, period, paneId), snapshot)
}

export function captureKLineChartSubPaneYAxisStateV2(
  chart: Chart,
  symbol: string,
  period: string,
  paneId: string,
) {
  const yAxis = readKLineChartYAxisV2(chart, paneId)
  if (!yAxis) return null
  const auto = yAxis.getAutoCalcTickFlag?.() !== false
  const snapshot: KLineChartSubPaneYAxisSnapshotV2 = {
    mode: auto ? 'auto' : 'manual',
    paneId,
    range: auto ? null : normalizeKLineChartYAxisRangeV2(yAxis.getRange?.()),
    savedAt: new Date().toISOString(),
  }
  writeKLineChartSubPaneYAxisSnapshotV2(symbol, period, paneId, snapshot)
  return snapshot
}

export function restoreKLineChartSubPaneYAxisV2(
  chart: Chart,
  symbol: string,
  period: string,
  paneIds: string[],
) {
  const chartWithAccess = chart as ChartWithPaneAxisAccessV2
  let changed = false
  uniqueKLineChartYAxisPaneIdsV2(paneIds).forEach((paneId) => {
    const yAxis = readKLineChartYAxisV2(chart, paneId)
    if (!yAxis?.setAutoCalcTickFlag) return
    const snapshot = kLineChartSubPaneAxisConfigV2.restoreYAxisOnRefresh
      ? readKLineChartSubPaneYAxisSnapshotV2(symbol, period, paneId)
      : null

    if (snapshot?.mode === 'manual' && snapshot.range && yAxis.setRange) {
      changed = setKLineChartYAxisManualRangeV2(chart, paneId, snapshot.range, false, false) || changed
      return
    }

    setKLineChartYAxisAutoV2(chart, paneId, true, false)
    changed = true
  })
  if (changed) chartWithAccess.adjustPaneViewport?.(false, true, true, true, true)
}

export function installKLineChartSubPaneAxisLifecycleV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  const root = chart.getDom()
  let currentFrame = frame
  let frameId = 0
  let saveTimer = 0
  let lastSignature = ''
  let disposed = false

  const savePaneNow = (paneId: string) => {
    captureKLineChartSubPaneYAxisStateV2(chart, currentFrame.symbol, currentFrame.period, paneId)
  }

  const clearPendingSave = () => {
    if (saveTimer !== 0) {
      window.clearTimeout(saveTimer)
      saveTimer = 0
    }
  }

  const saveAllNow = () => {
    clearPendingSave()
    resolveKLineChartSubPaneAxisPaneIdsV2(currentFrame).forEach(savePaneNow)
  }

  const scheduleSaveAll = () => {
    clearPendingSave()
    saveTimer = window.setTimeout(saveAllNow, 0)
  }

  const scheduleRestore = (nextFrame: KLineChartRenderFrameV2) => {
    currentFrame = nextFrame
    const paneIds = resolveKLineChartSubPaneAxisPaneIdsV2(nextFrame)
    const signature = `${nextFrame.symbol}:${nextFrame.period}:${paneIds.join('|')}`
    if (signature === lastSignature) return
    lastSignature = signature
    if (frameId !== 0) window.cancelAnimationFrame(frameId)
    frameId = window.requestAnimationFrame(() => {
      frameId = 0
      if (disposed) return
      restoreKLineChartSubPaneYAxisV2(chart, nextFrame.symbol, nextFrame.period, paneIds)
    })
  }

  const interaction = installKLineChartYAxisInteractionCoreV2({
    chart,
    onRangeChange: savePaneNow,
    paneIds: () => resolveKLineChartSubPaneAxisPaneIdsV2(currentFrame),
  })
  root?.addEventListener('mouseup', scheduleSaveAll, true)
  root?.addEventListener('pointerup', scheduleSaveAll, true)
  window.addEventListener('mouseup', scheduleSaveAll, true)
  window.addEventListener('pointerup', scheduleSaveAll, true)
  window.addEventListener('beforeunload', saveAllNow)
  window.addEventListener('pagehide', saveAllNow)

  scheduleRestore(frame)

  return {
    destroy() {
      disposed = true
      clearPendingSave()
      interaction.destroy()
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
        frameId = 0
      }
      root?.removeEventListener('mouseup', scheduleSaveAll, true)
      root?.removeEventListener('pointerup', scheduleSaveAll, true)
      window.removeEventListener('mouseup', scheduleSaveAll, true)
      window.removeEventListener('pointerup', scheduleSaveAll, true)
      window.removeEventListener('beforeunload', saveAllNow)
      window.removeEventListener('pagehide', saveAllNow)
    },
    saveNow: saveAllNow,
    updateFrame: scheduleRestore,
  }
}
