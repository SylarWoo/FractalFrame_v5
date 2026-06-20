import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  type AoSnapshotRow,
  type DpoSnapshotRow,
  type MacdSnapshotRow,
  type MmadSnapshotRow,
  type RsiSnapshotRow,
  type SqzmomSnapshotRow,
  type ViSnapshotRow,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import {
  kLineChartSubPaneMinHeightV2,
  readKLineChartSubPaneHeightV2,
  writeKLineChartSubPaneHeightV2,
} from './klineChartSubPaneHeightLifecycleV2'
import { createKLineChartIndicatorSnapshotContextV2, createKLineChartRuntimeCalcParamsV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

type SnapshotRowsKeyV2 = 'aoRows' | 'dpoRows' | 'macdRows' | 'mmadRows' | 'rsiRows' | 'sqzmomRows' | 'viRows'
type SnapshotRowV2 = AoSnapshotRow | DpoSnapshotRow | MacdSnapshotRow | MmadSnapshotRow | RsiSnapshotRow | SqzmomSnapshotRow | ViSnapshotRow

type SubPaneIndicatorConfigV2 = {
  aliases?: string[]
  ensureIndicator: () => void
  heightStorageKey: string
  indicatorId: string
  paneId: string
  snapshotRowsKey: SnapshotRowsKeyV2
}

function cloneRows<Row extends SnapshotRowV2>(rows: unknown[]): Row[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as Row) } : {}
  )) as Row[]
}

function findPane(frame: KLineChartRenderFrameV2, indicatorId: string, aliases: string[] = []) {
  return [indicatorId, ...aliases].reduce<KLineChartPaneFrame | null>((found, key) => (
    found ?? frame.panes[key] ?? null
  ), null)
}

function writeSnapshot<Row extends SnapshotRowV2>(
  frame: KLineChartRenderFrameV2,
  pane: KLineChartPaneFrame,
  config: SubPaneIndicatorConfigV2,
) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: config.indicatorId,
    pane,
  })
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      period: frame.period,
      rows: frame.mainRows,
      [config.snapshotRowsKey]: cloneRows<Row>(pane.rows),
      symbol: frame.symbol,
    }),
    settingsHash,
    settingsHashKey: config.indicatorId,
    symbol: frame.symbol,
  })
  return createKLineChartRuntimeCalcParamsV2({
    frame,
    pageKey,
    pane,
    settingsHash,
  })
}

export function installKLineChartSubPaneIndicatorV2(
  chart: Chart,
  frame: KLineChartRenderFrameV2,
  config: SubPaneIndicatorConfigV2,
) {
  config.ensureIndicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createPaneOptions: () => ({
      id: config.paneId,
      height: readKLineChartSubPaneHeightV2(config.heightStorageKey),
      minHeight: kLineChartSubPaneMinHeightV2,
    }),
    indicatorName: config.indicatorId,
    onBeforeRemove: () => writeKLineChartSubPaneHeightV2(chart, config.paneId, config.heightStorageKey),
    paneId: config.paneId,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findPane(nextFrame, config.indicatorId, config.aliases)
    if (!pane || pane.renderRole !== 'sub-pane') {
      mount.remove()
      return
    }
    const calcParams = [writeSnapshot(nextFrame, pane, config)]
    mount.apply({ name: config.indicatorId, calcParams })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
