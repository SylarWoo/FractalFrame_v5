import { readWatchlistRealtimeEnabled } from '../mt5DataCenter/storeV5Persistence'
import { readMarketStatusTitleSnapshot } from '../mt5DataCenter/marketStatusTitleState'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'

export function readCurrentCandleCountdownActive(symbol: string) {
  const settingVisible = readSettingsBooleanValue(
    chartSettingKeys.currentCandleCountdownVisible,
    chartSettingDefaults.currentCandleCountdownVisible,
  )
  const marketStatus = readMarketStatusTitleSnapshot(symbol)?.status
  return settingVisible && readWatchlistRealtimeEnabled() && marketStatus?.status !== 'closed'
}
