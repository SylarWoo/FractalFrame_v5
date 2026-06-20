import { defaultRsiIndicatorSettings, type RsiIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import { calculateTradingViewRsiRows, type RsiIndicatorRow } from '../tradingViewRsiIndicator'
import { createOhlcSubPaneIndicatorDefinitionV2 } from './ohlcSubPaneIndicatorDefinitionV2'

export const storeV6RsiIndicatorIdV2 = 'RSI'
export const storeV6RsiPaneIdV2 = 'rsi_pane'

function normalizeRsiSettings(input?: Partial<RsiIndicatorSettings>): RsiIndicatorSettings {
  return { ...defaultRsiIndicatorSettings, ...(input ?? {}) }
}

export const storeV6RsiIndicatorDefinitionV2 = createOhlcSubPaneIndicatorDefinitionV2<RsiIndicatorRow, RsiIndicatorSettings>({
  calculateRows: calculateTradingViewRsiRows,
  id: storeV6RsiIndicatorIdV2,
  normalizeSettings: normalizeRsiSettings,
  paneId: storeV6RsiPaneIdV2,
  source: 'store-v6-rsi-indicator-v2',
  warmupRows: (settings) => settings.length + (settings.smoothingType === 'none' ? 0 : settings.smoothingLength),
})
