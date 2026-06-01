import { defaultMmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { activeMmfV3SignalIds } from './mmfV3IsolatedSignals'
import { mmfV3SignalCatalog } from './mmfV3SignalCatalog'
import type { MmfV3MarkerSpec } from './mmfV3Types'

export function clampMmfV3MarkerSize(value: unknown, fallback = defaultMmfIndicatorSettings.highSize) {
  const size = Math.round(Number(value))
  return Number.isFinite(size) ? Math.max(8, Math.min(size, 96)) : fallback
}

export const mmfV3MarkerSpecs: MmfV3MarkerSpec[] = mmfV3SignalCatalog.filter((entry) => activeMmfV3SignalIds.has(entry.id)).map((entry) => ({
  color: (settings) => String(settings[entry.colorKey] || entry.defaultStyle.color),
  distanceKey: entry.distanceKey,
  markerKey: entry.markerKey,
  markerType: entry.sourceMarkerType,
  offsetMultiplier: entry.defaultStyle.offsetMultiplier,
  priceKey: entry.priceKey,
  show: (settings) => settings[entry.showKey] === true,
  size: (settings) => clampMmfV3MarkerSize(settings[entry.sizeKey], entry.defaultStyle.size),
  symbol: (settings) => String(settings[entry.symbolKey] || entry.defaultStyle.symbol),
  textBaseline: entry.defaultStyle.placement === 'above' ? 'bottom' : 'top',
  title: `${entry.label} `,
  yDirection: entry.defaultStyle.placement === 'above' ? -1 : 1,
}))
