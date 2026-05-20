import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readSettingsBooleanValue, readSettingsNumberStringValue, readSettingsStringValue, readSettingsSymbolState, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from './chartSettingsSchema'
import { settingsPanelTabs } from './settingsPanelTabs'
import { SettingsColorPair, SettingsColorSwatch, SettingsLineSwatch } from './SettingsSwatches'
import './SettingsPanelShell.css'
import './SettingsPanel.css'

export type SettingsPanelTab = 'symbol' | 'status' | 'coordinates' | 'layout' | 'trading' | 'alerts' | 'events'

function SettingsSymbolPanel() {
  const [pricePrecision, setPricePrecision] = useState(() => readSettingsNumberStringValue(chartSettingKeys.pricePrecision, chartSettingDefaults.pricePrecision))
  const [timezone, setTimezone] = useState(() => readSettingsStringValue(chartSettingKeys.timezone, chartSettingDefaults.timezone))
  const colorRows = [
    { label: '主体', rowKey: 'candle.body', up: '#26a69a', down: '#ef5350' },
    { label: '边框', rowKey: 'candle.border', up: '#26a69a', down: '#ef5350' },
    { label: '影线', rowKey: 'candle.wick', up: '#26a69a', down: '#ef5350' },
  ]
  void colorRows

  return (
    <div className="ff-settings-symbol-panel">
      <section className="ff-settings-symbol-group">
        <div className="ff-settings-symbol-kicker">K线图</div>
        <div className="ff-settings-symbol-checkline">
          <input type="checkbox" />
          <span>K线颜色基于前一收盘价</span>
        </div>
        {colorRows.map(({ label, rowKey, up, down }) => (
          <div className="ff-settings-symbol-color-row" key={label}>
            <div className="ff-settings-symbol-check-target">
              <input type="checkbox" defaultChecked />
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
          <OpenableSelect
            ariaLabel="时段"
            defaultValue="electronic"
            options={[
              { label: '电子交易时间', value: 'electronic' },
              { label: 'Regular', value: 'regular' },
            ]}
          />
        </div>
        <div className="ff-settings-symbol-field">
          <span>电子交易时段背景</span>
          <SettingsColorSwatch checkerboard storageKey="session.background" />
        </div>
        <div className="ff-settings-symbol-field">
          <span>精确度</span>
          <OpenableSelect
            ariaLabel="精确度"
            defaultValue="6"
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

function SettingsCheckRow({
  checked = false,
  children,
  inset = false,
  onCheckedChange,
  storageKey,
}: {
  checked?: boolean
  children: ReactNode
  inset?: boolean
  onCheckedChange?: (checked: boolean) => void
  storageKey?: string
}) {
  const [isChecked, setIsChecked] = useState(() => {
    if (!storageKey) return checked
    return readSettingsBooleanValue(storageKey, checked)
  })

  return (
    <div className="ff-settings-status-row" data-inset={inset}>
      <input
        checked={isChecked}
        onChange={(event) => {
          const next = event.currentTarget.checked
          setIsChecked(next)
          if (storageKey) writeSettingsSymbolStateValue(storageKey, next)
          onCheckedChange?.(next)
        }}
        type="checkbox"
      />
      <span>{children}</span>
    </div>
  )
}

function SettingsStatusPanel() {
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
        <SettingsCheckRow>开市状态</SettingsCheckRow>
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

function SettingsMultiCheckSelect({
  ariaLabel,
  defaultValue,
  storageKey,
  options,
}: {
  ariaLabel: string
  defaultValue: string[]
  storageKey?: string
  options: Array<{ label: string; value: string }>
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(() => {
    const saved = storageKey ? readSettingsSymbolState()[storageKey] : null
    return new Set(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === 'string') : defaultValue)
  })

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [open])

  const label = options
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)
    .join('，') || '隐藏'

  return (
    <div className="ff-settings-multicheck-select" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <div className="ff-settings-multicheck-select__menu" role="menu">
          {options.map((option) => {
            const active = selected.has(option.value)
            return (
              <button
                className="ff-settings-multicheck-select__option"
                key={option.value}
                onClick={() => {
                  setSelected((current) => {
                    const next = new Set(current)
                    if (next.has(option.value)) next.delete(option.value)
                    else next.add(option.value)
                    if (storageKey) writeSettingsSymbolStateValue(storageKey, [...next])
                    return next
                  })
                }}
                role="menuitemcheckbox"
                aria-checked={active}
                type="button"
              >
                <span className="ff-settings-multicheck-select__box" data-active={active}>
                  {active ? '✓' : ''}
                </span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SettingsCoordinatesPanel() {
  const [showWeekday, setShowWeekday] = useState(() => readSettingsSymbolState()['coordinates.time.showWeekday'] !== false)
  const [dateFormat, setDateFormat] = useState(() => readSettingsStringValue('coordinates.time.dateFormat', 'ymd'))
  const [hourFormat, setHourFormat] = useState(() => readSettingsStringValue('coordinates.time.hourFormat', '24h'))
  const [highLowTextSize, setHighLowTextSize] = useState(() => readSettingsStringValue('coordinates.highLow.textSize', '12'))
  const weekdayPrefix = showWeekday ? '周一 ' : ''

  return (
    <div className="ff-settings-coordinates-panel">
      <section className="ff-settings-coordinates-group">
        <div className="ff-settings-symbol-kicker">价格坐标</div>

        <div className="ff-settings-coordinate-row">
          <span>货币和单位</span>
          <OpenableSelect
            ariaLabel="货币和单位"
            defaultValue="always"
            options={[
              { label: '总是显示', value: 'always' },
              { label: '隐藏', value: 'hidden' },
            ]}
          />
        </div>

        <div className="ff-settings-coordinate-row">
          <span>坐标模式（A和L）</span>
          <OpenableSelect
            ariaLabel="坐标模式"
            defaultValue="on-move"
            options={[
              { label: '鼠标移动时可见', value: 'on-move' },
              { label: '总是可见', value: 'always' },
              { label: '隐藏', value: 'hidden' },
            ]}
          />
        </div>

        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--lock">
          <input type="checkbox" />
          <span>锁定价格对K线比例</span>
          <input disabled value="32.1366597" readOnly />
        </div>

        <div className="ff-settings-coordinate-row">
          <span>坐标放置</span>
          <OpenableSelect
            ariaLabel="坐标放置"
            defaultValue="auto"
            options={[
              { label: '自动', value: 'auto' },
              { label: '左侧', value: 'left' },
              { label: '右侧', value: 'right' },
            ]}
          />
        </div>
      </section>

      <section className="ff-settings-coordinates-group">
        <div className="ff-settings-symbol-kicker">价格标签和价格线</div>

        <SettingsCheckRow checked>无重叠标签</SettingsCheckRow>
        <div className="ff-settings-coordinate-check-help">
          <input defaultChecked type="checkbox" />
          <span>加号按钮</span>
          <button type="button">?</button>
        </div>
        <SettingsCheckRow checked>当前K线结束倒计时</SettingsCheckRow>

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
          <SettingsLineSwatch inheritCandleColors />
        </div>
        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--nested">
          <span />
          <OpenableSelect
            ariaLabel="商品代码位置"
            defaultValue="axis"
            options={[
              { label: '根据坐标值', value: 'axis' },
              { label: '最后价格', value: 'last' },
            ]}
          />
        </div>

        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--sample">
          <span>前一天收盘</span>
          <OpenableSelect
            ariaLabel="前一天收盘"
            defaultValue="hidden"
            options={[
              { label: '隐藏', value: 'hidden' },
              { label: '显示', value: 'visible' },
            ]}
          />
          <SettingsLineSwatch color="#9b9b9b" storageKey="coordinates.prevClose.color" />
        </div>

        <div className="ff-settings-coordinate-row">
          <span>指标和财务数据</span>
          <OpenableSelect
            ariaLabel="指标和财务数据"
            defaultValue="hidden"
            options={[
              { label: '隐藏', value: 'hidden' },
              { label: '显示', value: 'visible' },
            ]}
          />
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
          <OpenableSelect
            ariaLabel="Bid和Ask"
            defaultValue="hidden"
            options={[
              { label: '隐藏', value: 'hidden' },
              { label: '显示', value: 'visible' },
            ]}
          />
          <SettingsColorPair left="#85c4f2" right="#f6a0a1" />
        </div>
      </section>

      <section className="ff-settings-coordinates-group">
        <div className="ff-settings-symbol-kicker">时间坐标</div>
        <SettingsCheckRow
          checked
          onCheckedChange={setShowWeekday}
          storageKey="coordinates.time.showWeekday"
        >
          标签上的星期几
        </SettingsCheckRow>

        <div className="ff-settings-coordinate-row">
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

        <SettingsCheckRow>改变周期时保存图表左边缘位置</SettingsCheckRow>
      </section>
    </div>
  )
}

function SettingsLayoutPanel() {
  const [gridMode, setGridMode] = useState(() => readSettingsStringValue('layout.grid.mode', 'both'))
  const [axisTextSize, setAxisTextSize] = useState(() => readSettingsStringValue('layout.axisText.size', '12'))

  return (
    <div className="ff-settings-layout-panel">
      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-title">图表基本样式</div>

        <div className="ff-settings-layout-row">
          <span>背景</span>
          <OpenableSelect
            ariaLabel="背景"
            defaultValue="solid"
            options={[
              { label: 'Solid', value: 'solid' },
              { label: '渐变', value: 'gradient' },
            ]}
          />
          <SettingsColorSwatch color="#ffffff" storageKey="layout.background.color" />
        </div>

        <div className="ff-settings-layout-row">
          <span>网格线</span>
          <OpenableSelect
            ariaLabel="网格线"
            defaultValue="both"
            onChange={(value) => {
              setGridMode(value)
              writeSettingsSymbolStateValue('layout.grid.mode', value)
            }}
            options={[
              { label: '垂直和...', value: 'both' },
              { label: '垂直', value: 'vertical' },
              { label: '水平', value: 'horizontal' },
              { label: '隐藏', value: 'hidden' },
            ]}
            value={gridMode}
          />
          <div className="ff-settings-layout-swatches">
            <SettingsColorSwatch color="#eef2f8" storageKey="layout.grid.vertical.color" />
            <SettingsColorSwatch color="#eef2f8" storageKey="layout.grid.horizontal.color" />
          </div>
        </div>

        <div className="ff-settings-layout-row">
          <span>窗格分隔符</span>
          <SettingsColorSwatch color="#b8b8b8" storageKey="layout.paneSeparator.color" />
        </div>

        <div className="ff-settings-layout-row">
          <span>十字线</span>
          <SettingsLineSwatch color="#e91e63" storageKey="layout.crosshair.color" />
        </div>

        <div className="ff-settings-layout-row">
          <span>水印</span>
          <OpenableSelect
            ariaLabel="水印"
            defaultValue="replay"
            options={[
              { label: '回放模式', value: 'replay' },
              { label: '商品代码', value: 'symbol' },
              { label: '隐藏', value: 'hidden' },
            ]}
          />
          <SettingsColorSwatch checkerboard storageKey="layout.watermark.color" />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">坐标</div>
        <div className="ff-settings-layout-row ff-settings-layout-row--text">
          <span>文本</span>
          <SettingsColorSwatch color="#5f6675" storageKey="layout.axisText.color" />
          <OpenableSelect
            ariaLabel="坐标文本大小"
            defaultValue="12"
            onChange={(value) => {
              setAxisTextSize(value)
              writeSettingsSymbolStateValue('layout.axisText.size', value)
            }}
            options={[
              { label: '10', value: '10' },
              { label: '11', value: '11' },
              { label: '12', value: '12' },
              { label: '13', value: '13' },
              { label: '14', value: '14' },
            ]}
            value={axisTextSize}
          />
        </div>
        <div className="ff-settings-layout-row">
          <span>线条</span>
          <SettingsColorSwatch color="#858b98" storageKey="layout.axisLine.color" />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">按钮</div>
        <div className="ff-settings-layout-row">
          <span>导航</span>
          <OpenableSelect
            ariaLabel="导航"
            defaultValue="on-move"
            options={[
              { label: '鼠标移动时可见', value: 'on-move' },
              { label: '总是可见', value: 'always' },
              { label: '隐藏', value: 'hidden' },
            ]}
          />
        </div>
        <div className="ff-settings-layout-row">
          <span>窗格</span>
          <OpenableSelect
            ariaLabel="窗格"
            defaultValue="on-move"
            options={[
              { label: '鼠标移动时可见', value: 'on-move' },
              { label: '总是可见', value: 'always' },
              { label: '隐藏', value: 'hidden' },
            ]}
          />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">利润率</div>
        <div className="ff-settings-layout-row">
          <span>顶部</span>
          <input aria-label="顶部利润率" defaultValue="10" />
          <em>%</em>
        </div>
        <div className="ff-settings-layout-row">
          <span>底部</span>
          <input aria-label="底部利润率" defaultValue="8" />
          <em>%</em>
        </div>
        <div className="ff-settings-layout-row">
          <span>右</span>
          <input aria-label="右侧利润率" defaultValue="10" />
          <em>根K线</em>
        </div>
      </section>
    </div>
  )
}

function SettingsEventsPanel() {
  const [sessionBreakVisible, setSessionBreakVisible] = useState(() => readSettingsBooleanValue(chartSettingKeys.sessionBreakVisible, chartSettingDefaults.sessionBreakVisible))

  return (
    <div className="ff-settings-events-panel">
      <div className="ff-settings-events-kicker">事件</div>

      <div className="ff-settings-events-row">
        <input type="checkbox" />
        <span>观点</span>
        <OpenableSelect
          ariaLabel="观点"
          defaultValue="all"
          options={[
            { label: '所有观点', value: 'all' },
            { label: '只显示我的观点', value: 'mine' },
            { label: '隐藏', value: 'hidden' },
          ]}
        />
        <button aria-label="观点说明" className="ff-settings-events-help" type="button">?</button>
      </div>

      <div className="ff-settings-events-row">
        <input
          checked={sessionBreakVisible}
          onChange={(event) => {
            const next = event.currentTarget.checked
            setSessionBreakVisible(next)
            writeSettingsSymbolStateValue(chartSettingKeys.sessionBreakVisible, next)
          }}
          type="checkbox"
        />
        <span>交易日间隔</span>
        <SettingsLineSwatch color="#93b7f4" storageKey="events.sessionBreak.color" />
      </div>

      <div className="ff-settings-events-row">
        <input type="checkbox" />
        <span>经济事件</span>
      </div>

      <div className="ff-settings-events-row ff-settings-events-row--nested">
        <input type="checkbox" />
        <span>只显示未来事件</span>
      </div>

      <div className="ff-settings-events-row ff-settings-events-row--nested">
        <input defaultChecked type="checkbox" />
        <span>事件线</span>
        <SettingsLineSwatch color="#9b9b9b" storageKey="events.eventLine.color" />
      </div>

      <div className="ff-settings-events-row">
        <input type="checkbox" />
        <span>最新消息</span>
      </div>

      <div className="ff-settings-events-row">
        <input type="checkbox" />
        <span>新闻通知</span>
      </div>
    </div>
  )
}



export function SettingsPanel({
  selectedTab,
  onSelectedTabChange,
}: {
  selectedTab: SettingsPanelTab
  onSelectedTabChange: (tab: SettingsPanelTab) => void
}) {
  return (
    <div className="ff-settings-drawer__body">
      <div className="ff-import-selected-tabs ff-settings-tabs" role="tablist" aria-label="Settings panels">
        {settingsPanelTabs.map((tab) => (
          <button
            aria-selected={selectedTab === tab.key}
            className="ff-import-selected-tabs__item ff-settings-tabs__item"
            data-active={selectedTab === tab.key}
            key={tab.key}
            onClick={() => onSelectedTabChange(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section className="ff-settings-panel" role="tabpanel">
        {selectedTab === 'symbol' && <SettingsSymbolPanel />}
        {selectedTab === 'status' && <SettingsStatusPanel />}
        {selectedTab === 'coordinates' && <SettingsCoordinatesPanel />}
        {selectedTab === 'layout' && <SettingsLayoutPanel />}
        {selectedTab === 'events' && <SettingsEventsPanel />}
        {selectedTab !== 'symbol' && selectedTab !== 'status' && selectedTab !== 'coordinates' && selectedTab !== 'layout' && selectedTab !== 'events' && (
          <div className="ff-settings-empty-panel" />
        )}
      </section>
    </div>
  )
}
