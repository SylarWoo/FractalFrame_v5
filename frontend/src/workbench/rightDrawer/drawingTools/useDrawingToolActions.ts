import type { Dispatch, SetStateAction } from 'react'
import type { DrawingCrossPeriodTarget } from '../../drawing/drawingCrossPeriodModel'
import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import type { DrawingSelection, DrawingToolKey } from './drawingTypes'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../drawingPersistence'
import { writeDrawingObjectPersistence } from '../drawingObjectPersistence'
import { publishDrawingToolCommand } from '../drawingToolCommands'
import type { FibLevelState } from '../FibRetracementStylePanel'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'
import { createDrawingToolStartCommand } from './createDrawingToolStartCommand'

type PersistableToolKey = 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'emojiSticker'
type ReleasableToolKey = PersistableToolKey | 'morganRange'

function isPersistableToolKey(value: DrawingToolKey): value is PersistableToolKey {
  return value === 'horizontalLine' || value === 'trendLine' || value === 'ruler' || value === 'fibRetracement' || value === 'emojiSticker'
}

function isReleasableToolKey(value: DrawingToolKey): value is ReleasableToolKey {
  return isPersistableToolKey(value) || value === 'morganRange'
}

export function useDrawingToolActions<TSelection extends DrawingSelection>({
  fibBackgroundOpacity,
  fibBackgroundVisible,
  fibHorizontalLineStyle,
  fibLabelAlign,
  fibLabelFontSize,
  fibLabelVAlign,
  fibLevelDisplay,
  fibLevelVisible,
  fibLevels,
  fibPriceVisible,
  fibQuarterLineStyles,
  fibQuarterSplitVisible,
  fibReverse,
  fibTrendLineStyle,
  fibTrendLineVisible,
  lineStyles,
  rulerStyle,
  selectedCrossPeriod,
  selectedCrossPeriodTargets,
  selectedDrawing,
  selectedEmoji,
  selectedKey,
  selectedLocked,
  selectedPriceLabel,
  selectedTextStyle,
  setArmedKey,
  setLockedTools,
  setPersistedTools,
  stickerColor,
  stickerSize,
  textStyles,
  trendLineStyle,
}: {
  fibBackgroundOpacity: number
  fibBackgroundVisible: boolean
  fibHorizontalLineStyle: SettingsLineSwatchValue
  fibLabelAlign: string
  fibLabelFontSize: string
  fibLabelVAlign: string
  fibLevelDisplay: string
  fibLevelVisible: boolean
  fibLevels: FibLevelState[]
  fibPriceVisible: boolean
  fibQuarterLineStyles: SettingsLineSwatchValue[]
  fibQuarterSplitVisible: boolean
  fibReverse: boolean
  fibTrendLineStyle: SettingsLineSwatchValue
  fibTrendLineVisible: boolean
  lineStyles: Record<string, SettingsLineSwatchValue>
  rulerStyle: DrawingRulerStyle
  selectedCrossPeriod: boolean
  selectedCrossPeriodTargets: DrawingCrossPeriodTarget[]
  selectedDrawing: TSelection | null
  selectedEmoji: string
  selectedKey: DrawingToolKey
  selectedLocked: boolean
  selectedPriceLabel: boolean
  selectedTextStyle: DrawingTextStyle
  setArmedKey: Dispatch<SetStateAction<DrawingToolKey | null>>
  setLockedTools: Dispatch<SetStateAction<Record<string, boolean>>>
  setPersistedTools: Dispatch<SetStateAction<Record<string, boolean>>>
  stickerColor: string
  stickerSize: number
  textStyles: Record<string, DrawingTextStyle>
  trendLineStyle: DrawingTrendLineStyle
}) {
  function setPersistence(enabled: boolean) {
    if (!isPersistableToolKey(selectedKey)) return
    setPersistedTools((current) => ({ ...current, [selectedKey]: enabled }))
    writeDrawingObjectPersistence(selectedKey, enabled)
    publishDrawingToolCommand({
      action: 'updatePersistence',
      persisted: enabled,
      tool: selectedKey,
    })
  }

  function armSelectedTool() {
    setArmedKey(selectedKey)
    const command = createDrawingToolStartCommand({
      fibBackgroundOpacity,
      fibBackgroundVisible,
      fibHorizontalLineStyle,
      fibLabelAlign,
      fibLabelFontSize,
      fibLabelVAlign,
      fibLevelDisplay,
      fibLevelVisible,
      fibLevels,
      fibPriceVisible,
      fibQuarterLineStyles,
      fibQuarterSplitVisible,
      fibReverse,
      fibTrendLineStyle,
      fibTrendLineVisible,
      lineStyles,
      rulerStyle,
      selectedCrossPeriod,
      selectedCrossPeriodTargets,
      selectedEmoji,
      selectedKey,
      selectedLocked,
      selectedPriceLabel,
      selectedTextStyle,
      stickerColor,
      stickerSize,
      textStyles,
      trendLineStyle,
    })
    if (command) publishDrawingToolCommand(command)
  }

  function releaseSelectedTool() {
    setArmedKey(null)
    if (!isReleasableToolKey(selectedKey)) return
    publishDrawingToolCommand({
      action: 'release',
      tool: selectedKey,
    })
  }

  function toggleSelectedLock() {
    if (selectedDrawing?.tool === selectedKey) {
      if (!isPersistableToolKey(selectedKey)) return
      publishDrawingToolCommand({
        action: 'toggleSelectedLock',
        tool: selectedKey,
      })
      return
    }
    setLockedTools((current) => ({ ...current, [selectedKey]: !selectedLocked }))
  }

  function deleteSelectedDrawing() {
    const targetTool = selectedDrawing?.tool && isPersistableToolKey(selectedDrawing.tool)
      ? selectedDrawing.tool
      : selectedKey
    if (!isPersistableToolKey(targetTool)) return
    publishDrawingToolCommand({
      action: 'deleteSelected',
      tool: targetTool,
    })
  }

  return {
    armSelectedTool,
    deleteSelectedDrawing,
    releaseSelectedTool,
    setPersistence,
    toggleSelectedLock,
  }
}
