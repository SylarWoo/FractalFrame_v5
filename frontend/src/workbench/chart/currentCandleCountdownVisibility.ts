import { readWatchlistRealtimeEnabled } from '../mt5DataCenter/storeV5Persistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'

export function readCurrentCandleCountdownActive(symbol: string) {
  void symbol
  const settingVisible = readSettingsBooleanValue(
    chartSettingKeys.currentCandleCountdownVisible,
    chartSettingDefaults.currentCandleCountdownVisible,
  )
  return settingVisible && readWatchlistRealtimeEnabled()
}
