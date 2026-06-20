import { normalizeAoSettings, type AoIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import { calculateTradingViewAoRows, type AoIndicatorRow } from '../tradingViewAoIndicator'
import { createOhlcSubPaneIndicatorDefinitionV2 } from './ohlcSubPaneIndicatorDefinitionV2'

export const storeV6AoIndicatorIdV2 = 'AO'
export const storeV6AoPaneIdV2 = 'ao_pane'

export const storeV6AoIndicatorDefinitionV2 = createOhlcSubPaneIndicatorDefinitionV2<AoIndicatorRow, AoIndicatorSettings>({
  calculateRows: calculateTradingViewAoRows,
  id: storeV6AoIndicatorIdV2,
  normalizeSettings: normalizeAoSettings,
  paneId: storeV6AoPaneIdV2,
  source: 'store-v6-ao-indicator-v2',
  warmupRows: (settings) => Math.max(settings.fastLength, settings.slowLength),
})
