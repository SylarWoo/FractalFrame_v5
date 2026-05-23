export const drawingMainPaneId = 'candle_pane'

export const drawingSubPaneIds = ['rsi_pane', 'stoch_pane', 'macd_pane', 'tsi_pane', 'vi_pane'] as const

export const knownDrawingPaneIds = [drawingMainPaneId, ...drawingSubPaneIds] as const

const drawingSubPaneNames: Record<string, string> = {
  macd_pane: 'MACD',
  rsi_pane: 'RSI',
  stoch_pane: 'Stoch',
  tsi_pane: 'TSI',
  vi_pane: 'VI',
}

export function drawingSubPaneTitle(paneId: string) {
  const name = drawingSubPaneNames[paneId]
  return name ? `\u526f\u56fe ${name}` : '\u526f\u56fe'
}

export function compareDrawingSubPaneIds(left: string, right: string) {
  const leftIndex = drawingSubPaneIds.indexOf(left as typeof drawingSubPaneIds[number])
  const rightIndex = drawingSubPaneIds.indexOf(right as typeof drawingSubPaneIds[number])
  if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
  if (leftIndex === -1) return 1
  if (rightIndex === -1) return -1
  return leftIndex - rightIndex
}
