import type { Chart } from 'klinecharts'
import {
  storeV6AoIndicatorIdV2,
  storeV6DpoIndicatorIdV2,
  storeV6MaIndicatorIdV2,
  storeV6MacdIndicatorIdV2,
  storeV6MmadIndicatorIdV2,
  storeV6MmfV3IndicatorIdV2,
  storeV6MmfStochH2IndicatorIdV2,
  storeV6RsiIndicatorIdV2,
  storeV6SqzmomIndicatorIdV2,
  storeV6StochIndicatorIdV2,
  storeV6TsiIndicatorIdV2,
  storeV6VdoIndicatorIdV2,
  storeV6ViIndicatorIdV2,
  storeV6VmiIndicatorIdV2,
  storeV6VwapIndicatorIdV2,
} from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { createKLineChartIndicatorFrameIdentityV2 } from './klineChartIndicatorFrameIdentityV2'
import { installKLineChartMainMaOverlayV2 } from './klineChartMainMaOverlayV2'
import { installKLineChartMainMmadOverlayV2 } from './klineChartMainMmadOverlayV2'
import { installKLineChartMainMmfV3OverlayV2 } from './klineChartMainMmfV3OverlayV2'
import { installKLineChartMainMmfStochH2OverlayV2 } from './klineChartMainMmfStochH2OverlayV2'
import { installKLineChartMainMorganRangeOverlayV2 } from './klineChartMainMorganRangeOverlayV2'
import { installKLineChartMainVolumeOverlayV2 } from './klineChartMainVolumeOverlayV2'
import { installKLineChartMainVwapOverlayV2 } from './klineChartMainVwapOverlayV2'
import { installKLineChartSubPaneAoV2 } from './klineChartSubPaneAoV2'
import { installKLineChartSubPaneDpoV2 } from './klineChartSubPaneDpoV2'
import { installKLineChartSubPaneMacdV2 } from './klineChartSubPaneMacdV2'
import { installKLineChartSubPaneRsiV2 } from './klineChartSubPaneRsiV2'
import { installKLineChartSubPaneSqzmomV2 } from './klineChartSubPaneSqzmomV2'
import { installKLineChartSubPaneStochV2 } from './klineChartSubPaneStochV2'
import { installKLineChartSubPaneAxisLifecycleV2 } from './klineChartSubPaneAxisLifecycleV2'
import { installKLineChartSubPaneTsiV2 } from './klineChartSubPaneTsiV2'
import { installKLineChartSubPaneVdoV2 } from './klineChartSubPaneVdoV2'
import { installKLineChartSubPaneViV2 } from './klineChartSubPaneViV2'
import { installKLineChartSubPaneVmiV2 } from './klineChartSubPaneVmiV2'

type IndicatorLifecyclePerfEntryV2 = {
  at: number
  frameKey: string
  ms: number
  name: string
}

declare global {
  interface Window {
    __ffKLineChartV2IndicatorLifecyclePerf?: {
      entries: IndicatorLifecyclePerfEntryV2[]
      totals: Record<string, {
        count: number
        maxMs: number
        totalMs: number
      }>
    }
  }
}

function recordIndicatorLifecyclePerf(name: string, frame: KLineChartRenderFrameV2, ms: number) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const debug = window.__ffKLineChartV2IndicatorLifecyclePerf ?? {
    entries: [],
    totals: {},
  }
  debug.entries.push({
    at: Date.now(),
    frameKey: frame.key,
    ms: Number(ms.toFixed(3)),
    name,
  })
  if (debug.entries.length > 300) debug.entries.splice(0, debug.entries.length - 300)
  const total = debug.totals[name] ?? { count: 0, maxMs: 0, totalMs: 0 }
  total.count += 1
  total.totalMs += ms
  total.maxMs = Math.max(total.maxMs, ms)
  debug.totals[name] = total
  window.__ffKLineChartV2IndicatorLifecyclePerf = debug
}

function timedIndicatorLifecycleUpdate(name: string, frame: KLineChartRenderFrameV2, update: () => void) {
  const start = performance.now()
  update()
  recordIndicatorLifecyclePerf(name, frame, performance.now() - start)
}

