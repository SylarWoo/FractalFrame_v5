import type { Chart } from 'klinecharts'
import { rulerOverlayName } from '../drawing/drawingOverlayModel'
import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { normalizeDrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import type { DrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeLineStyle, trendOverlayStylesFromLine } from './chartDrawingStyle'
import type { RulerExtendData } from './chartDrawingTypes'
import { resolveTwoPointEndpointPressStart, shouldActivateTwoPointEndpointDrag } from './twoPointDrawingInteraction'

export type PendingRulerOptions = {
  fibBackgroundOpacity?: number
  fibBackgroundVisible?: boolean
  fibHorizontalLineStyle?: SettingsLineSwatchValue
  fibLabelAlign?: string
  fibLabelFontSize?: string
  fibLabelVAlign?: string
  fibLevelDisplay?: string
  fibLevelVisible?: boolean
  fibLevels?: Array<{ color?: string; enabled?: boolean; opacity?: number; value?: string }>
  fibPriceVisible?: boolean
  fibQuarterLineStyles?: SettingsLineSwatchValue[]
  fibQuarterSplitVisible?: boolean
  fibReverse?: boolean
  fibTrendLineStyle?: SettingsLineSwatchValue
  fibTrendLineVisible?: boolean
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  rulerStyle: DrawingRulerStyle
  showPriceLabel: boolean
  textStyle?: DrawingTextStyle
}

export function createRulerOverlayFactory({
  chart,
  clearDeselectedRuler,
  clearRemovedRuler,
  overlayName = rulerOverlayName,
  persistCurrentRulers,
  publishObjectTreeState,
  selectedRulerOverlayIds,
  setActiveRuler,
  setPendingRulerOverlayId,
  setPendingRulerOptionsCleared,
  rulerOverlayIds,
  rulerOverlayZLevel,
  tool = 'ruler',
}: {
  chart: Chart
  clearDeselectedRuler: (id: string) => void
  clearRemovedRuler: (id: string) => void
  overlayName?: string
  persistCurrentRulers: () => void
  publishObjectTreeState: () => void
  selectedRulerOverlayIds: Set<string>
  setActiveRuler: (id: string) => void
  setPendingRulerOverlayId: (id: string | null) => void
  setPendingRulerOptionsCleared: () => void
  rulerOverlayIds: Set<string>
  rulerOverlayZLevel: number
  tool?: 'ruler' | 'fibRetracement'
}) {
  let pendingEndpointPress: { overlayId: string; pointIndex: number; x: number; y: number } | null = null
  let protectSelectedAfterMove: { overlayId: string; time: number } | null = null

  return function createRulerOverlay({
    lineStyle,
    locked,
    manualVisible = true,
    objectId,
    paneId,
    points,
    rulerStyle,
    selected,
    showPriceLabel,
    textStyle,
    fibBackgroundOpacity,
    fibBackgroundVisible,
    fibTrendLineStyle,
    fibTrendLineVisible,
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
  }: PendingRulerOptions & {
    manualVisible?: boolean
    objectId: string
    paneId: string
    points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
    selected: boolean
  }) {
    const completed = Array.isArray(points) && points.length >= 2
    return chart.createOverlay({
      name: overlayName,
      extendData: {
        dataList: chart.getDataList().map((row) => ({
          real_volume: Number((row as { real_volume?: number }).real_volume),
          tick_volume: Number((row as { tick_volume?: number }).tick_volume),
          timestamp: Number(row.timestamp),
          volume: Number(row.volume),
        })),
        drawing: !completed,
        hovered: false,
        lineStyle: normalizeLineStyle(lineStyle),
        locked,
        manualVisible,
        objectId,
        periodVisible: true,
        pressed: false,
        rulerStyle: normalizeDrawingRulerStyle(rulerStyle),
        selected,
        showPriceLabel,
        textStyle: normalizeDrawingTextStyle(textStyle),
        fibBackgroundOpacity,
        fibBackgroundVisible,
        fibTrendLineStyle,
        fibTrendLineVisible,
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
      },
      lock: locked,
      points,
      styles: trendOverlayStylesFromLine(lineStyle),
      visible: manualVisible,
      zLevel: rulerOverlayZLevel,
      onDrawEnd: ({ overlay }) => {
        setPendingRulerOverlayId(null)
        setPendingRulerOptionsCleared()
        setActiveRuler(overlay.id)
        rulerOverlayIds.add(overlay.id)
        chart.overrideOverlay({
          id: overlay.id,
          extendData: {
            ...(overlay.extendData as RulerExtendData | undefined),
            drawing: false,
            selected: true,
          },
        })
        publishDrawingToolState({
          armed: false,
          fibBackgroundOpacity,
          fibBackgroundVisible,
          fibTrendLineStyle: fibTrendLineStyle ? normalizeLineStyle(fibTrendLineStyle) : undefined,
          fibTrendLineVisible,
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
          lineStyle: normalizeLineStyle(lineStyle),
          locked,
          objectId,
          rulerStyle: normalizeDrawingRulerStyle(rulerStyle),
          selected: true,
          showPriceLabel,
          textStyle: normalizeDrawingTextStyle(textStyle),
          tool,
          trendPointPrices: resolveRulerPointPrices(overlay),
        })
        persistCurrentRulers()
        publishObjectTreeState()
        return false
      },
      onMouseEnter: ({ overlay }) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, hovered: true } })
        return false
      },
      onMouseLeave: ({ overlay }) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, hovered: false } })
        return false
      },
      onPressedMoveEnd: ({ overlay }) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        setActiveRuler(overlay.id)
        protectSelectedAfterMove = { overlayId: overlay.id, time: Date.now() }
        chart.overrideOverlay({
          id: overlay.id,
          extendData: {
            ...extendData,
            endpointPressed: false,
            pressed: false,
            pressedPointIndex: undefined,
            selected: true,
          },
        })
        pendingEndpointPress = null
        publishDrawingToolState({
          armed: false,
          fibBackgroundOpacity: extendData?.fibBackgroundOpacity,
          fibBackgroundVisible: extendData?.fibBackgroundVisible,
          fibTrendLineStyle: extendData?.fibTrendLineStyle ? normalizeLineStyle(extendData.fibTrendLineStyle) : undefined,
          fibTrendLineVisible: extendData?.fibTrendLineVisible,
          fibHorizontalLineStyle: extendData?.fibHorizontalLineStyle,
          fibLabelAlign: extendData?.fibLabelAlign,
          fibLabelFontSize: extendData?.fibLabelFontSize,
          fibLabelVAlign: extendData?.fibLabelVAlign,
          fibLevelDisplay: extendData?.fibLevelDisplay,
          fibLevelVisible: extendData?.fibLevelVisible,
          fibLevels: extendData?.fibLevels,
          fibPriceVisible: extendData?.fibPriceVisible,
          fibQuarterLineStyles: extendData?.fibQuarterLineStyles,
          fibQuarterSplitVisible: extendData?.fibQuarterSplitVisible,
          fibReverse: extendData?.fibReverse,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: extendData?.locked === true,
          objectId: extendData?.objectId,
          rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool,
          trendPointPrices: resolveRulerPointPrices(overlay),
        })
        persistCurrentRulers()
        publishObjectTreeState()
        return false
      },
      onPressedMoveStart: (event) => {
        const { overlay } = event
        const extendData = overlay.extendData as RulerExtendData | undefined
        setActiveRuler(overlay.id)
        pendingEndpointPress = resolveTwoPointEndpointPressStart(event)
        chart.overrideOverlay({
          id: overlay.id,
          extendData: {
            ...extendData,
            endpointPressed: false,
            pressed: true,
            pressedPointIndex: undefined,
            selected: true,
          },
        })
        publishDrawingToolState({
          armed: false,
          fibBackgroundOpacity: extendData?.fibBackgroundOpacity,
          fibBackgroundVisible: extendData?.fibBackgroundVisible,
          fibTrendLineStyle: extendData?.fibTrendLineStyle ? normalizeLineStyle(extendData.fibTrendLineStyle) : undefined,
          fibTrendLineVisible: extendData?.fibTrendLineVisible,
          fibHorizontalLineStyle: extendData?.fibHorizontalLineStyle,
          fibLabelAlign: extendData?.fibLabelAlign,
          fibLabelFontSize: extendData?.fibLabelFontSize,
          fibLabelVAlign: extendData?.fibLabelVAlign,
          fibLevelDisplay: extendData?.fibLevelDisplay,
          fibLevelVisible: extendData?.fibLevelVisible,
          fibLevels: extendData?.fibLevels,
          fibPriceVisible: extendData?.fibPriceVisible,
          fibQuarterLineStyles: extendData?.fibQuarterLineStyles,
          fibQuarterSplitVisible: extendData?.fibQuarterSplitVisible,
          fibReverse: extendData?.fibReverse,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: extendData?.locked === true,
          objectId: extendData?.objectId,
          rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool,
          trendPointPrices: resolveRulerPointPrices(overlay),
        })
        publishObjectTreeState()
        return false
      },
      onPressedMoving: (event) => {
        const { overlay } = event
        const extendData = overlay.extendData as RulerExtendData | undefined
        if (overlay.lock === true || extendData?.locked === true) return true
        if (shouldActivateTwoPointEndpointDrag({ event, pending: pendingEndpointPress, threshold: 3 })) {
          const pointIndex = pendingEndpointPress?.pointIndex
          chart.overrideOverlay({
            id: overlay.id,
            extendData: {
              ...extendData,
              endpointPressed: true,
              pressed: true,
              pressedPointIndex: pointIndex,
              selected: true,
            },
          })
          pendingEndpointPress = null
          return false
        }
        if (pendingEndpointPress) return false
        if (extendData?.endpointPressed === true) return false
        return false
      },
      onRemoved: ({ overlay }) => {
        clearRemovedRuler(overlay.id)
        rulerOverlayIds.delete(overlay.id)
        persistCurrentRulers()
        publishObjectTreeState()
        return false
      },
      onSelected: ({ overlay }) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        setActiveRuler(overlay.id)
        chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: true } })
        publishDrawingToolState({
          armed: false,
          fibBackgroundOpacity: extendData?.fibBackgroundOpacity,
          fibBackgroundVisible: extendData?.fibBackgroundVisible,
          fibTrendLineStyle: extendData?.fibTrendLineStyle ? normalizeLineStyle(extendData.fibTrendLineStyle) : undefined,
          fibTrendLineVisible: extendData?.fibTrendLineVisible,
          fibHorizontalLineStyle: extendData?.fibHorizontalLineStyle,
          fibLabelAlign: extendData?.fibLabelAlign,
          fibLabelFontSize: extendData?.fibLabelFontSize,
          fibLabelVAlign: extendData?.fibLabelVAlign,
          fibLevelDisplay: extendData?.fibLevelDisplay,
          fibLevelVisible: extendData?.fibLevelVisible,
          fibLevels: extendData?.fibLevels,
          fibPriceVisible: extendData?.fibPriceVisible,
          fibQuarterLineStyles: extendData?.fibQuarterLineStyles,
          fibQuarterSplitVisible: extendData?.fibQuarterSplitVisible,
          fibReverse: extendData?.fibReverse,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: extendData?.locked === true,
          objectId: extendData?.objectId,
          rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool,
          trendPointPrices: resolveRulerPointPrices(overlay),
        })
        publishObjectTreeState()
        return false
      },
      onDeselected: ({ overlay }) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        if (overlay.visible === false || extendData?.manualVisible === false || extendData?.periodVisible === false) return false
        if (
          protectSelectedAfterMove?.overlayId === overlay.id
          && Date.now() - protectSelectedAfterMove.time < 180
          && (selectedRulerOverlayIds.has(overlay.id) || extendData?.selected === true)
        ) {
          chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed: false, pressed: false, pressedPointIndex: undefined, selected: true } })
          return false
        }
        selectedRulerOverlayIds.delete(overlay.id)
        clearDeselectedRuler(overlay.id)
        chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: false, pressed: false } })
        publishDrawingToolState({
          armed: false,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool,
        })
        publishObjectTreeState()
        return false
      },
    }, paneId)
  }
}

function resolveRulerPointPrices(overlay: { points?: Array<{ value?: number }> } | null | undefined): [number | undefined, number | undefined] {
  const first = Number(overlay?.points?.[0]?.value)
  const second = Number(overlay?.points?.[1]?.value)
  return [
    Number.isFinite(first) ? first : undefined,
    Number.isFinite(second) ? second : undefined,
  ]
}
