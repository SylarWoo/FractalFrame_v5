import { useState } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readSettingsNumberStringValue, readSettingsStringValue, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from './chartSettingsSchema'
import { SettingsCheckboxInput } from './SettingsSharedControls'
import { SettingsColorSwatch } from './SettingsSwatches'
import './SettingsSymbolPanel.css'

export function SettingsSymbolPanel() {
  const [pricePrecision, setPricePrecision] = useState(() => readSettingsNumberStringValue(chartSettingKeys.pricePrecision, chartSettingDefaults.pricePrecision))
  const [timezone, setTimezone] = useState(() => readSettingsStringValue(chartSettingKeys.timezone, chartSettingDefaults.timezone))
  const colorRows = [
    { label: '主体', rowKey: 'candle.body', up: '#26a69a', down: '#ef5350' },
    { label: '边框', rowKey: 'candle.border', up: '#26a69a', down: '#ef5350' },
    { label: '影线', rowKey: 'candle.wick', up: '#26a69a', down: '#ef5350' },
  ]

  return (
    <div className="ff-settings-symbol-panel">
      <section className="ff-settings-symbol-group">
        <div className="ff-settings-symbol-kicker">K线图</div>
        <div className="ff-settings-symbol-checkline">
          <SettingsCheckboxInput storageKey="candle.colorBasedOnPreviousClose" />
          <span>K线颜色基于前一收盘价</span>
        </div>
        {colorRows.map(({ label, rowKey, up, down }) => (
          <div className="ff-settings-symbol-color-row" key={label}>
            <div className="ff-settings-symbol-check-target">
              <SettingsCheckboxInput checked storageKey={`${rowKey}.visible`} />
              <span>{label}</span>
            </div>
            <div className="ff-settings-symbol-swatches">
              <SettingsColorSwatch color={up} storageKey={`${rowKey}.up`} />
              <SettingsColorSwatch color={down} storageKey={`${rowKey}.down`} />
            </div>
          </div>
        ))}
      </section>

      <section className="ff-settings-symbol-group ff-settings-symbol-group--data">
        <div className="ff-settings-symbol-kicker">数据修改</div>
        <div className="ff-settings-symbol-field">
          <span>时段</span>
          <OpenableSelect ariaLabel="时段" defaultValue="electronic" storageKey="session.type" options={[
            { label: '电子交易时间', value: 'electronic' },
            { label: 'Regular', value: 'regular' },
          ]} />
        </div>
        <div className="ff-settings-symbol-field">
          <span>电子交易时段背景</span>
          <SettingsColorSwatch checkerboard storageKey="session.background" />
        </div>
        <div className="ff-settings-symbol-field">
          <span>精度</span>
          <OpenableSelect
            ariaLabel="精度"
            defaultValue={chartSettingDefaults.pricePrecision}
            onChange={(value) => {
              setPricePrecision(value)
              writeSettingsSymbolStateValue(chartSettingKeys.pricePrecision, value)
            }}
            options={[
              { label: '系统预设', value: 'system' },
              { label: '整数', value: '0' },
              { label: '1小数', value: '1' },
              { label: '2小数', value: '2' },
              { label: '3小数', value: '3' },
              { label: '4小数', value: '4' },
              { label: '5小数', value: '5' },
              { label: '6小数', value: '6' },
              { label: '7小数', value: '7' },
            ]}
            value={pricePrecision}
          />
        </div>
        <div className="ff-settings-symbol-field">
          <span>时区</span>
          <OpenableSelect
            ariaLabel="时区"
            defaultValue="UTC"
            onChange={(value) => {
              setTimezone(value)
              writeSettingsSymbolStateValue(chartSettingKeys.timezone, value)
            }}
            options={[
              { label: '(UTC+0) UTC', value: 'UTC' },
              { label: '(UTC+8) 上海', value: 'Asia/Shanghai' },
              { label: '(UTC-5) 纽约', value: 'America/New_York' },
              { label: '(UTC+0) 伦敦', value: 'Europe/London' },
              { label: '(UTC+9) 东京', value: 'Asia/Tokyo' },
              { label: 'Exchange', value: 'exchange' },
            ]}
            value={timezone}
          />
        </div>
      </section>
    </div>
  )
}
