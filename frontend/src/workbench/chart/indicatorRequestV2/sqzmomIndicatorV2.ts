import { normalizeSqzmomSettings, type SqzmomIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import { calculateTradingViewSqzmomRows, type SqzmomIndicatorRow } from '../tradingViewSqzmomIndicator'
import { createOhlcSubPaneIndicatorDefinitionV2 } from './ohlcSubPaneIndicatorDefinitionV2'

export const storeV6SqzmomIndicatorIdV2 = 'SQZMOM'
export const storeV6SqzmomPaneIdV2 = 'sqzmom_pane'

export const storeV6SqzmomIndicatorDefinitionV2 = createOhlcSubPaneIndicatorDefinitionV2<SqzmomIndicatorRow, SqzmomIndicatorSettings>({
  calculateRows: calculateTradingViewSqzmomRows,
  id: storeV6SqzmomIndicatorIdV2,
  normalizeSettings: normalizeSqzmomSettings,
  paneId: storeV6SqzmomPaneIdV2,
  source: 'store-v6-sqzmom-indicator-v2',
  warmupRows: (settings) => Math.max(settings.bbLength, settings.kcLength) * 2,
})
