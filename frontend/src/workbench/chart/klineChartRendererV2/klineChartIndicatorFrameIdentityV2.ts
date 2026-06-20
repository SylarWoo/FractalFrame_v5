import { createIndicatorSettingsHash } from '../indicatorPageSnapshotStore'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

function frameRowsSignature(frame: KLineChartRenderFrameV2) {
  const first = frame.mainRows[0]
  const middle = frame.mainRows[Math.floor(frame.mainRows.length / 2)]
  const last = frame.mainRows[frame.mainRows.length - 1]
  const rowToken = (row: typeof first | undefined) => {
    if (!row) return 'none'
    return [
      Number(row.timestamp ?? 0),
      Number(row.open ?? 0),
      Number(row.high ?? 0),
      Number(row.low ?? 0),
      Number(row.close ?? 0),
      Number(row.volume ?? 0),
    ].join(',')
  }
  return [
    frame.symbol,
    frame.period,
    frame.pageIndex,
    frame.mainRows.length,
    rowToken(first),
    rowToken(middle),
    rowToken(last),
  ].join(':')
}

function paneRowsSignature(rows: unknown[]) {
  const first = rows[0]
  const middle = rows[Math.floor(rows.length / 2)]
  const last = rows[rows.length - 1]
  return [
    rows.length,
    createIndicatorSettingsHash(first ?? null),
    createIndicatorSettingsHash(middle ?? null),
    createIndicatorSettingsHash(last ?? null),
  ].join(':')
}

export function createKLineChartIndicatorPaneSignatureV2(frame: KLineChartRenderFrameV2, keys: string[]) {
  const pane = keys.map((key) => frame.panes[key]).find(Boolean)
  if (!pane) return 'disabled'
  return [
    frameRowsSignature(frame),
    pane.paneId ?? '',
    pane.renderRole ?? '',
    createIndicatorSettingsHash(pane.settings ?? null),
    paneRowsSignature(pane.rows),
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
