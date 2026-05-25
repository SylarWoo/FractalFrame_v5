import { useState } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readSettingsStringValue, readSettingsSymbolState, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import { chartSettingKeys } from './chartSettingsSchema'
import { SettingsColorPair, SettingsLineSwatch } from './SettingsSwatches'
import { SettingsCheckboxInput, SettingsCheckRow, SettingsMultiCheckSelect } from './SettingsSharedControls'
import './SettingsCoordinatesPanel.css'

export function SettingsCoordinatesPanel() {
  const [showWeekday, setShowWeekday] = useState(() => readSettingsSymbolState()['coordinates.time.showWeekday'] !== false)
  const [dateFormat, setDateFormat] = useState(() => readSettingsStringValue('coordinates.time.dateFormat', 'ymd'))
  const [hourFormat, setHourFormat] = useState(() => readSettingsStringValue('coordinates.time.hourFormat', '24h'))
  const [highLowTextSize, setHighLowTextSize] = useState(() => readSettingsStringValue('coordinates.highLow.textSize', '12'))
  const weekdayPrefix = showWeekday ? '周一 ' : ''

  return (
    <div className="ff-settings-coordinates-panel">
      <section className="ff-settings-coordinates-group">
        <div className="ff-settings-symbol-kicker">价格坐标</div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--price-control">
          <span>货币和单位</span>
          <OpenableSelect ariaLabel="货币和单位" defaultValue="always" storageKey="coordinates.currencyUnit.mode" options={[
            { label: '总是显示', value: 'always' },
            { label: '隐藏', value: 'hidden' },
          ]} />
        </div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--wide-select">
          <span>坐标模式（A和L）</span>
          <OpenableSelect ariaLabel="坐标模式" defaultValue="on-move" storageKey="coordinates.axisMode" options={[
            { label: '鼠标移动时可见', value: 'on-move' },
            { label: '总是可见', value: 'always' },
            { label: '隐藏', value: 'hidden' },
          ]} />
        </div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--lock ff-settings-coordinate-row--price-control">
          <SettingsCheckboxInput storageKey="coordinates.priceToBarRatio.locked" />
          <span>锁定价格对K线比例</span>
          <input disabled value="32.1366597" readOnly />
        </div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--price-control">
          <span>坐标放置</span>
          <OpenableSelect ariaLabel="坐标放置" defaultValue="auto" storageKey="coordinates.placement" options={[
            { label: '自动', value: 'auto' },
            { label: '左侧', value: 'left' },
            { label: '右侧', value: 'right' },
          ]} />
        </div>
      </section>

      <section className="ff-settings-coordinates-group">
        <div className="ff-settings-symbol-kicker">价格标签和价格线</div>
        <SettingsCheckRow checked storageKey="coordinates.labels.noOverlap">无重叠标签</SettingsCheckRow>
        <div className="ff-settings-coordinate-check-help">
          <SettingsCheckboxInput checked storageKey="coordinates.labels.plusButton.visible" />
          <span>加号按钮</span>
          <button type="button">?</button>
        </div>
        <SettingsCheckRow checked storageKey={chartSettingKeys.currentCandleCountdownVisible}>当前K线结束倒计时</SettingsCheckRow>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--sample">
          <span>商品代码</span>
          <SettingsMultiCheckSelect
            ariaLabel="商品代码标签"
            defaultValue={['value', 'line']}
            storageKey="coordinates.symbolLabel.visibleParts"
            options={[
              { label: '值', value: 'value' },
              { label: '线形图', value: 'line' },
            ]}
          />
          <SettingsLineSwatch color="#26a69a" storageKey="coordinates.symbolLabel.line" />
        </div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--nested">
          <span />
          <OpenableSelect ariaLabel="商品代码位置" defaultValue="axis" storageKey="coordinates.symbolLabel.position" options={[
            { label: '根据坐标值', value: 'axis' },
            { label: '最后价格', value: 'last' },
          ]} />
        </div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--sample">
          <span>前一天收盘</span>
          <OpenableSelect ariaLabel="前一天收盘" defaultValue="hidden" storageKey="coordinates.prevClose.mode" options={[
            { label: '隐藏', value: 'hidden' },
            { label: '显示', value: 'visible' },
          ]} />
          <SettingsLineSwatch color="#9b9b9b" storageKey="coordinates.prevClose.color" />
        </div>
        <div className="ff-settings-coordinate-row">
          <span>指标和财务数据</span>
          <OpenableSelect ariaLabel="指标和财务数据" defaultValue="hidden" storageKey="coordinates.indicatorFinancial.mode" options={[
            { label: '隐藏', value: 'hidden' },
            { label: '显示', value: 'visible' },
          ]} />
        </div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--high-low">
          <span>高点和低点</span>
          <SettingsMultiCheckSelect
            ariaLabel="高点和低点"
            defaultValue={[]}
            storageKey="coordinates.highLow.visibleParts"
            options={[
              { label: '高点', value: 'high' },
              { label: '低点', value: 'low' },
            ]}
          />
          <OpenableSelect
            ariaLabel="高点和低点字号"
            defaultValue="12"
            onChange={(value) => {
              setHighLowTextSize(value)
              writeSettingsSymbolStateValue('coordinates.highLow.textSize', value)
            }}
            options={[
              { label: '10', value: '10' },
              { label: '11', value: '11' },
              { label: '12', value: '12' },
              { label: '13', value: '13' },
              { label: '14', value: '14' },
              { label: '15', value: '15' },
              { label: '16', value: '16' },
            ]}
            value={highLowTextSize}
          />
        </div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--sample">
          <span>Bid和Ask</span>
          <OpenableSelect ariaLabel="Bid和Ask" defaultValue="hidden" storageKey="coordinates.bidAsk.mode" options={[
            { label: '隐藏', value: 'hidden' },
            { label: '显示', value: 'visible' },
          ]} />
          <SettingsColorPair left="#85c4f2" right="#f6a0a1" />
        </div>
      </section>

      <section className="ff-settings-coordinates-group">
        <div className="ff-settings-symbol-kicker">时间坐标</div>
        <SettingsCheckRow checked onCheckedChange={setShowWeekday} storageKey="coordinates.time.showWeekday">
          标签上的星期几
        </SettingsCheckRow>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--wide-select">
          <span>日期格式</span>
          <OpenableSelect
            ariaLabel="日期格式"
            defaultValue="ymd"
            onChange={(value) => {
              setDateFormat(value)
              writeSettingsSymbolStateValue('coordinates.time.dateFormat', value)
            }}
            options={[
              { label: `${weekdayPrefix}1997/09/29`, value: 'ymd' },
              { label: `${weekdayPrefix}29/09/1997`, value: 'dmy' },
              { label: `${weekdayPrefix}09/29/1997`, value: 'mdy' },
            ]}
            value={dateFormat}
          />
        </div>
        <div className="ff-settings-coordinate-row">
          <span>时间小时格式</span>
          <OpenableSelect
            ariaLabel="时间小时格式"
            defaultValue="24h"
            onChange={(value) => {
              setHourFormat(value)
              writeSettingsSymbolStateValue('coordinates.time.hourFormat', value)
            }}
            options={[
              { label: '24小时', value: '24h' },
              { label: '12小时', value: '12h' },
            ]}
            value={hourFormat}
          />
        </div>
        <SettingsCheckRow storageKey={chartSettingKeys.rightPlaceholderVisible}>右侧占位符</SettingsCheckRow>
      </section>
    </div>
  )
}
