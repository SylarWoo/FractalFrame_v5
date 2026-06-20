import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

function stripIndicatorKeySuffix(key: string) {
  return key.split(':indicators:')[0]
}

function sameNumber(left: unknown, right: unknown) {
  return Number(left ?? 0) === Number(right ?? 0)
}

export function buildKLineChartRenderWindowKeyV2(frame: KLineChartRenderFrameV2) {
  return `${frame.symbol}:${frame.period}:${frame.pageIndex}:${stripIndicatorKeySuffix(frame.segments.history.key)}:${frame.segments.realtime?.timeFrom ?? 'none'}`
}

function buildKLineChartMainRowsIdentityV2(frame: KLineChartRenderFrameV2) {
  const first = frame.mainRows[0]
  const middle = frame.mainRows[Math.floor(frame.mainRows.length / 2)]
  const last = frame.mainRows[frame.mainRows.length - 1]
  const rowSignature = (row: typeof first) => [
    Number(row?.timestamp ?? 0),
    Number(row?.open ?? 0),
    Number(row?.high ?? 0),
    Number(row?.low ?? 0),
    Number(row?.close ?? 0),
    Number(row?.volume ?? 0),
  ].join(',')
  return [
    frame.symbol,
    frame.period,
    frame.pageIndex,
    frame.mainRows.length,
    stripIndicatorKeySuffix(frame.segments.history.key),
    frame.segments.realtime ? stripIndicatorKeySuffix(frame.segments.realtime.key) : 'no-realtime',
    rowSignature(first),
    rowSignature(middle),
    rowSignature(last),
  ].join(':')
}

export function canApplyKLineChartTailUpdateV2(options: {
  current: KLineChartRenderFrameV2
  previous: KLineChartRenderFrameV2 | null
  sameRenderWindow: boolean
}) {
  const { current, previous, sameRenderWindow } = options
  return sameRenderWindow &&
    previous != null &&
    current.mainRows.length >= previous.mainRows.length &&
    current.mainRows.length <= previous.mainRows.length + 1 &&
    current.mainRows.length > 0
}

export function canApplyKLineChartPaneOnlyUpdateV2(options: {
  current: KLineChartRenderFrameV2
  previous: KLineChartRenderFrameV2 | null
  sameRenderWindow: boolean
}) {
  const { current, previous, sameRenderWindow } = options
  if (!sameRenderWindow || !previous) return false
  if (current.mainRows.length !== previous.mainRows.length) return false
  if (buildKLineChartMainRowsIdentityV2(current) === buildKLineChartMainRowsIdentityV2(previous)) return true
  for (let index = 0; index < current.mainRows.length; index += 1) {
    const left = current.mainRows[index]
    const right = previous.mainRows[index]
    if (
      !sameNumber(left?.timestamp, right?.timestamp) ||
      !sameNumber(left?.open, right?.open) ||
      !sameNumber(left?.high, right?.high) ||
      !sameNumber(left?.low, right?.low) ||
      !sameNumber(left?.close, right?.close) ||
      !sameNumber(left?.volume, right?.volume)
    ) {
      return false
    }
  }
  return true
}
