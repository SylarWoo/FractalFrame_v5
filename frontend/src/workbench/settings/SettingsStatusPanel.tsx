import { useState } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readSettingsStringValue, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from './chartSettingsSchema'
import { SettingsCheckRow } from './SettingsSharedControls'
import './SettingsStatusPanel.css'

export function SettingsStatusPanel() {
  const [titleMode, setTitleMode] = useState(() => readSettingsStringValue(chartSettingKeys.statusTitleMode, chartSettingDefaults.statusTitleMode))

  return (
    <div className="ff-settings-status-panel">
      <section className="ff-settings-status-group">
        <div className="ff-settings-symbol-kicker">商品</div>
        <SettingsCheckRow>Logo</SettingsCheckRow>
        <div className="ff-settings-status-row">
          <input defaultChecked type="checkbox" />
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
        <SettingsCheckRow checked>成交量</SettingsCheckRow>
        <SettingsCheckRow checked storageKey={chartSettingKeys.statusCandleTimeVisible}>K线时间</SettingsCheckRow>
      </section>

      <section className="ff-settings-status-group">
        <div className="ff-settings-symbol-kicker">指标</div>
        <SettingsCheckRow checked>标题</SettingsCheckRow>
        <SettingsCheckRow checked inset>输入</SettingsCheckRow>
        <SettingsCheckRow checked>数值</SettingsCheckRow>
        <div className="ff-settings-status-row">
          <input defaultChecked type="checkbox" />
          <span>背景</span>
          <div className="ff-settings-status-opacity" aria-hidden="true">
            <span />
          </div>
        </div>
      </section>
    </div>
  )
}
