import { registerOverlay } from 'klinecharts'
import {
  fibRetracementOverlayName,
  horizontalLineOverlayName,
  rulerOverlayName,
  trendLineOverlayName,
} from '../drawing/drawingOverlayModel'
import {
  ensureHorizontalLineTextFigure,
  ensureRulerCenterTextFigure,
  ensureTrendLineHitFigure,
  ensureTrendLineStatsBoxFigure,
  ensureTrendLineTextFigure,
} from './chartDrawingFigures'
import { createFibRetracementPointFigures, createFibRetracementYAxisFigures } from './fibRetracementOverlayFigures'
import { createHorizontalLinePointFigures, createHorizontalLineYAxisFigures } from './horizontalLineOverlayFigures'
import { ensureMorganRangeOverlay } from './morganRangeOverlay'
import { ensureQuickMeasureOverlay } from './quickMeasureOverlay'
import { createRulerPointFigures, createRulerYAxisFigures } from './rulerOverlayFigures'
import { ensureChartSymbolMarkerOverlay } from './chartSymbolMarkerOverlay'
import { ensureStickerOverlay } from './stickerOverlay'
import { createTrendLinePointFigures, createTrendLineYAxisFigures } from './trendLineOverlayFigures'

let horizontalLineOverlayRegistered = false
let trendLineOverlayRegistered = false
let rulerOverlayRegistered = false
let fibRetracementOverlayRegistered = false

function ensureHorizontalLineOverlay() {
  if (horizontalLineOverlayRegistered) return
  ensureHorizontalLineTextFigure()
  horizontalLineOverlayRegistered = true
  registerOverlay({
    name: horizontalLineOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createHorizontalLinePointFigures,
    createYAxisFigures: createHorizontalLineYAxisFigures,
  })
}

function ensureTrendLineOverlay() {
  if (trendLineOverlayRegistered) return
  ensureTrendLineHitFigure()
  ensureTrendLineTextFigure()
  ensureTrendLineStatsBoxFigure()
  trendLineOverlayRegistered = true
  registerOverlay({
    name: trendLineOverlayName,
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createTrendLinePointFigures,
    createYAxisFigures: createTrendLineYAxisFigures,
  })
}

function ensureRulerOverlay() {
  if (rulerOverlayRegistered) return
  ensureQuickMeasureOverlay()
  ensureRulerCenterTextFigure()
  ensureTrendLineHitFigure()
  ensureTrendLineStatsBoxFigure()
  rulerOverlayRegistered = true
  registerOverlay({
    name: rulerOverlayName,
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createRulerPointFigures,
    createYAxisFigures: createRulerYAxisFigures,
  })
}

function ensureFibRetracementOverlay() {
  if (fibRetracementOverlayRegistered) return
  ensureTrendLineHitFigure()
  fibRetracementOverlayRegistered = true
  registerOverlay({
    name: fibRetracementOverlayName,
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createFibRetracementPointFigures,
    createYAxisFigures: createFibRetracementYAxisFigures,
  })
}

export function ensureChartDrawingOverlays() {
  ensureHorizontalLineOverlay()
  ensureTrendLineOverlay()
  ensureRulerOverlay()
  ensureFibRetracementOverlay()
  ensureMorganRangeOverlay()
  ensureStickerOverlay()
  ensureChartSymbolMarkerOverlay()
}
