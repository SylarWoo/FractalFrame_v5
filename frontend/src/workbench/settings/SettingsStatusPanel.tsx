import { useState } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readSettingsBooleanValue, readSettingsStringValue, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from './chartSettingsSchema'
import { SettingsCheckboxInput, SettingsCheckRow } from './SettingsSharedControls'
import './SettingsStatusPanel.css'

export function SettingsStatusPanel() {
  const [titleVisible, setTitleVisible] = useState(() => readSettingsBooleanValue(chartSettingKeys.statusTitleVisible, chartSettingDefaults.statusTitleVisible))
  const [titleMode, setTitleMode] = useState(() => readSettingsStringValue(chartSettingKeys.statusTitleMode, chartSettingDefaults.statusTitleMode))

  return (
    <div className="ff-settings-status-panel">
      <section className="ff-settings-status-group">
        <div className="ff-settings-symbol-kicker">商品</div>
        <SettingsCheckRow storageKey="status.logo.visible">Logo</SettingsCheckRow>
        <div className="ff-settings-status-row">
          <input
            checked={titleVisible}
            onChange={(event) => {
              const next = event.currentTarget.checked
              setTitleVisible(next)
              writeSettingsSymbolStateValue(chartSettingKeys.statusTitleVisible, next)
            }}
            type="checkbox"
          />
          <span>标题</span>
          <OpenableSelect
            ariaLabel="标题"
            defaultValue="symbol-name"
            onChange={(value) => {
              setTitleMode(value)
              writeSettingsSymbolStateValue(chartSettingKeys.statusTitleMode, value)
            }}
            options={[
              { label: '商品和名称', value: 'symbol-name' },
              { label: '商品', value: 'symbol' },
              { label: '名称', value: 'name' },
            ]}
            value={titleMode}
          />
        </div>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusLocalDataLoadVisible}>本地数据加载</SettingsCheckRow>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusChartValuesVisible}>图表值</SettingsCheckRow>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusCandleChangeVisible}>K线变化值</SettingsCheckRow>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusCandleVolumeVisible}>成交量</SettingsCheckRow>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusCandleTimeVisible}>K线时间</SettingsCheckRow>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusMarketStatusVisible}>开市状态</SettingsCheckRow>
      </section>

      <section className="ff-settings-status-group">
        <div className="ff-settings-symbol-kicker">指标</div>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusIndicatorTitleVisible}>标题</SettingsCheckRow>
        <SettingsCheckRow checked inset storageKey={chartSettingKeys.statusIndicatorInputsVisible}>输入</SettingsCheckRow>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusIndicatorValuesVisible}>数值</SettingsCheckRow>
        <div className="ff-settings-status-row">
          <SettingsCheckboxInput checked storageKey="status.indicatorBackground.visible" />
          <span>背景</span>
          <div className="ff-settings-status-opacity" aria-hidden="true">
            <span />
          </div>
        </div>
      </section>
    </div>
  )
}
