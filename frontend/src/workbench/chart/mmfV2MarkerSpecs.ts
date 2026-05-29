import { defaultMmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { mmfV2SignalCatalog } from './mmfV2SignalCatalog'
import type { MmfV2MarkerSpec } from './mmfV2Types'

export function clampMmfV2MarkerSize(value: unknown, fallback = defaultMmfIndicatorSettings.highSize) {
  const size = Math.round(Number(value))
  return Number.isFinite(size) ? Math.max(8, Math.min(size, 96)) : fallback
}

export const mmfV2MarkerSpecs: MmfV2MarkerSpec[] = mmfV2SignalCatalog.map((entry) => ({
  color: (settings) => String(settings[entry.colorKey] || entry.defaultStyle.color),
  distanceKey: entry.distanceKey,
  markerKey: entry.markerKey,
  markerType: entry.sourceMarkerType,
  offsetMultiplier: entry.defaultStyle.offsetMultiplier,
  priceKey: entry.priceKey,
  show: (settings) => settings[entry.showKey] === true,
  size: (settings) => clampMmfV2MarkerSize(settings[entry.sizeKey], entry.defaultStyle.size),
  symbol: (settings) => String(settings[entry.symbolKey] || entry.defaultStyle.symbol),
  textBaseline: entry.defaultStyle.placement === 'above' ? 'bottom' : 'top',
  title: `${entry.label} `,
  yDirection: entry.defaultStyle.placement === 'above' ? -1 : 1,
}))
