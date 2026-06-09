import { createIndicatorSettingsHash } from '../indicatorPageSnapshotStore'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

export function createKLineChartIndicatorPaneSignatureV2(frame: KLineChartRenderFrameV2, keys: string[]) {
  const pane = keys.map((key) => frame.panes[key]).find(Boolean)
  if (!pane) return 'disabled'
  const lastRow = pane.rows[pane.rows.length - 1] ?? null
  return [
    pane.key,
    pane.renderRole ?? '',
    pane.rows.length,
    createIndicatorSettingsHash(pane.settings ?? null),
    createIndicatorSettingsHash(lastRow),
  ].join(':')
}

export function createKLineChartIndicatorFrameIdentityV2() {
  const lastSignatures = new Map<string, string>()

  return {
    clear() {
      lastSignatures.clear()
    },
    shouldUpdate(name: string, frame: KLineChartRenderFrameV2, keys: string[]) {
      const signature = createKLineChartIndicatorPaneSignatureV2(frame, keys)
      if (lastSignatures.get(name) === signature) return false
      lastSignatures.set(name, signature)
      return true
    },
  }
}
