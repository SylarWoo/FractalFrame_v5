import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { readJson, writeJson } from '../../persistence/jsonStorage'
import { kLineChartConfigV2 } from './klineChartConfigV2'

const candlePaneId = 'candle_pane'
const storagePrefix = 'fractalframe:klinechart-v2:viewport'

declare global {
  interface Window {
    __ffKLineChartV2ViewportRestoreDebug?: unknown
  }
}

type ViewportSnapshotV2 = {
  barSpace: number
  dataLength: number
  offsetRightDistance: number | null
  rightTimestamp: number | null
  savedAt: string
  visibleTo: number
}

export type KLineChartViewportContextV2 = {
  period: string
  symbol: string
  viewportScope?: string | null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeViewportScope(scope: string | null | undefined) {
  const value = String(scope ?? 'default').trim()
  return value ? value.replace(/[^A-Za-z0-9:_-]/g, '_') : 'default'
}

function storageKey(symbol: string, period: string, viewportScope?: string | null) {
  const base = `${storagePrefix}:${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}`
  const scope = normalizeViewportScope(viewportScope)
  return scope === 'default' ? base : `${base}:${scope}`
}

function normalizeBarSpace(value: unknown) {
  const barSpace = Number(value)
  if (!Number.isFinite(barSpace) || barSpace <= 0) return null
  return Math.max(kLineChartConfigV2.viewport.barSpaceMin, Math.min(barSpace, kLineChartConfigV2.viewport.barSpaceMax))
}

function normalizeOffsetRightDistance(chart: Chart, value: unknown) {
  const distance = Number(value)
  if (!Number.isFinite(distance) || distance < 0) return null
  void chart
  return Math.max(0, distance)
}

function resolveRightVisibleDataIndex(chart: Chart) {
  const dataList = chart.getDataList()
  if (dataList.length === 0) return -1
  const range = chart.getVisibleRange()
  const candidates = [Number(range.realTo), Number(range.to)]
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) continue
    return Math.max(0, Math.min(dataList.length - 1, Math.floor(candidate)))
  }
  return dataList.length - 1
}

function readRightVisibleTimestamp(chart: Chart) {
  const index = resolveRightVisibleDataIndex(chart)
  if (index < 0) return null
  const timestamp = Number(chart.getDataList()[index]?.timestamp)
  return Number.isFinite(timestamp) ? timestamp : null
}

function readLatestTimestamp(chart: Chart) {
  const dataList = chart.getDataList?.() ?? []
  const timestamp = Number(dataList[dataList.length - 1]?.timestamp)
  return Number.isFinite(timestamp) ? timestamp : null
}

function captureViewport(chart: Chart): ViewportSnapshotV2 | null {
  const visibleRange = chart.getVisibleRange?.()
  const visibleTo = Number(visibleRange?.to)
  const barSpace = normalizeBarSpace(chart.getBarSpace?.())
  if (!Number.isFinite(visibleTo) || barSpace == null) return null
  return {
    barSpace,
    dataLength: chart.getDataList?.().length ?? 0,
    offsetRightDistance: normalizeOffsetRightDistance(chart, chart.getOffsetRightDistance?.()),
    rightTimestamp: readRightVisibleTimestamp(chart),
    savedAt: new Date().toISOString(),
    visibleTo,
  }
}

function readSnapshot(symbol: string, period: string, viewportScope?: string | null): ViewportSnapshotV2 | null {
  try {
    const parsed = readJson<Partial<ViewportSnapshotV2> | null>(storageKey(symbol, period, viewportScope), null)
    if (!parsed) return null
    const barSpace = normalizeBarSpace(parsed.barSpace)
    const visibleTo = Number(parsed.visibleTo)
    if (barSpace == null || !Number.isFinite(visibleTo)) return null
    return {
      barSpace,
      dataLength: finiteNumber(parsed.dataLength) ? parsed.dataLength : 0,
      offsetRightDistance: finiteNumber(parsed.offsetRightDistance) ? parsed.offsetRightDistance : null,
      rightTimestamp: finiteNumber(parsed.rightTimestamp) ? parsed.rightTimestamp : null,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      visibleTo,
    }
  } catch {
    return null
  }
}

