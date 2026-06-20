import type { DrawingTool } from './drawingTypes'

export const drawingTools: DrawingTool[] = [
  { key: 'horizontalLine', label: '\u6c34\u5e73\u7ebf', tabs: ['style', 'text', 'coords'] },
  { key: 'trendLine', label: '\u8d8b\u52bf\u7ebf', tabs: ['style', 'text', 'coords'] },
  { key: 'ruler', label: '\u6807\u5c3a', tabs: ['style', 'text', 'coords'] },
  { key: 'fibRetracement', label: '\u6590\u6ce2\u90a3\u5951\u56de\u64a4', tabs: ['style', 'coords'] },
  { key: 'morganRange', label: '\u6469\u6839\u533a\u95f4' },
  { key: 'emojiSticker', label: '\u8868\u60c5\u8d34\u7eb8', tabs: ['style', 'text'] },
  { key: 'cursor', label: '\u5149\u6807' },
]

export const drawingsDrawerSplitConfig = {
  defaultHeight: 254,
  maxHeight: 420,
  minHeight: 96,
}
