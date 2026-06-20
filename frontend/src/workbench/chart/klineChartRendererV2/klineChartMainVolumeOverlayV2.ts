import type { Chart } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import { createIndicatorSnapshotRows, type VolSnapshotRow, writeIndicatorPageSnapshot } from '../indicatorPageSnapshotStore'
import { installMainVolumeOverlay } from '../mainVolumeIndicator'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { storeV6VolIndicatorIdV2 } from '../indicatorRequestV2'
import { normalizeVolSettings, type VolIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import { createKLineChartIndicatorSnapshotContextV2, createKLineChartRuntimeCalcParamsV2 } from './klineChartIndicatorSnapshotBridgeV2'

type MainVolumeOverlayHandle = ReturnType<typeof installMainVolumeOverlay>

function findVolPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6VolIndicatorIdV2] ?? frame.panes.Vol ?? frame.panes.vol ?? null
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function calculateSma(values: number[], period: number) {
  const result: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index]
    if (index >= period) sum -= values[index - period]
    if (index >= period - 1) result[index] = sum / period
  }
  return result
}

function colorIndex(rows: KLineData[], index: number, settings: VolIndicatorSettings): 0 | 1 {
  const current = rows[index]
  const previous = rows[index - 1]
  if (settings.colorBasedOnPreviousClose && previous) {
    return finiteNumber(current.close) >= finiteNumber(previous.close) ? 0 : 1
  }
  return finiteNumber(current.close) >= finiteNumber(current.open) ? 0 : 1
}

function calculateVolSnapshotRows(rows: KLineData[], inputSettings?: Partial<VolIndicatorSettings>): VolSnapshotRow[] {
  const settings = normalizeVolSettings(inputSettings)
  const volumes = rows.map((row) => Math.max(0, finiteNumber(row.volume)))
  const maLength = Math.max(1, Math.min(Math.round(Number(settings.maLength)), 500))
  const maValues = calculateSma(volumes, maLength)
  return rows.map((_row, index) => ({
    volume: volumes[index],
    volumeColorIndex: colorIndex(rows, index, settings),
    volumeMa: maValues[index],
  }))
}

function writeVolSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6VolIndicatorIdV2,
    pane,
  })
  writeIndicatorPageSnapshot({
    pageKey,
      period: frame.period,
      rows: createIndicatorSnapshotRows({
        period: frame.period,
        rows: frame.mainRows,
        symbol: frame.symbol,
        volRows: calculateVolSnapshotRows(frame.mainRows, pane.settings as Partial<VolIndicatorSettings> | undefined),
      }),
    settingsHash,
    settingsHashKey: storeV6VolIndicatorIdV2,
    symbol: frame.symbol,
  })
  return createKLineChartRuntimeCalcParamsV2({
    frame,
    pageKey,
    pane,
    settingsHash,
  })
}

export function installKLineChartMainVolumeOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  let overlay: MainVolumeOverlayHandle | null = null
  let enabled = false

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findVolPane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      if (enabled) {
        overlay?.destroy()
        overlay = null
        enabled = false
      }
      return
    }

    const calcParams = writeVolSnapshot(nextFrame, pane) as Partial<VolIndicatorSettings>
    if (!overlay) overlay = installMainVolumeOverlay(chart, calcParams)
    else overlay.updateSettings(calcParams)
    enabled = true
  }

  apply(frame)

  return {
    destroy: () => {
      overlay?.destroy()
      overlay = null
      enabled = false
    },
    updateFrame: apply,
  }
}