function writeSnapshot(symbol: string, period: string, snapshot: ViewportSnapshotV2, viewportScope?: string | null) {
  writeJson(storageKey(symbol, period, viewportScope), snapshot)
}

function scrollToTimestampAfterFrame(chart: Chart, timestamp: number) {
  chart.scrollToTimestamp?.(timestamp, 0)
  if (typeof window.requestAnimationFrame !== 'function') return
  window.requestAnimationFrame(() => {
    chart.scrollToTimestamp?.(timestamp, 0)
  })
}

export function restoreKLineChartViewportStateV2(
  chart: Chart,
  symbol: string,
  period: string,
  options: { allowOffsetRightDistance?: boolean; viewportScope?: string | null } = {},
) {
  const snapshot = readSnapshot(symbol, period, options.viewportScope)
  if (!snapshot) return false
  chart.setBarSpace?.(snapshot.barSpace)
  const restoreScroll = () => {
    const dataLength = chart.getDataList?.().length ?? 0
    if (dataLength === 0) return
    const offsetRightDistance = normalizeOffsetRightDistance(chart, snapshot.offsetRightDistance)
    const latestTimestamp = readLatestTimestamp(chart)
    const snapshotAtLatest = snapshot.rightTimestamp !== null &&
      latestTimestamp !== null &&
      snapshot.rightTimestamp === latestTimestamp
    if (options.allowOffsetRightDistance !== false && offsetRightDistance !== null && (snapshot.rightTimestamp === null || snapshotAtLatest)) {
      if (import.meta.env.DEV) {
        window.__ffKLineChartV2ViewportRestoreDebug = {
          latestTimestamp,
          method: 'offsetRightDistance',
          offsetRightDistance,
          options,
          snapshot,
          snapshotAtLatest,
        }
      }
      chart.setOffsetRightDistance?.(offsetRightDistance)
      return
    }
    if (snapshot.rightTimestamp !== null) {
      if (import.meta.env.DEV) {
        window.__ffKLineChartV2ViewportRestoreDebug = {
          latestTimestamp,
          method: 'rightTimestamp',
          options,
          snapshot,
          snapshotAtLatest,
        }
      }
      scrollToTimestampAfterFrame(chart, snapshot.rightTimestamp)
      return
    }
    if (import.meta.env.DEV) {
      window.__ffKLineChartV2ViewportRestoreDebug = {
        latestTimestamp,
        method: 'visibleTo',
        options,
        snapshot,
        snapshotAtLatest,
      }
    }
    chart.scrollToDataIndex?.(Math.max(0, Math.min(dataLength - 1, Math.round(snapshot.visibleTo))), 0)
  }
  restoreScroll()
  return true
}

