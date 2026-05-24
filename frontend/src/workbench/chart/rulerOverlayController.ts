import type { Chart } from 'klinecharts'
import { rulerOverlayName } from '../drawing/drawingOverlayModel'
import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { normalizeDrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import type { DrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeLineStyle, trendOverlayStylesFromLine } from './chartDrawingStyle'
import type { RulerExtendData, ScreenPoint } from './chartDrawingTypes'
import { isCoordinate } from './chartDrawingTypes'
import { isTwoPointEndpointFigureKey, resolveTwoPointEndpointPressStart, shouldActivateTwoPointEndpointDrag } from './twoPointDrawingInteraction'

export type PendingRulerOptions = {
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
  persistCurrentRulers,
  publishObjectTreeState,
  selectedRulerOverlayIds,
  setActiveRuler,
  setPendingRulerOverlayId,
  setPendingRulerOptionsCleared,
  rulerOverlayIds,
  rulerOverlayZLevel,
}: {
  chart: Chart
  clearDeselectedRuler: (id: string) => void
  clearRemovedRuler: (id: string) => void
  persistCurrentRulers: () => void
  publishObjectTreeState: () => void
  selectedRulerOverlayIds: Set<string>
  setActiveRuler: (id: string) => void
  setPendingRulerOverlayId: (id: string | null) => void
  setPendingRulerOptionsCleared: () => void
  rulerOverlayIds: Set<string>
  rulerOverlayZLevel: number
}) {
  let pendingEndpointPress: { overlayId: string; pointIndex: number; x: number; y: number } | null = null
  let bodyMoveState: {
    overlayId: string
    paneId: string
    startX: number
    startY: number
    points: Array<{
      pixel: ScreenPoint
      point: { dataIndex?: number; timestamp?: number; value?: number }
    }>
  } | null = null

  const resolveOverlayPointPixel = (point: { dataIndex?: number; timestamp?: number; value?: number }, paneId: string): ScreenPoint | null => {
    const value = Number(point?.value)
    if (!Number.isFinite(value)) return null
    const dataIndex = Number(point?.dataIndex)
    const timestamp = Number(point?.timestamp)
    const pixel = chart.convertToPixel({
      ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
      value,
    }, { paneId })
    const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
    const x = Number(coordinate?.x)
    const y = Number(coordinate?.y)
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }

  const resolvePointFromPixel = (pixel: ScreenPoint, paneId: string) => {
    const point = chart.convertFromPixel([pixel], { paneId })
    const coordinate = Array.isArray(point) ? point[0] : point
    const dataIndex = Number(coordinate?.dataIndex)
    const timestamp = Number(coordinate?.timestamp)
    const value = Number(coordinate?.value)
    return {
      ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
      ...(Number.isFinite(value) ? { value } : {}),
    }
  }

  const beginBodyMove = (overlay: { id: string; paneId?: string; points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }> }, paneId: string, event: { x?: number; y?: number }) => {
    const startX = Number(event.x)
    const startY = Number(event.y)
    if (!Number.isFinite(startX) || !Number.isFinite(startY)) {
      bodyMoveState = null
      return
    }
    const points = (overlay.points ?? []).slice(0, 2)
      .map((point) => {
        const pixel = resolveOverlayPointPixel(point, paneId)
        return pixel ? { pixel, point: { ...point } } : null
      })
      .filter((point): point is NonNullable<typeof point> => point != null)
    bodyMoveState = points.length >= 2 ? { overlayId: overlay.id, paneId, points, startX, startY } : null
  }

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
  }: PendingRulerOptions & {
    manualVisible?: boolean
    objectId: string
    paneId: string
    points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
    selected: boolean
  }) {
    const completed = Array.isArray(points) && points.length >= 2
    return chart.createOverlay({
      name: rulerOverlayName,
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
          lineStyle: normalizeLineStyle(lineStyle),
          locked,
          objectId,
          rulerStyle: normalizeDrawingRulerStyle(rulerStyle),
          selected: true,
          showPriceLabel,
          textStyle: normalizeDrawingTextStyle(textStyle),
          tool: 'ruler',
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
        bodyMoveState = null
        publishDrawingToolState({
          armed: false,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: extendData?.locked === true,
          objectId: extendData?.objectId,
          rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'ruler',
          trendPointPrices: resolveRulerPointPrices(overlay),
        })
        persistCurrentRulers()
        publishObjectTreeState()
        return false
      },
      onPressedMoveStart: (event) => {
        const { overlay } = event
        const extendData = overlay.extendData as RulerExtendData | undefined
        const endpointPressed = isTwoPointEndpointFigureKey(event.figureKey)
        setActiveRuler(overlay.id)
        pendingEndpointPress = resolveTwoPointEndpointPressStart(event)
        if (!endpointPressed) beginBodyMove(overlay, overlay.paneId || paneId, event as { x?: number; y?: number })
        else bodyMoveState = null
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
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: extendData?.locked === true,
          objectId: extendData?.objectId,
          rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'ruler',
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
          bodyMoveState = null
          return false
        }
        if (pendingEndpointPress) return false
        if (extendData?.endpointPressed === true) return false
        if (!bodyMoveState || bodyMoveState.overlayId !== overlay.id) return false
        const x = Number(event.x)
        const y = Number(event.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false
        const dx = x - bodyMoveState.startX
        const dy = y - bodyMoveState.startY
        chart.overrideOverlay({
          id: overlay.id,
          points: bodyMoveState.points.map((point) => ({
            ...point.point,
            ...resolvePointFromPixel({ x: point.pixel.x + dx, y: point.pixel.y + dy }, bodyMoveState?.paneId ?? paneId),
          })),
        })
        return true
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
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: extendData?.locked === true,
          objectId: extendData?.objectId,
          rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'ruler',
          trendPointPrices: resolveRulerPointPrices(overlay),
        })
        publishObjectTreeState()
        return false
      },
      onDeselected: ({ overlay }) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        selectedRulerOverlayIds.delete(overlay.id)
        clearDeselectedRuler(overlay.id)
        chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: false, pressed: false } })
        publishDrawingToolState({
          armed: false,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'ruler',
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
