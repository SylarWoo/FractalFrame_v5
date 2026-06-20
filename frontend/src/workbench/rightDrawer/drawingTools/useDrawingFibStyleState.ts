import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import type { SelectedDrawingState } from './drawingTypes'
import { publishDrawingToolCommand } from '../drawingToolCommands'
import {
  readFibRetracementStyleState,
  sameFibLevels,
  sameLineSwatch,
  sameLineSwatchList,
  type FibLevelState,
} from '../FibRetracementStylePanel'

export function useDrawingFibStyleState({
  setSelectedDrawing,
  storagePeriod,
}: {
  setSelectedDrawing: Dispatch<SetStateAction<SelectedDrawingState | null>>
  storagePeriod: string
}) {
  const [fibTrendLineVisible, setFibTrendLineVisible] = useState(() => readFibRetracementStyleState(storagePeriod).trendLineVisible)
  const [fibTrendLineStyle, setFibTrendLineStyle] = useState<SettingsLineSwatchValue>(() => readFibRetracementStyleState(storagePeriod).trendLineStyle)
  const [fibLevels, setFibLevels] = useState<FibLevelState[]>(() => readFibRetracementStyleState(storagePeriod).levels)
  const [fibBackgroundVisible, setFibBackgroundVisible] = useState(() => readFibRetracementStyleState(storagePeriod).backgroundEnabled)
  const [fibBackgroundOpacity, setFibBackgroundOpacity] = useState(() => readFibRetracementStyleState(storagePeriod).background.opacity)
  const [fibReverse, setFibReverse] = useState(() => readFibRetracementStyleState(storagePeriod).reverse)
  const [fibPriceVisible, setFibPriceVisible] = useState(() => readFibRetracementStyleState(storagePeriod).priceVisible)
  const [fibLabelAlign, setFibLabelAlign] = useState(() => readFibRetracementStyleState(storagePeriod).labelAlign)
  const [fibLabelVAlign, setFibLabelVAlign] = useState(() => readFibRetracementStyleState(storagePeriod).labelVAlign)
  const [fibLabelFontSize, setFibLabelFontSize] = useState(() => readFibRetracementStyleState(storagePeriod).fontSize)
  const [fibLevelVisible, setFibLevelVisible] = useState(() => readFibRetracementStyleState(storagePeriod).levelVisible)
  const [fibLevelDisplay, setFibLevelDisplay] = useState(() => readFibRetracementStyleState(storagePeriod).levelDisplay)
  const [fibQuarterSplitVisible, setFibQuarterSplitVisible] = useState(() => readFibRetracementStyleState(storagePeriod).textVisible)
  const [fibQuarterLineStyles, setFibQuarterLineStyles] = useState<SettingsLineSwatchValue[]>(() => readFibRetracementStyleState(storagePeriod).quarterLineStyles)
  const [fibHorizontalLineStyle, setFibHorizontalLineStyle] = useState<SettingsLineSwatchValue>(() => {
    const style = readFibRetracementStyleState(storagePeriod)
    return {
      hex: '#787b86',
      lineStyle: style.horizontalLineStyle,
      opacity: 1,
      thickness: style.horizontalLineThickness,
    }
  })

  function setSelectedFibTrendLine(visible: boolean, style = fibTrendLineStyle) {
    setFibTrendLineVisible(visible)
    setFibTrendLineStyle(style)
    setSelectedDrawing((current) => current?.tool === 'fibRetracement'
      ? { ...current, fibTrendLineStyle: style, fibTrendLineVisible: visible }
      : current)
    publishDrawingToolCommand({
      action: 'updateSelectedFibTrendLine',
      fibTrendLineStyle: style,
      fibTrendLineVisible: visible,
      tool: 'fibRetracement',
    })
  }

  const setSelectedFibRetracementStyle = useCallback((levels: FibLevelState[], horizontalLineStyle: SettingsLineSwatchValue, backgroundVisible: boolean, backgroundOpacity: number, reverse: boolean, priceVisible: boolean, labelAlign: string, labelVAlign: string, labelFontSize: string, levelVisible: boolean, levelDisplay: string, quarterSplitVisible: boolean, quarterLineStyles: SettingsLineSwatchValue[]) => {
    setFibLevels((current) => sameFibLevels(current, levels) ? current : levels)
    setFibHorizontalLineStyle((current) => sameLineSwatch(current, horizontalLineStyle) ? current : horizontalLineStyle)
    setFibBackgroundVisible((current) => current === backgroundVisible ? current : backgroundVisible)
    setFibBackgroundOpacity((current) => Math.abs(current - backgroundOpacity) < 0.001 ? current : backgroundOpacity)
    setFibReverse((current) => current === reverse ? current : reverse)
    setFibPriceVisible((current) => current === priceVisible ? current : priceVisible)
    setFibLabelAlign((current) => current === labelAlign ? current : labelAlign)
    setFibLabelVAlign((current) => current === labelVAlign ? current : labelVAlign)
    setFibLabelFontSize((current) => current === labelFontSize ? current : labelFontSize)
    setFibLevelVisible((current) => current === levelVisible ? current : levelVisible)
    setFibLevelDisplay((current) => current === levelDisplay ? current : levelDisplay)
    setFibQuarterSplitVisible((current) => current === quarterSplitVisible ? current : quarterSplitVisible)
    setFibQuarterLineStyles((current) => sameLineSwatchList(current, quarterLineStyles) ? current : quarterLineStyles)
    setSelectedDrawing((current) => current?.tool === 'fibRetracement'
      ? sameLineSwatch(current.fibHorizontalLineStyle ?? horizontalLineStyle, horizontalLineStyle)
        && sameFibLevels(current.fibLevels ?? levels, levels)
        && current.fibBackgroundVisible === backgroundVisible
        && Math.abs((current.fibBackgroundOpacity ?? backgroundOpacity) - backgroundOpacity) < 0.001
        && current.fibReverse === reverse
        && current.fibPriceVisible === priceVisible
        && current.fibLabelAlign === labelAlign
        && current.fibLabelVAlign === labelVAlign
        && current.fibLabelFontSize === labelFontSize
        && current.fibLevelVisible === levelVisible
        && current.fibLevelDisplay === levelDisplay
        && current.fibQuarterSplitVisible === quarterSplitVisible
        && sameLineSwatchList(current.fibQuarterLineStyles ?? quarterLineStyles, quarterLineStyles)
        ? current
        : { ...current, fibBackgroundOpacity: backgroundOpacity, fibBackgroundVisible: backgroundVisible, fibHorizontalLineStyle: horizontalLineStyle, fibLabelAlign: labelAlign, fibLabelFontSize: labelFontSize, fibLabelVAlign: labelVAlign, fibLevelDisplay: levelDisplay, fibLevelVisible: levelVisible, fibLevels: levels, fibPriceVisible: priceVisible, fibQuarterLineStyles: quarterLineStyles, fibQuarterSplitVisible: quarterSplitVisible, fibReverse: reverse }
      : current)
    publishDrawingToolCommand({
      action: 'updateSelectedFibRetracementStyle',
      fibBackgroundOpacity: backgroundOpacity,
      fibBackgroundVisible: backgroundVisible,
      fibHorizontalLineStyle: horizontalLineStyle,
      fibLabelAlign: labelAlign,
      fibLabelFontSize: labelFontSize,
      fibLabelVAlign: labelVAlign,
      fibLevelDisplay: levelDisplay,
      fibLevelVisible: levelVisible,
      fibLevels: levels,
      fibPriceVisible: priceVisible,
      fibQuarterLineStyles: quarterLineStyles,
      fibQuarterSplitVisible: quarterSplitVisible,
      fibReverse: reverse,
      tool: 'fibRetracement',
    })
  }, [setSelectedDrawing])

  return {
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
    setSelectedFibRetracementStyle,
    setSelectedFibTrendLine,
  }
}