export function installKLineChartIndicatorLifecycleV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  const mainMa = installKLineChartMainMaOverlayV2(chart, frame)
  const mainMmad = installKLineChartMainMmadOverlayV2(chart, frame)
  const mainMmfV3 = installKLineChartMainMmfV3OverlayV2(chart, frame)
  const mainMmfStochH2 = installKLineChartMainMmfStochH2OverlayV2(chart, frame)
  const mainMorganRange = installKLineChartMainMorganRangeOverlayV2(chart, frame)
  const mainVwap = installKLineChartMainVwapOverlayV2(chart, frame)
  const mainVolume = installKLineChartMainVolumeOverlayV2(chart, frame)
  const subPaneRsi = installKLineChartSubPaneRsiV2(chart, frame)
  const subPaneSqzmom = installKLineChartSubPaneSqzmomV2(chart, frame)
  const subPaneMacd = installKLineChartSubPaneMacdV2(chart, frame)
  const subPaneDpo = installKLineChartSubPaneDpoV2(chart, frame)
  const subPaneStoch = installKLineChartSubPaneStochV2(chart, frame)
  const subPaneTsi = installKLineChartSubPaneTsiV2(chart, frame)
  const subPaneAo = installKLineChartSubPaneAoV2(chart, frame)
  const subPaneVdo = installKLineChartSubPaneVdoV2(chart, frame)
  const subPaneVmi = installKLineChartSubPaneVmiV2(chart, frame)
  const subPaneVi = installKLineChartSubPaneViV2(chart, frame)
  const subPaneAxis = installKLineChartSubPaneAxisLifecycleV2(chart, frame)
  const frameIdentity = createKLineChartIndicatorFrameIdentityV2()

  function updateWhenPaneChanged(name: string, nextFrame: KLineChartRenderFrameV2, keys: string[], update: () => void) {
    if (!frameIdentity.shouldUpdate(name, nextFrame, keys)) {
      recordIndicatorLifecyclePerf(`${name}:skipped`, nextFrame, 0)
      return
    }
    timedIndicatorLifecycleUpdate(name, nextFrame, update)
  }

  return {
    destroy() {
      mainMa.destroy()
      mainMmad.destroy()
      mainMmfV3.destroy()
      mainMmfStochH2.destroy()
      mainMorganRange.destroy()
      mainVwap.destroy()
      mainVolume.destroy()
      subPaneRsi.destroy()
      subPaneSqzmom.destroy()
      subPaneMacd.destroy()
      subPaneDpo.destroy()
      subPaneStoch.destroy()
      subPaneTsi.destroy()
      subPaneAo.destroy()
      subPaneVdo.destroy()
      subPaneVmi.destroy()
      subPaneVi.destroy()
      subPaneAxis.destroy()
      frameIdentity.clear()
    },
    scheduleMainPriceScaleRender() {
      mainMorganRange.scheduleGeometryRefresh()
    },
    updateFrame(nextFrame: KLineChartRenderFrameV2) {
      updateWhenPaneChanged('mainMa', nextFrame, [storeV6MaIndicatorIdV2, 'Ma', 'ma'], () => mainMa.updateFrame(nextFrame))
      updateWhenPaneChanged('mainMmad', nextFrame, [storeV6MmadIndicatorIdV2, 'mmad'], () => mainMmad.updateFrame(nextFrame))
      updateWhenPaneChanged('mainMmfV3', nextFrame, [storeV6MmfV3IndicatorIdV2, 'mmfV3'], () => mainMmfV3.updateFrame(nextFrame))
      updateWhenPaneChanged('mainMmfStochH2', nextFrame, [storeV6MmfStochH2IndicatorIdV2, 'mmfStochH2'], () => mainMmfStochH2.updateFrame(nextFrame))
      timedIndicatorLifecycleUpdate('mainMorganRange', nextFrame, () => mainMorganRange.updateFrame(nextFrame))
      updateWhenPaneChanged('mainVwap', nextFrame, [storeV6VwapIndicatorIdV2, 'vwap', 'Vwap'], () => mainVwap.updateFrame(nextFrame))
      timedIndicatorLifecycleUpdate('mainVolume', nextFrame, () => mainVolume.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneRsi', nextFrame, [storeV6RsiIndicatorIdV2, 'rsi'], () => subPaneRsi.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneSqzmom', nextFrame, [storeV6SqzmomIndicatorIdV2, 'sqzmom'], () => subPaneSqzmom.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneMacd', nextFrame, [storeV6MacdIndicatorIdV2, 'macd'], () => subPaneMacd.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneDpo', nextFrame, [storeV6DpoIndicatorIdV2, 'dpo'], () => subPaneDpo.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneStoch', nextFrame, [storeV6StochIndicatorIdV2, 'STOCH', 'stoch'], () => subPaneStoch.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneTsi', nextFrame, [storeV6TsiIndicatorIdV2, 'tsi'], () => subPaneTsi.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneAo', nextFrame, [storeV6AoIndicatorIdV2, 'ao'], () => subPaneAo.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneVdo', nextFrame, [storeV6VdoIndicatorIdV2, 'vdo'], () => subPaneVdo.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneVmi', nextFrame, [storeV6VmiIndicatorIdV2, 'vmi'], () => subPaneVmi.updateFrame(nextFrame))
      updateWhenPaneChanged('subPaneVi', nextFrame, [storeV6ViIndicatorIdV2, 'vi'], () => subPaneVi.updateFrame(nextFrame))
      timedIndicatorLifecycleUpdate('subPaneAxis', nextFrame, () => subPaneAxis.updateFrame(nextFrame))
    },
  }
}
