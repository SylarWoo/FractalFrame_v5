import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { kLineChartConfigV2 } from './klineChartConfigV2'

const candlePaneId = 'candle_pane'
const storagePrefix = 'fractalframe:klinechart-v2:viewport'

type ViewportSnapshotV2 = {
  barSpace: number
  dataLength: number
  offsetRightDistance: number | null
  rightTimestamp: number | null
  savedAt: string
  visibleTo: number
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function storageKey(symbol: string, period: string) {
  return `${storagePrefix}:${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}`
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

function readSnapshot(symbol: string, period: string): ViewportSnapshotV2 | null {
  try {
    const raw = window.localStorage.getItem(storageKey(symbol, period))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ViewportSnapshotV2>
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

function writeSnapshot(symbol: string, period: string, snapshot: ViewportSnapshotV2) {
  try {
    window.localStorage.setItem(storageKey(symbol, period), JSON.stringify(snapshot))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

export function restoreKLineChartViewportStateV2(chart: Chart, symbol: string, period: string) {
  const snapshot = readSnapshot(symbol, period)
  if (!snapshot) return false
  chart.setBarSpace?.(snapshot.barSpace)
  const restoreScroll = () => {
    const dataLength = chart.getDataList?.().length ?? 0
    if (dataLength === 0) return
    const offsetRightDistance = normalizeOffsetRightDistance(chart, snapshot.offsetRightDistance)
    if (offsetRightDistance !== null) {
      chart.setOffsetRightDistance?.(offsetRightDistance)
      return
    }
    if (snapshot.rightTimestamp !== null) {
      chart.scrollToTimestamp?.(snapshot.rightTimestamp, 0)
      return
    }
    chart.scrollToDataIndex?.(Math.max(0, Math.min(dataLength - 1, Math.round(snapshot.visibleTo))), 0)
  }
  restoreScroll()
  return true
}

export function installKLineChartViewportStateV2(
  chart: Chart,
  getContext: () => { period: string; symbol: string },
) {
  let timer = 0
  let readyFrame = 0
  let readyTimer = 0
  let ready = false

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
    const context = getContext()
    if (!context.symbol || !context.period) return
    const snapshot = captureViewport(chart)
    if (snapshot) writeSnapshot(context.symbol, context.period, snapshot)
  }

  const scheduleSave = () => {
    if (!ready) return
    if (timer !== 0) window.clearTimeout(timer)
    timer = window.setTimeout(saveNow, kLineChartConfigV2.viewport.saveDelayMs)
  }

  const actions = [ActionType.OnScroll, ActionType.OnVisibleRangeChange, ActionType.OnZoom]
  actions.forEach((action) => chart.subscribeAction(action, scheduleSave))
  const root = chart.getDom(candlePaneId, DomPosition.Root) ?? chart.getDom()
  root?.addEventListener('mouseup', scheduleSave, true)
  root?.addEventListener('pointerup', saveNow, true)
  window.addEventListener('mouseup', scheduleSave, true)
  window.addEventListener('pointerup', scheduleSave, true)
  window.addEventListener('wheel', scheduleSave, true)
  window.addEventListener('beforeunload', saveNow)
  window.addEventListener('pagehide', saveNow)

  return {
    destroy() {
      clearPendingSave()
      clearPendingReady()
      actions.forEach((action) => chart.unsubscribeAction(action, scheduleSave))
      root?.removeEventListener('mouseup', scheduleSave, true)
      root?.removeEventListener('pointerup', saveNow, true)
      window.removeEventListener('mouseup', scheduleSave, true)
      window.removeEventListener('pointerup', scheduleSave, true)
      window.removeEventListener('wheel', scheduleSave, true)
      window.removeEventListener('beforeunload', saveNow)
      window.removeEventListener('pagehide', saveNow)
    },
    markRestoring() {
      ready = false
      clearPendingSave()
      clearPendingReady()
    },
    markReady() {
      ready = true
    },
    markReadyAfterRestore() {
      ready = false
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