export function installKLineChartViewportStateV2(
  chart: Chart,
  getContext: () => KLineChartViewportContextV2,
) {
  let timer = 0
  let readyFrame = 0
  let readyTimer = 0
  let ready = false
  let pointerDragging = false
  let pendingPointerDragSave = false
  let hasUserViewportMutation = false
  let lastUserViewportInputAt = 0
  let lastPointerFinishAt = 0

  const clearPendingReady = () => {
    if (readyFrame !== 0) {
      window.cancelAnimationFrame(readyFrame)
      readyFrame = 0
    }
    if (readyTimer !== 0) {
      window.clearTimeout(readyTimer)
      readyTimer = 0
    }
  }

  const clearPendingSave = () => {
    if (timer !== 0) {
      window.clearTimeout(timer)
      timer = 0
    }
  }

  const saveNow = () => {
    if (!ready) return
    clearPendingSave()
    pendingPointerDragSave = false
    if (!hasUserViewportMutation) return
    const context = getContext()
    if (!context.symbol || !context.period) return
    const snapshot = captureViewport(chart)
    if (snapshot) writeSnapshot(context.symbol, context.period, snapshot, context.viewportScope)
  }

  const scheduleSave = () => {
    if (!ready) return
    const fromUserInput = pointerDragging || Date.now() - lastUserViewportInputAt < 1200
    if (!fromUserInput) return
    hasUserViewportMutation = true
    if (pointerDragging) {
      pendingPointerDragSave = true
      return
    }
    if (timer !== 0) window.clearTimeout(timer)
    timer = window.setTimeout(saveNow, kLineChartConfigV2.viewport.saveDelayMs)
  }

  const actions = [ActionType.OnScroll, ActionType.OnVisibleRangeChange, ActionType.OnZoom]
  actions.forEach((action) => chart.subscribeAction(action, scheduleSave))
  const root = chart.getDom(candlePaneId, DomPosition.Root) ?? chart.getDom()
  const markPointerDragging = () => {
    if (!ready) return
    pointerDragging = true
    pendingPointerDragSave = false
    lastUserViewportInputAt = Date.now()
    clearPendingSave()
  }
  const finishPointerDragging = () => {
    if (!pointerDragging) return
    pointerDragging = false
    lastPointerFinishAt = Date.now()
    if (pendingPointerDragSave) saveNow()
  }
  const scheduleMouseSave = () => {
    if (Date.now() - lastPointerFinishAt < 250) return
    scheduleSave()
  }
  const handleWheel = () => {
    lastUserViewportInputAt = Date.now()
    scheduleSave()
  }
  root?.addEventListener('pointerdown', markPointerDragging, true)
  root?.addEventListener('mouseup', scheduleMouseSave, true)
  root?.addEventListener('pointerup', finishPointerDragging, true)
  root?.addEventListener('pointercancel', finishPointerDragging, true)
  window.addEventListener('pointerdown', markPointerDragging, true)
  window.addEventListener('mouseup', scheduleMouseSave, true)
  window.addEventListener('pointerup', finishPointerDragging, true)
  window.addEventListener('pointercancel', finishPointerDragging, true)
  window.addEventListener('wheel', handleWheel, true)
  window.addEventListener('beforeunload', saveNow)
  window.addEventListener('pagehide', saveNow)

  return {
    destroy() {
      clearPendingSave()
      clearPendingReady()
      pointerDragging = false
      pendingPointerDragSave = false
      hasUserViewportMutation = false
      actions.forEach((action) => chart.unsubscribeAction(action, scheduleSave))
      root?.removeEventListener('pointerdown', markPointerDragging, true)
      root?.removeEventListener('mouseup', scheduleMouseSave, true)
      root?.removeEventListener('pointerup', finishPointerDragging, true)
      root?.removeEventListener('pointercancel', finishPointerDragging, true)
      window.removeEventListener('pointerdown', markPointerDragging, true)
      window.removeEventListener('mouseup', scheduleMouseSave, true)
      window.removeEventListener('pointerup', finishPointerDragging, true)
      window.removeEventListener('pointercancel', finishPointerDragging, true)
      window.removeEventListener('wheel', handleWheel, true)
      window.removeEventListener('beforeunload', saveNow)
      window.removeEventListener('pagehide', saveNow)
    },
    markRestoring() {
      ready = false
      hasUserViewportMutation = false
      clearPendingSave()
      clearPendingReady()
    },
    markReady() {
      ready = true
    },
    markReadyAfterRestore() {
      ready = false
      hasUserViewportMutation = false
      clearPendingSave()
      clearPendingReady()
      readyFrame = window.requestAnimationFrame(() => {
        readyFrame = 0
        readyTimer = window.setTimeout(() => {
          readyTimer = 0
          ready = true
        }, 80)
      })
    },
    saveNow,
  }
}
