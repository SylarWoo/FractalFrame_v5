import type { Chart } from 'klinecharts'
import { settingsSymbolChangedEvent } from '../../settingsSymbolState'
import { marketStatusTitleChangedEvent } from '../../mt5DataCenter/marketStatusTitleState'
import { domPaneTitleOverlayEnabled } from '../paneTitleOverlayConfig'
import { applyKLineChartAxisControlsV2 } from './klineChartAxisControlsV2'
import { applyKLineChartCandleControlsV2 } from './klineChartCandleControlsV2'
import { applyKLineChartEventOverlayControlsV2 } from './klineChartEventOverlayControlsV2'
import {
  applyKLineChartLayoutControlsV2,
  createKLineChartLayoutInitOptionsV2,
} from './klineChartLayoutControlsV2'
import { installKLineChartTitleOverlayV2 } from './klineChartTitleOverlayV2'
import type { KLineChartDisplayContext } from './klineChartDisplayTypes'
export type { KLineChartDisplayContext } from './klineChartDisplayTypes'

export function createKLineChartDisplayInitOptions() {
  return createKLineChartLayoutInitOptionsV2()
}

export function applyKLineChartDisplayControls(chart: Chart, context: KLineChartDisplayContext) {
  applyKLineChartLayoutControlsV2(chart)
  applyKLineChartAxisControlsV2(chart)
  applyKLineChartCandleControlsV2(chart, context)
  applyKLineChartEventOverlayControlsV2(chart, context)
}

export function installKLineChartDisplayOverlays(
  chart: Chart,
  container: HTMLElement,
  context: KLineChartDisplayContext,
) {
  if (!domPaneTitleOverlayEnabled) {
    return {
      destroy() {},
      update() {},
      updateContext(_nextContext: KLineChartDisplayContext) {},
    }
  }
  return installKLineChartTitleOverlayV2(chart, container, context)
}

export function subscribeKLineChartDisplayControlChanges(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(settingsSymbolChangedEvent, onChange)
  window.addEventListener(marketStatusTitleChangedEvent, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(settingsSymbolChangedEvent, onChange)
    window.removeEventListener(marketStatusTitleChangedEvent, onChange)
  }
}

export function installKLineChartDisplayController(
  chart: Chart,
  container: HTMLElement,
  initialContext: KLineChartDisplayContext,
) {
  let context = initialContext
  let frameId = 0
  let destroyed = false
  const overlays = installKLineChartDisplayOverlays(chart, container, context)

  function applyNow() {
    if (destroyed) return
    frameId = 0
    applyKLineChartDisplayControls(chart, context)
    overlays.update()
  }

  function scheduleApply() {
    if (destroyed || frameId !== 0) return
    frameId = window.requestAnimationFrame(applyNow)
  }

  const unsubscribe = subscribeKLineChartDisplayControlChanges(scheduleApply)
  applyNow()

  return {
    destroy() {
      destroyed = true
      if (frameId !== 0) window.cancelAnimationFrame(frameId)
      unsubscribe()
      overlays.destroy()
    },
    scheduleApply,
    updateContext(nextContext: KLineChartDisplayContext) {
      context = nextContext
      overlays.updateContext(nextContext)
      scheduleApply()
    },
  }
}
