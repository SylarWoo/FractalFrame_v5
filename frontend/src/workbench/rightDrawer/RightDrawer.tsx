import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import './RightDrawer.css'
import type { ChartLoadState } from '../chart/ChartCoreHost'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readSettingsStringValue, readSettingsSymbolState, settingsSymbolChangedEvent, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import { resolveMt5SymbolDisplay } from './mt5SymbolDisplay'
import { openChartColorPalettePopoverV1 } from './color_palette/chartColorPalettePopoverV1.js'
import {
  cancelMt5M1CheckJob,
  cancelStoreV5PullJob,
  cleanStoreV5DirectM1,
  createMt5TicksEventSource,
  createStoreV5AggregateEventSource,
  createStoreV5PullEventSource,
  deleteStoreV5AggregatedTimeframes,
  deleteStoreV5Symbol,
  fetchMt5M1CheckJob,
  fetchMt5Symbols,
  fetchStoreV5AggregateJob,
  fetchStoreV5PullJob,
  fetchStoreV5Check,
  fetchStoreV5Status,
  repairStoreV5M1Gaps,
  startStoreV5AggregateJob,
  startStoreV5PullJob,
  startMt5M1CheckJob,
} from './mt5SymbolsApi'
import type { Mt5M1CheckJobPayload, Mt5RealtimeTick, Mt5SymbolRow, StoreV5AggregateJobPayload, StoreV5CheckPayload, StoreV5PullJobPayload } from './mt5SymbolsApi'

type RightDrawerProps = {
  activeDrawer: 'mt5' | 'settings' | null
  chartLoadState?: ChartLoadState | null
  drawerWidth: number
  onClose: () => void
  onJumpChartToTime?: (timestamp: number) => void
  onLoadChartStep?: (direction: 'left' | 'right') => void
  onResize: (width: number) => void
  onResetChartToLatest?: () => void
  onToggleDrawer: (drawer: 'mt5' | 'settings') => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number }) => void
}

const minDrawerWidth = 220
const maxDrawerWidth = 900
const splitHeightStorageKey = 'fractalframe:mt5ImportCenterTopPaneHeightPx:v1'
const watchlistTableHeightStorageKey = 'fractalframe:mt5ImportCenterWatchlistTableHeightPx:v1'
const watchlistSymbolsStorageKey = 'fractalframe:mt5ImportCenterWatchlistSymbols:v1'
const shortcutMenuEnabledStorageKey = 'fractalframe:mt5ImportCenterShortcutMenuEnabled:v1'
const shortcutMenuPeriodsStorageKey = 'fractalframe:mt5ImportCenterShortcutMenuPeriods:v1'
const sharedSelectionStorageKey = 'fractalframe:mt5ImportCenterSharedSelection:v1'
const shortcutMenuChangedEvent = 'fractalframe:mt5ImportCenterShortcutMenuChanged'
const watchlistChangedEvent = 'fractalframe:mt5ImportCenterWatchlistChanged'
const storeV5StatusChangedEvent = 'fractalframe:mt5ImportCenterStoreV5StatusChanged'
const sharedSelectionChangedEvent = 'fractalframe:mt5ImportCenterSharedSelectionChanged'
const columnWidthsStorageKey = 'fractalframe:mt5ImportCenterColumnWidthsPx:v1'
const symbolSnapshotStorageKey = 'fractalframe:mt5ImportCenterSymbolSnapshot:v1'
const mt5M1CheckResultsStorageKey = 'fractalframe:mt5ImportCenterM1CheckResults:v1'
const storeV5StatusStorageKey = 'fractalframe:mt5ImportCenterStoreV5Status:v1'
const storeV5ListSymbolsStorageKey = 'fractalframe:mt5ImportCenterStoreV5ListSymbols:v1'
const storePanelPersistenceEnabledStorageKey = 'fractalframe:mt5ImportCenterStorePanelPersistenceEnabled:v1'
const watchlistRealtimeEnabledStorageKey = 'fractalframe:mt5ImportCenterWatchlistRealtimeEnabled:v1'
const watchlistRealtimeSnapshotStorageKey = 'fractalframe:mt5ImportCenterWatchlistRealtimeSnapshot:v1'
const storePanelSelectedTableKeyStorageKey = 'fractalframe:mt5ImportCenterStorePanelSelectedTableKey:v1'
const importCenterQueryStorageKey = 'fractalframe:mt5ImportCenterQuery:v1'
const importCenterSelectedTabStorageKey = 'fractalframe:mt5ImportCenterSelectedTab:v1'
const storePanelPersistenceKeys = [
  mt5M1CheckResultsStorageKey,
  storeV5StatusStorageKey,
  storeV5ListSymbolsStorageKey,
  storePanelSelectedTableKeyStorageKey,
]
const storeTableAggregatePeriods = ['M5', 'M15', 'M30', 'H1', 'H2', 'H3', 'H4', 'D1', 'W1', 'MN1']
const storeV5M1RepairLookbackMinutes = 720
const storeV5M1RepairMaxGapMinutes = 720

const defaultColumnWidths = {
  symbol: 96,
  name: 126,
  type: 64,
}

type ColumnKey = keyof typeof defaultColumnWidths
type SelectedPanelTab = 'details' | 'store' | 'watchlist' | 'settings'
type SettingsPanelTab = 'symbol' | 'status' | 'coordinates' | 'layout' | 'trading' | 'alerts' | 'events'
type DetailRow =
  | readonly [string, string | number | boolean | null | undefined, string, string | number | boolean | null | undefined]
  | readonly [string, string | number | boolean | null | undefined]

type SymbolSnapshot = {
  selectedSymbol: string
  status: string
  symbols: Mt5SymbolRow[]
  savedAt: string
}

type PersistedM1CheckResult = {
  checkedAt: string
  payload: StoreV5CheckPayload
}

type PersistedStoreV5Status = {
  checkedAt: string
  payload: StoreV5CheckPayload
}

type PersistedStoreTableSelection = {
  key: string
  symbol: string
}

type StoreTableRow = {
  period: string
  count: string
  updated: string
  kind: 'm1' | 'aggregate'
  rowsCount?: number | null
}

type SharedSelection = {
  symbol: string
  period: string
}

type PersistedRealtimeSnapshot = {
  lastTickAt?: string
  log?: string[]
  ticks?: Record<string, Mt5RealtimeTick>
}

function resolveStoreV5AggregateTargets(status: StoreV5CheckPayload) {
  return status.aggregated
    .map((cell) => String(cell.timeframe || '').toUpperCase())
    .filter((period) => storeTableAggregatePeriods.includes(period))
}

const selectedPanelTabs: Array<{ key: SelectedPanelTab; label: string }> = [
  { key: 'details', label: '细节' },
  { key: 'store', label: '仓库' },
  { key: 'watchlist', label: '自选列表' },
  { key: 'settings', label: '设置' },
]
const settingsPanelTabs: Array<{ key: SettingsPanelTab; label: string }> = [
  { key: 'symbol', label: '商品代码' },
  { key: 'status', label: '状态行' },
  { key: 'coordinates', label: '坐标和线条' },
  { key: 'layout', label: '版面' },
  { key: 'trading', label: '交易' },
  { key: 'alerts', label: '警报' },
  { key: 'events', label: '事件' },
]

function resolveHexRgbString(hex: string) {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return '38, 166, 154'
  const value = Number.parseInt(normalized, 16)
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`
}

type SettingsSwatchValue = {
  hex: string
  opacity: number
}

type SettingsLineSwatchValue = SettingsSwatchValue & {
  thickness: number
}

let activeSettingsColorPopoverClose: (() => void) | null = null

function readSettingsSwatchValue(storageKey: string | undefined, fallbackHex: string): SettingsSwatchValue {
  if (!storageKey) return { hex: fallbackHex, opacity: 1 }
  const saved = readSettingsSymbolState()[storageKey]
  if (saved && typeof saved === 'object' && 'hex' in saved) {
    const swatch = saved as Partial<SettingsSwatchValue>
    const hex = typeof swatch.hex === 'string' ? swatch.hex : fallbackHex
    const opacity = typeof swatch.opacity === 'number' && Number.isFinite(swatch.opacity) ? swatch.opacity : 1
    return { hex, opacity }
  }
  return { hex: fallbackHex, opacity: 1 }
}

function readSettingsLineSwatchValue(storageKey: string | undefined, fallbackHex: string): SettingsLineSwatchValue {
  const saved = storageKey ? readSettingsSymbolState()[storageKey] : null
  const base = readSettingsSwatchValue(storageKey, fallbackHex)
  const thickness = saved && typeof saved === 'object' && 'thickness' in saved
    ? Number((saved as Partial<SettingsLineSwatchValue>).thickness)
    : 1
  return {
    ...base,
    opacity: 1,
    thickness: Number.isFinite(thickness) ? Math.max(1, Math.min(Math.round(thickness), 4)) : 1,
  }
}

function readCandleBodyPreviewColors() {
  const state = readSettingsSymbolState()
  return {
    up: resolveSwatchColorForSettings(state['candle.body.up'], '#26a69a'),
    down: resolveSwatchColorForSettings(state['candle.body.down'], '#ef5350'),
  }
}

function resolveSwatchColorForSettings(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object' || !('hex' in value)) return fallback
  const swatch = value as Partial<SettingsSwatchValue>
  return typeof swatch.hex === 'string' ? swatch.hex : fallback
}

function SettingsColorSwatch({
  color,
  checkerboard = false,
  storageKey,
}: {
  color?: string
  checkerboard?: boolean
  storageKey?: string
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [value, setValue] = useState(() => readSettingsSwatchValue(storageKey, color ?? '#26a69a'))
  const isTransparent = !checkerboard && value.opacity < 0.999

  return (
    <button
      aria-label="Color"
      className="ff-settings-color-swatch ff-openable-control"
      data-checkerboard={checkerboard}
      data-transparent={isTransparent}
      onClick={(event) => {
        event.stopPropagation()
        const anchorEl = buttonRef.current
        if (!anchorEl) return
        if (anchorEl.getAttribute('data-open') === 'true') {
          activeSettingsColorPopoverClose?.()
          activeSettingsColorPopoverClose = null
          return
        }
        const popover = openChartColorPalettePopoverV1({
          doc: document,
          anchorEl,
          initialHex: value.hex,
          initialOpacity: value.opacity,
          showCustomColorsRow: true,
          showCustomPicker: true,
          showOpacity: true,
          onPick: (payload) => {
            if (typeof payload?.hex === 'string') {
              const nextValue = {
                hex: payload.hex,
                opacity: typeof payload.opacity === 'number' && Number.isFinite(payload.opacity) ? payload.opacity : 1,
              }
              setValue(nextValue)
              if (storageKey) writeSettingsSymbolStateValue(storageKey, nextValue)
            }
          },
        })
        activeSettingsColorPopoverClose = popover.close
      }}
      ref={buttonRef}
      style={
        checkerboard
          ? undefined
          : ({
              '--ff-settings-swatch-color': value.hex,
              '--ff-settings-swatch-rgb': resolveHexRgbString(value.hex),
              '--ff-settings-swatch-opacity': String(value.opacity),
            } as CSSProperties)
      }
      type="button"
    >
      <span className="ff-settings-color-swatch__inner" />
    </button>
  )
}

function SettingsSymbolPanel() {
  const [pricePrecision, setPricePrecision] = useState(() => readSettingsStringValue('price.precision', '6'))
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
              writeSettingsSymbolStateValue('price.precision', value)
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
            defaultValue="shanghai"
            options={[
              { label: '(UTC+8) 上海', value: 'shanghai' },
              { label: 'Exchange', value: 'exchange' },
            ]}
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
  storageKey,
}: {
  checked?: boolean
  children: React.ReactNode
  inset?: boolean
  storageKey?: string
}) {
  const [isChecked, setIsChecked] = useState(() => {
    if (!storageKey) return checked
    const saved = readSettingsSymbolState()[storageKey]
    return typeof saved === 'boolean' ? saved : checked
  })

  return (
    <div className="ff-settings-status-row" data-inset={inset}>
      <input
        checked={isChecked}
        onChange={(event) => {
          const next = event.currentTarget.checked
          setIsChecked(next)
          if (storageKey) writeSettingsSymbolStateValue(storageKey, next)
        }}
        type="checkbox"
      />
      <span>{children}</span>
    </div>
  )
}

function SettingsStatusPanel() {
  const [titleMode, setTitleMode] = useState(() => readSettingsStringValue('status.title.mode', 'symbol-name'))

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
              writeSettingsSymbolStateValue('status.title.mode', value)
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
        <SettingsCheckRow checked storageKey="status.chartValues.visible">图表值</SettingsCheckRow>
        <SettingsCheckRow checked storageKey="status.candleChange.visible">K线变化值</SettingsCheckRow>
        <SettingsCheckRow checked>成交量</SettingsCheckRow>
        <SettingsCheckRow>最后一天变化值</SettingsCheckRow>
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

function SettingsLineSwatch({
  color = '#9ca3af',
  inheritCandleColors = false,
  secondary,
  storageKey,
}: {
  color?: string
  inheritCandleColors?: boolean
  secondary?: string
  storageKey?: string
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [value, setValue] = useState(() => readSettingsLineSwatchValue(storageKey, color))
  const [inheritedColors, setInheritedColors] = useState(readCandleBodyPreviewColors)
  const swatchColor = value.hex
  const autoUpColor = inheritCandleColors ? inheritedColors.up : color
  const autoDownColor = inheritCandleColors ? inheritedColors.down : secondary
  const isAuto = (inheritCandleColors || secondary) && !storageKey

  useEffect(() => {
    if (!inheritCandleColors) return
    const sync = () => setInheritedColors(readCandleBodyPreviewColors())
    window.addEventListener(settingsSymbolChangedEvent, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, sync)
      window.removeEventListener('storage', sync)
    }
  }, [inheritCandleColors])

  return (
    <button
      aria-label="Line color"
      className="ff-settings-line-swatch ff-openable-control"
      onClick={(event) => {
        event.stopPropagation()
        const anchorEl = buttonRef.current
        if (!anchorEl) return
        if (anchorEl.getAttribute('data-open') === 'true') {
          activeSettingsColorPopoverClose?.()
          activeSettingsColorPopoverClose = null
          return
        }
        const popover = openChartColorPalettePopoverV1({
            doc: document,
            anchorEl,
            initialHex: swatchColor,
            initialOpacity: 1,
            initialThickness: value.thickness,
            showCustomColorsRow: true,
            showCustomPicker: true,
            showOpacity: false,
            showThickness: true,
            thicknessSteps: 4,
            onPick: (payload) => {
              if (typeof payload?.hex !== 'string') return
              const nextValue = {
                hex: payload.hex,
                opacity: 1,
                thickness: typeof payload.thickness === 'number' && Number.isFinite(payload.thickness)
                  ? Math.max(1, Math.min(Math.round(payload.thickness), 4))
                  : value.thickness,
              }
              setValue(nextValue)
              if (storageKey) writeSettingsSymbolStateValue(storageKey, nextValue)
          },
        })
        activeSettingsColorPopoverClose = popover.close
      }}
      ref={buttonRef}
      type="button"
    >
      <span
        className="ff-settings-line-swatch__chip"
        style={
          isAuto
            ? { background: `linear-gradient(45deg, ${autoUpColor} 0 50%, ${autoDownColor ?? autoUpColor} 50% 100%)` }
            : { background: swatchColor }
        }
      />
      <span className="ff-settings-line-swatch__line" style={{ height: `${value.thickness}px` }} />
    </button>
  )
}

function SettingsColorPair({ left, right }: { left: string; right: string }) {
  return (
    <div className="ff-settings-color-pair">
      <SettingsColorSwatch color={left} storageKey="coordinates.bid.color" />
      <SettingsColorSwatch color={right} storageKey="coordinates.ask.color" />
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

        <div className="ff-settings-coordinate-row ff-settings-coordinate-row--sample">
          <span>高点和低点</span>
          <OpenableSelect
            ariaLabel="高点和低点"
            defaultValue="hidden"
            options={[
              { label: '隐藏', value: 'hidden' },
              { label: '显示', value: 'visible' },
            ]}
          />
          <SettingsLineSwatch color="#7fd3c7" storageKey="coordinates.highLow.color" />
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
        <SettingsCheckRow checked>标签上的星期几</SettingsCheckRow>

        <div className="ff-settings-coordinate-row">
          <span>日期格式</span>
          <OpenableSelect
            ariaLabel="日期格式"
            defaultValue="weekday-date"
            options={[
              { label: '周一 1997/09/29', value: 'weekday-date' },
              { label: '1997/09/29', value: 'date' },
              { label: '29/09/1997', value: 'day-date' },
            ]}
          />
        </div>

        <div className="ff-settings-coordinate-row">
          <span>时间小时格式</span>
          <OpenableSelect
            ariaLabel="时间小时格式"
            defaultValue="24h"
            options={[
              { label: '24小时', value: '24h' },
              { label: '12小时', value: '12h' },
            ]}
          />
        </div>

        <SettingsCheckRow>改变周期时保存图表左边缘位置</SettingsCheckRow>
      </section>
    </div>
  )
}

function clampDrawerWidth(width: number) {
  return Math.max(minDrawerWidth, Math.min(maxDrawerWidth, Math.round(width)))
}

function getInitialTopPaneHeight() {
  const fallbackHeight = 430

  try {
    const raw = window.localStorage.getItem(splitHeightStorageKey)
    const value = raw == null ? fallbackHeight : Number(raw)
    return Math.max(180, Math.min(760, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

function getInitialWatchlistTableHeight() {
  const fallbackHeight = 228

  try {
    const raw = window.localStorage.getItem(watchlistTableHeightStorageKey)
    const value = raw == null ? fallbackHeight : Number(raw)
    return Math.max(96, Math.min(1200, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

function getInitialColumnWidths() {
  try {
    const raw = window.localStorage.getItem(columnWidthsStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return defaultColumnWidths
    return {
      symbol: clampColumnWidth(Number(parsed.symbol), 'symbol'),
      name: clampColumnWidth(Number(parsed.name), 'name'),
      type: clampColumnWidth(Number(parsed.type), 'type'),
    }
  } catch {
    return defaultColumnWidths
  }
}

function getInitialSymbolSnapshot(): SymbolSnapshot | null {
  try {
    const raw = window.localStorage.getItem(symbolSnapshotStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.symbols)) return null

    return {
      selectedSymbol: typeof parsed.selectedSymbol === 'string' ? parsed.selectedSymbol : '',
      status: typeof parsed.status === 'string' ? parsed.status : '',
      symbols: parsed.symbols,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    }
  } catch {
    return null
  }
}

function saveSymbolSnapshot(snapshot: Omit<SymbolSnapshot, 'savedAt'>) {
  try {
    window.localStorage.setItem(
      symbolSnapshotStorageKey,
      JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }),
    )
  } catch {
    // Symbol persistence is best-effort only.
  }
}

function readStorePanelPersistenceEnabled() {
  try {
    const raw = window.localStorage.getItem(storePanelPersistenceEnabledStorageKey)
    return raw == null ? true : raw === '1'
  } catch {
    return true
  }
}

function readWatchlistRealtimeEnabled() {
  try {
    return window.localStorage.getItem(watchlistRealtimeEnabledStorageKey) === '1'
  } catch {
    return false
  }
}

function saveWatchlistRealtimeEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(watchlistRealtimeEnabledStorageKey, enabled ? '1' : '0')
  } catch {
    // Watchlist realtime persistence is best-effort only.
  }
}

function readImportCenterQuery() {
  try {
    return window.localStorage.getItem(importCenterQueryStorageKey) ?? ''
  } catch {
    return ''
  }
}

function saveImportCenterQuery(value: string) {
  try {
    window.localStorage.setItem(importCenterQueryStorageKey, value)
  } catch {
    // Query persistence is best-effort only.
  }
}

function readImportCenterSelectedTab(): SelectedPanelTab {
  try {
    const value = window.localStorage.getItem(importCenterSelectedTabStorageKey)
    return selectedPanelTabs.some((tab) => tab.key === value) ? value as SelectedPanelTab : 'details'
  } catch {
    return 'details'
  }
}

function saveImportCenterSelectedTab(value: SelectedPanelTab) {
  try {
    window.localStorage.setItem(importCenterSelectedTabStorageKey, value)
  } catch {
    // Tab persistence is best-effort only.
  }
}

function readPersistedRealtimeSnapshot(): PersistedRealtimeSnapshot {
  try {
    const raw = window.localStorage.getItem(watchlistRealtimeSnapshotStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      lastTickAt: typeof parsed?.lastTickAt === 'string' ? parsed.lastTickAt : '',
      log: Array.isArray(parsed?.log) ? parsed.log.filter((item: unknown): item is string => typeof item === 'string').slice(0, 8) : [],
      ticks: parsed?.ticks && typeof parsed.ticks === 'object' ? parsed.ticks as Record<string, Mt5RealtimeTick> : {},
    }
  } catch {
    return { lastTickAt: '', log: [], ticks: {} }
  }
}

function savePersistedRealtimeSnapshot(snapshot: PersistedRealtimeSnapshot) {
  try {
    window.localStorage.setItem(watchlistRealtimeSnapshotStorageKey, JSON.stringify({
      lastTickAt: snapshot.lastTickAt ?? '',
      log: (snapshot.log ?? []).slice(0, 8),
      ticks: snapshot.ticks ?? {},
    }))
  } catch {
    // Realtime snapshot persistence is best-effort only.
  }
}

function saveStorePanelPersistenceEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(storePanelPersistenceEnabledStorageKey, enabled ? '1' : '0')
  } catch {
    // Store panel persistence flag is best-effort only.
  }
}

function clearStorePanelPersistence() {
  try {
    storePanelPersistenceKeys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Store panel persistence cleanup is best-effort only.
  }
}

function readPersistedM1CheckResult(symbol: string, enabled = true): PersistedM1CheckResult | null {
  if (!enabled) return null
  if (!symbol) return null
  try {
    const raw = window.localStorage.getItem(mt5M1CheckResultsStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    const item = parsed?.[symbol]
    if (!item || typeof item !== 'object' || !item.payload) return null
    if (typeof item.checkedAt !== 'string') return null
    return item as PersistedM1CheckResult
  } catch {
    return null
  }
}

function savePersistedM1CheckResult(symbol: string, payload: StoreV5CheckPayload, checkedAt: string, enabled = true) {
  if (!enabled) return
  if (!symbol) return
  try {
    const raw = window.localStorage.getItem(mt5M1CheckResultsStorageKey)
    const parsed = raw ? JSON.parse(raw) : {}
    window.localStorage.setItem(
      mt5M1CheckResultsStorageKey,
      JSON.stringify({
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        [symbol]: { checkedAt, payload },
      }),
    )
  } catch {
    // Check result persistence is best-effort only.
  }
}

function readPersistedStoreV5Status(symbol: string, enabled = true): PersistedStoreV5Status | null {
  if (!enabled) return null
  if (!symbol) return null
  try {
    const raw = window.localStorage.getItem(storeV5StatusStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    const item = parsed?.[symbol]
    if (!item || typeof item !== 'object' || !item.payload) return null
    if (typeof item.checkedAt !== 'string') return null
    return item as PersistedStoreV5Status
  } catch {
    return null
  }
}

function savePersistedStoreV5Status(symbol: string, payload: StoreV5CheckPayload, checkedAt = new Date().toISOString(), enabled = true) {
  if (!enabled) return
  if (!symbol) return
  try {
    const raw = window.localStorage.getItem(storeV5StatusStorageKey)
    const parsed = raw ? JSON.parse(raw) : {}
    window.localStorage.setItem(
      storeV5StatusStorageKey,
      JSON.stringify({
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        [symbol]: { checkedAt, payload },
      }),
    )
    window.dispatchEvent(new Event(storeV5StatusChangedEvent))
  } catch {
    // Store status persistence is best-effort only.
  }
}

function readStoreV5ListSymbols(enabled = true): string[] {
  if (!enabled) return []
  try {
    const raw = window.localStorage.getItem(storeV5ListSymbolsStorageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveStoreV5ListSymbols(symbols: string[], enabled = true) {
  if (!enabled) return
  try {
    window.localStorage.setItem(storeV5ListSymbolsStorageKey, JSON.stringify([...new Set(symbols)]))
  } catch {
    // Store list persistence is best-effort only.
  }
}

function readWatchlistSymbols(): string[] {
  try {
    const raw = window.localStorage.getItem(watchlistSymbolsStorageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveWatchlistSymbols(symbols: string[]) {
  try {
    window.localStorage.setItem(watchlistSymbolsStorageKey, JSON.stringify([...new Set(symbols)]))
    window.dispatchEvent(new Event(watchlistChangedEvent))
  } catch {
    // Watchlist persistence is best-effort only.
  }
}

function readShortcutMenuEnabled() {
  try {
    return window.localStorage.getItem(shortcutMenuEnabledStorageKey) === '1'
  } catch {
    return false
  }
}

function saveShortcutMenuEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(shortcutMenuEnabledStorageKey, enabled ? '1' : '0')
    window.dispatchEvent(new Event(shortcutMenuChangedEvent))
  } catch {
    // Shortcut menu persistence is best-effort only.
  }
}

function saveShortcutMenuPeriods(periods: StoreTableRow[]) {
  try {
    window.localStorage.setItem(
      shortcutMenuPeriodsStorageKey,
      JSON.stringify(periods.map((row) => ({
        period: row.period,
        rowsCount: row.rowsCount ?? null,
      }))),
    )
    window.dispatchEvent(new Event(shortcutMenuChangedEvent))
  } catch {
    // Shortcut period persistence is best-effort only.
  }
}

function readSharedSelection(): SharedSelection {
  try {
    const raw = window.localStorage.getItem(sharedSelectionStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      symbol: typeof parsed?.symbol === 'string' ? parsed.symbol : '',
      period: typeof parsed?.period === 'string' ? parsed.period.toUpperCase() : '',
    }
  } catch {
    return { symbol: '', period: '' }
  }
}

function publishSharedSelection(symbol: string, period: string) {
  try {
    window.localStorage.setItem(sharedSelectionStorageKey, JSON.stringify({ symbol, period }))
  } catch {
    // Shared selection persistence is best-effort only.
  }
  window.dispatchEvent(new CustomEvent(sharedSelectionChangedEvent, { detail: { symbol, period } }))
}

function readPersistedStoreTableSelection(symbol: string, enabled = true): string {
  if (!enabled || !symbol) return ''
  try {
    const raw = window.localStorage.getItem(storePanelSelectedTableKeyStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    const item = parsed?.[symbol] as PersistedStoreTableSelection | undefined
    return item?.symbol === symbol && typeof item.key === 'string' ? item.key : ''
  } catch {
    return ''
  }
}

function savePersistedStoreTableSelection(symbol: string, key: string, enabled = true) {
  if (!enabled || !symbol) return
  try {
    const raw = window.localStorage.getItem(storePanelSelectedTableKeyStorageKey)
    const parsed = raw ? JSON.parse(raw) : {}
    window.localStorage.setItem(
      storePanelSelectedTableKeyStorageKey,
      JSON.stringify({
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        [symbol]: { key, symbol },
      }),
    )
  } catch {
    // Store table selection persistence is best-effort only.
  }
}

function formatSymbolStatus(totalCount: number, visibleCount: number, merge?: { added?: number; updated?: number }) {
  return `共 ${totalCount} 个品种，本地已保存，刷新后自动恢复（当前显示 ${visibleCount} 个）`
    + (merge ? ` · 新增 ${merge.added ?? 0}，更新 ${merge.updated ?? 0}` : '')
}

function normalizeStoredStatus(status: string, symbolCount: number) {
  if (
    !status
    || status.includes('symbol(s)')
    || status.includes('stored locally')
    || status.includes('viewport renders')
    || status.includes('added')
    || /^[\x00-\x7F\s.,;:()/-]+$/.test(status)
  ) {
    return symbolCount ? formatSymbolStatus(symbolCount, symbolCount) : '点击 Scan MT5 加载品种列表。'
  }
  return status
}

function formatDetailValue(value: string | number | boolean | null | undefined) {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function formatCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '-'
}

function formatMarketPrice(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: 6 })
    : '-'
}

function formatMarketChange(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}

function formatMarketPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)}%`
}

function formatChartLoadStatus(state: ChartLoadState | null | undefined) {
  if (!state) return '-'
  if (state.loading) return `${state.symbol} ${state.period} 加载中 ${state.requestedRows.toLocaleString()}`
  if (state.error) return `${state.symbol} ${state.period} 加载失败`
  const localRows = typeof state.totalRows === 'number' && Number.isFinite(state.totalRows)
    ? state.totalRows
    : state.requestedRows
  return `${state.symbol} ${state.period} 已进入 ${state.rows.toLocaleString()} / 本地 ${localRows.toLocaleString()}${state.loadingMore ? ' · 加载历史' : ''}`
}

function formatCountWithWan(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (Math.abs(value) < 10000) return value.toLocaleString('en-US')
  const wan = value / 10000
  return `${value.toLocaleString('en-US')}（${wan.toFixed(wan >= 100 ? 0 : 1)}W）`
}

function formatCheckTime(value?: string | null) {
  if (!value) return '-'
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return value
  return new Date(time).toLocaleString()
}

function formatEpochSeconds(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return new Date(value * 1000).toLocaleString()
}

function parseChartJumpTime(value: string) {
  const normalized = value.trim().replace('T', ' ')
  if (!normalized) return null
  const match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  const timestamp = new Date(year, month - 1, day, hour, minute, second).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function resolveLocalM1Rows(status: StoreV5CheckPayload | null) {
  return status?.directM1?.rowsCount
    ?? status?.directM1?.trueM1RowsCount
    ?? status?.rawDirectM1?.rowsCount
    ?? status?.rawDirectM1?.rawRowsCount
    ?? null
}

function resolveLocalM1LastTime(status: StoreV5CheckPayload | null) {
  return status?.directM1?.lastTime ?? status?.rawDirectM1?.lastTime ?? null
}

function storeTableKeyForPeriod(period: string, rows: StoreTableRow[] = []) {
  const normalized = period.toUpperCase()
  const visibleRow = rows.find((row) => row.period.toUpperCase() === normalized)
  if (visibleRow) return `${visibleRow.kind}-${visibleRow.period}`
  return normalized === 'M1' ? 'm1-M1' : `aggregate-${normalized}`
}

function periodFromStoreTableKey(key: string) {
  const parts = key.split('-')
  return (parts[parts.length - 1] || '').toUpperCase()
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function formatUtcRange(firstText?: string | null, lastText?: string | null) {
  if (!firstText || !lastText) return '-'
  return `${firstText.replace(':00 UTC', '')} ~ ${lastText.replace(':00 UTC', '')} (UTC)`
}

function formatStoreOperationLine(
  pullJob: StoreV5PullJobPayload | null,
  checkJob: Mt5M1CheckJobPayload | null,
  aggregateProgress: StoreV5AggregateJobPayload | null,
  fallback: string,
) {
  if (pullJob) {
    if (pullJob.progressLabel) return pullJob.progressLabel

    const batchSize = pullJob.fetchChunkSize ?? pullJob.writeBatchSize ?? 200000
    if (pullJob.phase === 'probing' || pullJob.phase === 'queued' || pullJob.phase === 'fetching') {
      return `开始读取 ${formatCountWithWan(batchSize)}，已读取 ${formatCountWithWan(pullJob.rowsFetched)}`
    }
    if (pullJob.phase === 'streaming' || pullJob.phase === 'writing') {
      const currentBatch = pullJob.writeBatchRows ?? batchSize
      return `开始写入 ${formatCountWithWan(currentBatch)}，已写入 ${formatCountWithWan(pullJob.rowsWritten)}`
    }
    if (pullJob.phase === 'checking' || pullJob.phase === 'validating') return '已经写完，开始检查错误字段'
    if (pullJob.phase === 'cleaning') {
      const deleted = pullJob.cleanupDeletedRows != null ? `，已删除 ${formatCountWithWan(pullJob.cleanupDeletedRows)}` : ''
      return `检查完成，删除错误字段${deleted}`
    }
    if (pullJob.phase === 'completed') return '完成，本地 M1 数据已更新'
    if (pullJob.phase === 'cancelled') return '已取消'
    if (pullJob.phase === 'failed') return `失败：${pullJob.error || pullJob.status}`
    return pullJob.status || fallback
  }
  if (checkJob) {
    const batchSize = checkJob.chunkSize ?? 200000
    if (checkJob.phase === 'fetching' || checkJob.phase === 'queued') {
      if (checkJob.currentBatchIndex && checkJob.currentBatchRequested) {
        return `正在读取第 ${checkJob.currentBatchIndex} 批：计划 ${formatCountWithWan(checkJob.currentBatchRequested)}，已读取 ${formatCountWithWan(checkJob.mt5RowsCount)}`
      }
      return `开始读取 ${formatCountWithWan(batchSize)}，已读取 ${formatCountWithWan(checkJob.mt5RowsCount)}`
    }
    if (checkJob.phase === 'validating') return '已经读完，开始检查错误字段'
    if (checkJob.phase === 'completed') return '检查完成'
    if (checkJob.phase === 'cancelled') return '已取消'
    if (checkJob.phase === 'failed') return `失败：${checkJob.error || checkJob.status}`
    return checkJob.status || fallback
  }
  if (aggregateProgress) {
    if (aggregateProgress.progressLabel) return aggregateProgress.progressLabel
    if (aggregateProgress.phase === 'completed') {
      return `聚合完成：${aggregateProgress.periods.join('、')}`
    }
    if (aggregateProgress.phase === 'failed') {
      return `聚合失败：${aggregateProgress.currentPeriod ?? aggregateProgress.periods.join('、')}`
    }
    const current = aggregateProgress.currentPeriod ? `，当前 ${aggregateProgress.currentPeriod}` : ''
    return `正在聚合：${aggregateProgress.completed}/${aggregateProgress.total}${current}`
  }
  return fallback
}

function resolveStoreOperationProgress(
  pullJob: StoreV5PullJobPayload | null,
  checkJob: Mt5M1CheckJobPayload | null,
  aggregateProgress: StoreV5AggregateJobPayload | null,
) {
  if (pullJob) {
    if (pullJob.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (pullJob.phase === 'failed' || pullJob.phase === 'cancelled') return null
    if (typeof pullJob.progressPercent === 'number') {
      return {
        hasEstimate: true,
        width: Math.max(1, Math.min(99, Math.round(pullJob.progressPercent))),
      }
    }
    if (pullJob.phase === 'writing') {
      const written = typeof pullJob.rowsWritten === 'number' ? pullJob.rowsWritten : 0
      const total = typeof pullJob.trueM1RowsCount === 'number' && pullJob.trueM1RowsCount > 0 ? pullJob.trueM1RowsCount : null
      if (total) return { hasEstimate: true, width: Math.max(1, Math.min(99, Math.round((written / total) * 100))) }
    }
    const fetched = typeof pullJob.rowsFetched === 'number' ? pullJob.rowsFetched : 0
    const total = typeof pullJob.maxCount === 'number' && pullJob.maxCount > 0 ? pullJob.maxCount : null
    if (total) return { hasEstimate: true, width: Math.max(fetched > 0 ? 1 : 0, Math.min(99, Math.round((fetched / total) * 100))) }
    return { hasEstimate: false, width: 45 }
  }
  if (checkJob) {
    if (checkJob.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (checkJob.phase === 'failed' || checkJob.phase === 'cancelled') return null
    if (typeof checkJob.progressPercent === 'number') {
      return { hasEstimate: true, width: Math.max(1, Math.min(99, Math.round(checkJob.progressPercent))) }
    }
    return { hasEstimate: false, width: 45 }
  }
  if (aggregateProgress) {
    if (aggregateProgress.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (aggregateProgress.phase === 'failed') return null
    return {
      hasEstimate: true,
      width: Math.max(4, Math.min(99, Math.round((aggregateProgress.completed / Math.max(1, aggregateProgress.total)) * 100))),
    }
  }
  return null
}

function selectedDetailRows(row: Mt5SymbolRow): DetailRow[] {
  return [
    ['分类', row.category || row.market, '小数位', row.digits],
    ['合约量', row.tradeContractSize, '点差', row.spreadFloat ? '浮动' : row.spread],
    ['止损级别', row.tradeStopsLevel, '预付款货币', row.currencyMargin],
    ['盈利货币', row.currencyProfit, '基础货币', row.currencyBase],
    ['计算', row.tradeCalcMode, '图表模式', row.tradeMode],
    ['交易模式', row.tradeMode, '执行模式', row.tradeCalcMode],
    ['最小手数', row.volumeMin, '最大手数', row.volumeMax],
    ['手数步进', row.volumeStep, 'Tick Size', row.tradeTickSize],
    ['Tick Value', row.tradeTickValue, '可见', row.visible],
    ['路径', row.path],
  ]
}

function clampColumnWidth(width: number, column: ColumnKey) {
  const minByColumn: Record<ColumnKey, number> = {
    symbol: 46,
    name: 52,
    type: 40,
  }
  const maxByColumn: Record<ColumnKey, number> = {
    symbol: 180,
    name: 260,
    type: 140,
  }
  const fallback = defaultColumnWidths[column]
  const value = Number.isFinite(width) ? width : fallback
  return Math.max(minByColumn[column], Math.min(maxByColumn[column], Math.round(value)))
}

export function RightDrawer({
  activeDrawer,
  chartLoadState,
  drawerWidth,
  onClose,
  onJumpChartToTime,
  onLoadChartStep,
  onResize,
  onResetChartToLatest,
  onToggleDrawer,
  onOpenChart,
}: RightDrawerProps) {
  const initialSnapshot = useMemo(getInitialSymbolSnapshot, [])
  const initialRealtimeSnapshot = useMemo(readPersistedRealtimeSnapshot, [])
  const initialSharedSelection = useMemo(readSharedSelection, [])
  const [query, setQuery] = useState(readImportCenterQuery)
  const [symbols, setSymbols] = useState<Mt5SymbolRow[]>(() => initialSnapshot?.symbols ?? [])
  const [selectedSymbol, setSelectedSymbol] = useState(() => initialSharedSelection.symbol || initialSnapshot?.selectedSymbol || '')
  const [status, setStatus] = useState(
    () => normalizeStoredStatus(initialSnapshot?.status ?? '', initialSnapshot?.symbols.length ?? 0),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topPaneHeight, setTopPaneHeight] = useState(getInitialTopPaneHeight)
  const [watchlistTableHeight, setWatchlistTableHeight] = useState(getInitialWatchlistTableHeight)
  const [columnWidths, setColumnWidths] = useState(getInitialColumnWidths)
  const [selectedPanelTab, setSelectedPanelTab] = useState<SelectedPanelTab>(readImportCenterSelectedTab)
  const [selectedSettingsPanelTab, setSelectedSettingsPanelTab] = useState<SettingsPanelTab>('symbol')
  const [storePanelPersistenceEnabled, setStorePanelPersistenceEnabled] = useState(readStorePanelPersistenceEnabled)
  const initialPersistedM1Check = useMemo(
    () => readPersistedM1CheckResult(selectedSymbol, storePanelPersistenceEnabled),
    [selectedSymbol, storePanelPersistenceEnabled],
  )
  const initialPersistedStoreV5Status = useMemo(
    () => readPersistedStoreV5Status(selectedSymbol, storePanelPersistenceEnabled),
    [selectedSymbol, storePanelPersistenceEnabled],
  )
  const [storeCheck, setStoreCheck] = useState<StoreV5CheckPayload | null>(() => initialPersistedM1Check?.payload ?? null)
  const [mt5M1LastCheckedAt, setMt5M1LastCheckedAt] = useState(() => initialPersistedM1Check?.checkedAt ?? '')
  const [localStoreStatus, setLocalStoreStatus] = useState<StoreV5CheckPayload | null>(() => initialPersistedStoreV5Status?.payload ?? null)
  const [storeV5ListSymbols, setStoreV5ListSymbols] = useState<string[]>(() => readStoreV5ListSymbols(storePanelPersistenceEnabled))
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(readWatchlistSymbols)
  const [watchlistRealtimeEnabled, setWatchlistRealtimeEnabled] = useState(readWatchlistRealtimeEnabled)
  const [watchlistRealtimeReady, setWatchlistRealtimeReady] = useState(false)
  const [watchlistRealtimeStatus, setWatchlistRealtimeStatus] = useState('')
  const [watchlistRealtimeLog, setWatchlistRealtimeLog] = useState<string[]>(() => initialRealtimeSnapshot.log ?? [])
  const [watchlistTicks, setWatchlistTicks] = useState<Record<string, Mt5RealtimeTick>>(() => initialRealtimeSnapshot.ticks ?? {})
  const [watchlistLastTickAt, setWatchlistLastTickAt] = useState(() => initialRealtimeSnapshot.lastTickAt ?? '')
  const [shortcutMenuEnabled, setShortcutMenuEnabled] = useState(readShortcutMenuEnabled)
  const [selectedStoreTableKey, setSelectedStoreTableKey] = useState(() =>
    readPersistedStoreTableSelection(initialSharedSelection.symbol || initialSnapshot?.selectedSymbol || '', storePanelPersistenceEnabled),
  )
  const [selectedAggregatePeriods, setSelectedAggregatePeriods] = useState<string[]>([])
  const [storeCheckLoading, setStoreCheckLoading] = useState(false)
  const [storeCheckError, setStoreCheckError] = useState('')
  const [storeActionStatus, setStoreActionStatus] = useState('')
  const [chartJumpInput, setChartJumpInput] = useState('')
  const [chartJumpError, setChartJumpError] = useState('')
  const [m1CheckJob, setM1CheckJob] = useState<Mt5M1CheckJobPayload | null>(null)
  const [pullProgress, setPullProgress] = useState<StoreV5PullJobPayload | null>(null)
  const [aggregateProgress, setAggregateProgress] = useState<StoreV5AggregateJobPayload | null>(null)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)
  const activeM1CheckJobRef = useRef('')
  const activePullJobRef = useRef('')
  const activeAggregateJobRef = useRef('')
  const autoOpenedStoreTableRef = useRef('')
  const pullEventSourceRef = useRef<EventSource | null>(null)
  const aggregateEventSourceRef = useRef<EventSource | null>(null)
  const open = activeDrawer != null
  const watchlistTicksEventSourceRef = useRef<EventSource | null>(null)
  const watchlistRealtimeRunRef = useRef(0)

  const visibleSymbols = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return symbols
    return symbols.filter((row) => {
      const display = resolveMt5SymbolDisplay(row)
      return [
        row.symbol,
        row.name,
        row.description,
        row.path,
        row.category,
        display.chineseName,
        display.assetType,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [query, symbols])

  const selectedRow = useMemo(() => {
    return symbols.find((row) => row.symbol === selectedSymbol) ?? visibleSymbols[0] ?? null
  }, [selectedSymbol, symbols, visibleSymbols])

  const selectedDisplay = selectedRow ? resolveMt5SymbolDisplay(selectedRow) : null
  const selectedIsInWatchlist = selectedRow ? watchlistSymbols.includes(selectedRow.symbol) : false
  const watchlistRows = useMemo(() => {
    const rowsBySymbol = new Map(symbols.map((row) => [row.symbol, row]))
    return watchlistSymbols
      .map((symbol) => rowsBySymbol.get(symbol))
      .filter((row): row is Mt5SymbolRow => Boolean(row))
  }, [symbols, watchlistSymbols])
  const foregroundRealtimeSymbol = selectedRow?.symbol ?? ''

  function pushWatchlistRealtimeLog(message: string) {
    const timestamp = new Date().toLocaleTimeString()
    setWatchlistRealtimeLog((current) => [`${timestamp}  ${message}`, ...current].slice(0, 8))
  }

  const visibleStoreAggregateRows = useMemo(() => {
    const cellsByPeriod = new Map(
      (localStoreStatus?.aggregated ?? [])
        .filter((cell) => typeof cell.timeframe === 'string')
        .map((cell) => [String(cell.timeframe).toUpperCase(), cell]),
    )
    return storeTableAggregatePeriods.map((period) => {
      const cell = cellsByPeriod.get(period)
      return {
        period,
        count: formatCount(cell?.rowsCount),
        updated: cell ? formatEpochSeconds(cell.lastTime) : '未聚合',
        rowsCount: cell?.rowsCount ?? null,
      }
    })
  }, [localStoreStatus])
  const visibleStoreTableRows = useMemo<StoreTableRow[]>(() => {
    const rows: StoreTableRow[] = []
    if (selectedRow?.symbol && storeV5ListSymbols.includes(selectedRow.symbol)) {
      const rowsCount = resolveLocalM1Rows(localStoreStatus)
      rows.push({
        period: 'M1',
        count: formatCount(rowsCount),
        updated: formatEpochSeconds(resolveLocalM1LastTime(localStoreStatus)),
        kind: 'm1',
        rowsCount,
      })
    }
    return [...rows, ...visibleStoreAggregateRows.map((row) => ({
      ...row,
      kind: 'aggregate' as const,
      rowsCount: row.rowsCount,
    }))]
  }, [localStoreStatus, selectedRow?.symbol, storeV5ListSymbols, visibleStoreAggregateRows])
  const watchlistDirectPeriods = useMemo<StoreTableRow[]>(() => {
    const rowsCount = resolveLocalM1Rows(localStoreStatus)
    if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return []
    return [{
      period: 'M1',
      count: formatCount(rowsCount),
      updated: formatEpochSeconds(resolveLocalM1LastTime(localStoreStatus)),
      kind: 'm1',
      rowsCount,
    }]
  }, [localStoreStatus])
  const watchlistAggregatedPeriods = useMemo<StoreTableRow[]>(() => {
    const cellsByPeriod = new Map(
      (localStoreStatus?.aggregated ?? [])
        .filter((cell) => typeof cell.timeframe === 'string')
        .map((cell) => [String(cell.timeframe).toUpperCase(), cell]),
    )
    return storeTableAggregatePeriods.flatMap((period) => {
      const cell = cellsByPeriod.get(period)
      const rowsCount = cell?.rowsCount
      if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return []
      return [{
        period,
        count: formatCount(rowsCount),
        updated: formatEpochSeconds(cell?.lastTime),
        kind: 'aggregate' as const,
        rowsCount,
      }]
    })
  }, [localStoreStatus])
  const selectedStoreTableKeyIsVisible = useMemo(
    () => visibleStoreTableRows.some((row) => `${row.kind}-${row.period}` === selectedStoreTableKey),
    [selectedStoreTableKey, visibleStoreTableRows],
  )

  useEffect(() => {
    const syncSelection = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as Partial<SharedSelection> : readSharedSelection()
      const nextSymbol = typeof detail.symbol === 'string' ? detail.symbol : ''
      const nextPeriod = typeof detail.period === 'string' ? detail.period.toUpperCase() : ''

      if (nextSymbol && nextSymbol !== selectedSymbol) {
        const persistedCheck = readPersistedM1CheckResult(nextSymbol, storePanelPersistenceEnabled)
        const persistedStoreStatus = readPersistedStoreV5Status(nextSymbol, storePanelPersistenceEnabled)
        setSelectedSymbol(nextSymbol)
        setStoreCheck(persistedCheck?.payload ?? null)
        setMt5M1LastCheckedAt(persistedCheck?.checkedAt ?? '')
        setLocalStoreStatus(persistedStoreStatus?.payload ?? null)
        setStoreCheckError('')
        setStoreActionStatus('')
        if (symbols.length) {
          saveSymbolSnapshot({
            selectedSymbol: nextSymbol,
            status,
            symbols,
          })
        }
      }

      if (nextPeriod) {
        setSelectedStoreTableKey(storeTableKeyForPeriod(nextPeriod, visibleStoreTableRows))
      }
    }

    window.addEventListener(sharedSelectionChangedEvent, syncSelection)
    return () => window.removeEventListener(sharedSelectionChangedEvent, syncSelection)
  }, [selectedSymbol, status, storePanelPersistenceEnabled, symbols, visibleStoreTableRows])

  useEffect(() => {
    if (!shortcutMenuEnabled) return
    saveShortcutMenuPeriods([...watchlistDirectPeriods, ...watchlistAggregatedPeriods])
  }, [shortcutMenuEnabled, watchlistAggregatedPeriods, watchlistDirectPeriods])

  useEffect(() => {
    const shared = readSharedSelection()
    if (!shared.period) return
    const nextKey = storeTableKeyForPeriod(shared.period, visibleStoreTableRows)
    if (selectedStoreTableKey !== nextKey) setSelectedStoreTableKey(nextKey)
  }, [selectedStoreTableKey, visibleStoreTableRows])

  useEffect(() => {
    if (!selectedRow?.symbol || !selectedStoreTableKeyIsVisible || !selectedStoreTableKey) return

    const autoOpenKey = `${selectedRow.symbol}:${selectedStoreTableKey}`
    if (autoOpenedStoreTableRef.current === autoOpenKey) return

    const row = visibleStoreTableRows.find((item) => `${item.kind}-${item.period}` === selectedStoreTableKey)
    if (!row) return

    autoOpenedStoreTableRef.current = autoOpenKey
    onOpenChart?.({
      symbol: selectedRow.symbol,
      period: row.period === 'M1' ? '1m' : row.period,
      totalRows: typeof row.rowsCount === 'number' && Number.isFinite(row.rowsCount) ? row.rowsCount : null,
    })
  }, [onOpenChart, selectedRow?.symbol, selectedStoreTableKey, selectedStoreTableKeyIsVisible, visibleStoreTableRows])

  useEffect(() => {
    saveImportCenterQuery(query)
  }, [query])

  useEffect(() => {
    saveImportCenterSelectedTab(selectedPanelTab)
  }, [selectedPanelTab])

  useEffect(() => {
    saveWatchlistRealtimeEnabled(watchlistRealtimeEnabled)
  }, [watchlistRealtimeEnabled])

  useEffect(() => {
    savePersistedRealtimeSnapshot({
      lastTickAt: watchlistLastTickAt,
      log: watchlistRealtimeLog,
      ticks: watchlistTicks,
    })
  }, [watchlistLastTickAt, watchlistRealtimeLog, watchlistTicks])

  useEffect(() => {
    if (!watchlistRealtimeEnabled) {
      watchlistRealtimeRunRef.current += 1
      setWatchlistRealtimeReady(false)
      setWatchlistRealtimeStatus('')
      pushWatchlistRealtimeLog('Realtime stopped')
      return
    }

    if (!foregroundRealtimeSymbol) {
      setWatchlistRealtimeReady(false)
      setWatchlistRealtimeStatus('No symbols')
      pushWatchlistRealtimeLog('No foreground symbol, realtime not started')
      return
    }

    const runId = watchlistRealtimeRunRef.current + 1
    watchlistRealtimeRunRef.current = runId
    setWatchlistRealtimeReady(false)
    setWatchlistRealtimeStatus('Syncing')
    setWatchlistRealtimeLog([])
    pushWatchlistRealtimeLog(`Realtime requested for foreground symbol ${foregroundRealtimeSymbol}`)

    const waitForPullJob = (jobId: string, symbol: string) => new Promise<void>((resolve, reject) => {
      const source = createStoreV5PullEventSource(jobId)

      const cleanup = () => source.close()
      const fail = (message: string) => {
        cleanup()
        reject(new Error(message))
      }

      source.addEventListener('progress', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as StoreV5PullJobPayload
          if (watchlistRealtimeRunRef.current !== runId) {
            cleanup()
            resolve()
            return
          }
          const line = `${symbol} ${payload.progressLabel || payload.status || 'Pulling M1'}`
          setWatchlistRealtimeStatus(line)
          pushWatchlistRealtimeLog(line)
        } catch {
          setWatchlistRealtimeStatus(`${symbol} Pulling M1`)
        }
      })
      source.addEventListener('done', () => {
        pushWatchlistRealtimeLog(`${symbol} M1 gap fill completed`)
        cleanup()
        resolve()
      })
      source.addEventListener('cancelled', () => fail(`${symbol} pull cancelled`))
      source.addEventListener('error', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { error?: string; status?: string }
          fail(payload.error || payload.status || `${symbol} pull failed`)
        } catch {
          fail(`${symbol} pull failed`)
        }
      })
      source.onerror = () => fail(`${symbol} pull disconnected`)
    })

    const waitForAggregateJob = (jobId: string, symbol: string) => new Promise<void>((resolve, reject) => {
      const source = createStoreV5AggregateEventSource(jobId)

      const cleanup = () => source.close()
      const fail = (message: string) => {
        cleanup()
        reject(new Error(message))
      }

      source.addEventListener('progress', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as StoreV5AggregateJobPayload
          if (watchlistRealtimeRunRef.current !== runId) {
            cleanup()
            resolve()
            return
          }
          const line = `${symbol} ${payload.progressLabel || payload.status || 'Aggregating'}`
          setWatchlistRealtimeStatus(line)
          pushWatchlistRealtimeLog(line)
        } catch {
          setWatchlistRealtimeStatus(`${symbol} Aggregating`)
        }
      })
      source.addEventListener('done', () => {
        pushWatchlistRealtimeLog(`${symbol} aggregation completed`)
        cleanup()
        resolve()
      })
      source.addEventListener('cancelled', () => fail(`${symbol} aggregate cancelled`))
      source.addEventListener('error', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { error?: string; status?: string }
          fail(payload.error || payload.status || `${symbol} aggregate failed`)
        } catch {
          fail(`${symbol} aggregate failed`)
        }
      })
      source.onerror = () => fail(`${symbol} aggregate disconnected`)
    })

    const runRealtimeSync = async () => {
      try {
        for (const symbol of [foregroundRealtimeSymbol]) {
          if (watchlistRealtimeRunRef.current !== runId) return

          setWatchlistRealtimeStatus(`${symbol} checking store`)
          pushWatchlistRealtimeLog(`${symbol} checking local StoreV5 status`)
          const statusPayload = await fetchStoreV5Status(symbol)
          const hasLocalM1 = typeof resolveLocalM1Rows(statusPayload) === 'number'
            && Number(resolveLocalM1Rows(statusPayload)) > 0

          setWatchlistRealtimeStatus(`${symbol} pulling missing M1`)
          pushWatchlistRealtimeLog(`${symbol} ${hasLocalM1 ? 'incremental M1 gap fill started' : 'full M1 download started'}`)
          const pullJob = await startStoreV5PullJob(symbol, hasLocalM1 ? 'incremental' : 'refresh')
          await waitForPullJob(pullJob.jobId, symbol)
          if (watchlistRealtimeRunRef.current !== runId) return

          setWatchlistRealtimeStatus(`${symbol} repairing M1 gaps`)
          pushWatchlistRealtimeLog(`${symbol} scanning and repairing recent M1 window`)
          const gapRepair = await repairStoreV5M1Gaps(symbol, {
            lookbackMinutes: storeV5M1RepairLookbackMinutes,
            maxGapMinutes: storeV5M1RepairMaxGapMinutes,
          })
          if ((gapRepair.gapsDetected ?? 0) > 0) {
            pushWatchlistRealtimeLog(
              `${symbol} gap repair: ${gapRepair.gapsDetected ?? 0} gaps, ${gapRepair.rowsWritten ?? 0} rows written`,
            )
          } else {
            pushWatchlistRealtimeLog(`${symbol} M1 recent window repaired, ${gapRepair.rowsWritten ?? 0} rows written`)
          }

          const statusAfterPull = await fetchStoreV5Status(symbol)

          const aggregateTargets = resolveStoreV5AggregateTargets(statusAfterPull)

          if (aggregateTargets.length) {
            setWatchlistRealtimeStatus(`${symbol} aggregating periods`)
            pushWatchlistRealtimeLog(`${symbol} aggregating ${aggregateTargets.join(', ')}`)
            const aggregateJob = await startStoreV5AggregateJob(symbol, aggregateTargets)
            await waitForAggregateJob(aggregateJob.jobId, symbol)
          } else {
            pushWatchlistRealtimeLog(`${symbol} no aggregate periods to rebuild`)
          }

          const statusAfterSync = await fetchStoreV5Status(symbol)
          if (symbol === selectedRow?.symbol) {
            setLocalStoreStatus(statusAfterSync)
            savePersistedStoreV5Status(symbol, statusAfterSync, new Date().toISOString(), storePanelPersistenceEnabled)
          }
        }

        if (watchlistRealtimeRunRef.current !== runId) return
        setWatchlistRealtimeReady(true)
        setWatchlistRealtimeStatus('Starting realtime')
        const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
        const latestStatus = await fetchStoreV5Status(foregroundRealtimeSymbol)
        const rowsForPeriod = period === 'M1'
          ? resolveLocalM1Rows(latestStatus)
          : latestStatus.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
        onOpenChart?.({
          symbol: foregroundRealtimeSymbol,
          period: period === 'M1' ? '1m' : period,
          totalRows: typeof rowsForPeriod === 'number' && Number.isFinite(rowsForPeriod) ? rowsForPeriod : null,
          reloadId: Date.now(),
        })
        pushWatchlistRealtimeLog('Gap fill and aggregation completed, starting tick realtime')
      } catch (error) {
        if (watchlistRealtimeRunRef.current !== runId) return
        setWatchlistRealtimeReady(false)
        setWatchlistRealtimeEnabled(false)
        setWatchlistRealtimeStatus(error instanceof Error ? error.message : 'Sync failed')
        pushWatchlistRealtimeLog(error instanceof Error ? `Realtime failed: ${error.message}` : 'Realtime failed')
      }
    }

    void runRealtimeSync()

    return () => {
      if (watchlistRealtimeRunRef.current === runId) {
        watchlistRealtimeRunRef.current += 1
      }
    }
  }, [foregroundRealtimeSymbol, onOpenChart, selectedStoreTableKey, watchlistRealtimeEnabled])

  useEffect(() => {
    watchlistTicksEventSourceRef.current?.close()
    watchlistTicksEventSourceRef.current = null

    if (!watchlistRealtimeEnabled || !watchlistRealtimeReady) return

    setWatchlistRealtimeStatus('Connecting')
    if (!foregroundRealtimeSymbol) return

    const source = createMt5TicksEventSource([foregroundRealtimeSymbol], 500)
    watchlistTicksEventSourceRef.current = source

    source.addEventListener('ready', () => {
      setWatchlistRealtimeStatus('Live')
      pushWatchlistRealtimeLog('Realtime feed connected')
    })

    source.addEventListener('ticks', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { ticks?: Mt5RealtimeTick[] }
        const ticks = Array.isArray(payload.ticks) ? payload.ticks : []
        if (!ticks.length) return
        const updatedSymbols = ticks.map((tick) => tick.symbol).filter(Boolean)
        setWatchlistTicks((current) => {
          const next = { ...current }
          ticks.forEach((tick) => {
            if (tick.symbol) next[tick.symbol] = tick
          })
          return next
        })
        ticks.forEach((tick) => {
          if (!tick.symbol) return
          window.dispatchEvent(new CustomEvent('fractalframe:mt5RealtimeTick', { detail: tick }))
        })
        if (updatedSymbols.length) {
          setWatchlistLastTickAt(new Date().toLocaleTimeString())
        }
        setWatchlistRealtimeStatus('Live')
      } catch {
        setWatchlistRealtimeStatus('Parse error')
        pushWatchlistRealtimeLog('Realtime tick parse error')
      }
    })

    source.addEventListener('error', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { error?: string; status?: string }
        const line = payload.error || payload.status || 'Error'
        setWatchlistRealtimeStatus(line)
        pushWatchlistRealtimeLog(`Realtime error: ${line}`)
      } catch {
        setWatchlistRealtimeStatus('Disconnected')
        pushWatchlistRealtimeLog('Realtime disconnected')
      }
    })

    source.onerror = () => {
      setWatchlistRealtimeStatus('Reconnecting')
      pushWatchlistRealtimeLog('Realtime reconnecting')
    }

    return () => {
      source.close()
      if (watchlistTicksEventSourceRef.current === source) {
        watchlistTicksEventSourceRef.current = null
      }
    }
  }, [foregroundRealtimeSymbol, watchlistRealtimeEnabled, watchlistRealtimeReady])

  const storeOperationLine = useMemo(
    () => formatStoreOperationLine(pullProgress, m1CheckJob, aggregateProgress, storeActionStatus),
    [aggregateProgress, m1CheckJob, pullProgress, storeActionStatus],
  )
  const storeOperationProgress = useMemo(
    () => resolveStoreOperationProgress(pullProgress, m1CheckJob, aggregateProgress),
    [aggregateProgress, m1CheckJob, pullProgress],
  )
  const isCheckingMt5M1 = storeCheckLoading && m1CheckJob != null
  const isPullingStoreV5 = storeCheckLoading && (pullProgress != null || storeActionStatus.includes('鎷夊彇'))
  const canAggregateStoreV5 = localStoreStatus?.directM1?.status !== 'raw_m1_ready_clean_pending'
    && localStoreStatus?.directM1?.datasetKey?.includes(':direct:M1') === true

  function handleToggleStorePanelPersistence(enabled: boolean) {
    setStorePanelPersistenceEnabled(enabled)
    saveStorePanelPersistenceEnabled(enabled)
    if (!enabled) {
      clearStorePanelPersistence()
      setSelectedStoreTableKey('')
    } else {
      setStoreV5ListSymbols(readStoreV5ListSymbols(true))
      setSelectedStoreTableKey(readPersistedStoreTableSelection(selectedRow?.symbol ?? '', true))
    }
  }

  async function loadSymbols(refresh: boolean) {
    setLoading(true)
    setError('')
    setStatus(refresh ? '姝ｅ湪鎵弿 MT5 鍝佺...' : '姝ｅ湪璇诲彇 MT5 鍝佺缂撳瓨...')

    try {
      const payload = await fetchMt5Symbols({ limit: 50000, refresh })
      const rows = Array.isArray(payload.symbols) ? payload.symbols : []
      const merge = payload.scanReport ?? payload.cache?.lastScanReport
      const nextSelectedSymbol =
        selectedSymbol && rows.some((row) => row.symbol === selectedSymbol)
          ? selectedSymbol
          : rows[0]?.symbol ?? ''
      const nextStatus = formatSymbolStatus(
        payload.totalCount ?? payload.count ?? rows.length,
        rows.length,
        merge,
      )

      setSymbols(rows)
      setSelectedSymbol(nextSelectedSymbol)
      const persistedCheck = readPersistedM1CheckResult(nextSelectedSymbol, storePanelPersistenceEnabled)
      const persistedStoreStatus = readPersistedStoreV5Status(nextSelectedSymbol, storePanelPersistenceEnabled)
      setStoreCheck(persistedCheck?.payload ?? null)
      setMt5M1LastCheckedAt(persistedCheck?.checkedAt ?? '')
      setLocalStoreStatus(persistedStoreStatus?.payload ?? null)
      setSelectedStoreTableKey(readPersistedStoreTableSelection(nextSelectedSymbol, storePanelPersistenceEnabled))
      setStatus(nextStatus)
      saveSymbolSnapshot({
        selectedSymbol: nextSelectedSymbol,
        status: nextStatus,
        symbols: rows,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSymbols([])
      setSelectedSymbol('')
      setError(message)
      setStatus(`鎵弿澶辫触锛?{message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = drawerWidth
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-resizing', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      onResize(clampDrawerWidth(startWidth - deltaX))
      window.dispatchEvent(new Event('resize'))
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-resizing')
      handle.releasePointerCapture(upEvent.pointerId)
      window.dispatchEvent(new Event('resize'))
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = topPaneHeight
    const drawer = event.currentTarget.closest('.ff-right-drawer')
    const maxHeight = Math.max(220, (drawer?.clientHeight ?? 760) - 190)
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-splitting', 'true')
    handle.setAttribute('data-dragging', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY
      const next = Math.max(180, Math.min(maxHeight, Math.round(startHeight + deltaY)))
      setTopPaneHeight(next)
      try {
        window.localStorage.setItem(splitHeightStorageKey, String(next))
      } catch {
        // Split persistence is best-effort only.
      }
    }

    const finishSplit = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishSplit)
      ownerDocument.removeEventListener('pointercancel', finishSplit)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-splitting')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishSplit)
    ownerDocument.addEventListener('pointercancel', finishSplit)
  }

  function handleColumnResizePointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
    column: ColumnKey,
  ) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = columnWidths[column]
    const tableWrap = tableWrapRef.current
    const tableWidth = tableWrap?.clientWidth ?? 0
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-mt5-column-resizing', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      setColumnWidths((current) => {
        const otherColumnsWidth = Object.entries(current).reduce((sum, [key, value]) => {
          return key === column ? sum : sum + value
        }, 0)
        const maxToKeepTableFilled = Math.max(
          defaultColumnWidths[column],
          tableWidth - otherColumnsWidth - 90,
        )
        const next = {
          ...current,
          [column]: Math.min(clampColumnWidth(startWidth + deltaX, column), maxToKeepTableFilled),
        }
        try {
          window.localStorage.setItem(columnWidthsStorageKey, JSON.stringify(next))
        } catch {
          // Column width persistence is best-effort only.
        }
        return next
      })
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-mt5-column-resizing')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  function handleWatchlistTableResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = watchlistTableHeight
    const drawer = event.currentTarget.closest('.ff-right-drawer')
    const tableWrap = event.currentTarget.previousElementSibling as HTMLElement | null
    const drawerBottom = drawer?.getBoundingClientRect().bottom ?? window.innerHeight
    const tableTop = tableWrap?.getBoundingClientRect().top ?? event.clientY
    const maxHeight = Math.max(96, Math.round(drawerBottom - tableTop - 14))
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-splitting', 'true')
    handle.setAttribute('data-dragging', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY
      const next = Math.max(96, Math.min(maxHeight, Math.round(startHeight + deltaY)))
      setWatchlistTableHeight(next)
      try {
        window.localStorage.setItem(watchlistTableHeightStorageKey, String(next))
      } catch {
        // Watchlist table height persistence is best-effort only.
      }
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-splitting')
      handle.removeAttribute('data-dragging')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  function resetColumnWidth(column: ColumnKey) {
    setColumnWidths((current) => {
      const next = { ...current, [column]: defaultColumnWidths[column] }
      try {
        window.localStorage.setItem(columnWidthsStorageKey, JSON.stringify(next))
      } catch {
        // Column width persistence is best-effort only.
      }
      return next
    })
  }

  function handleSelectSymbol(symbol: string) {
    const persistedCheck = readPersistedM1CheckResult(symbol, storePanelPersistenceEnabled)
    const persistedStoreStatus = readPersistedStoreV5Status(symbol, storePanelPersistenceEnabled)
    const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
    setSelectedSymbol(symbol)
    setStoreCheck(persistedCheck?.payload ?? null)
    setMt5M1LastCheckedAt(persistedCheck?.checkedAt ?? '')
    setLocalStoreStatus(persistedStoreStatus?.payload ?? null)
    setSelectedStoreTableKey(storeTableKeyForPeriod(period, visibleStoreTableRows))
    setStoreCheckError('')
    setStoreActionStatus('')
    publishSharedSelection(symbol, period)
    onOpenChart?.({
      symbol,
      period: period === 'M1' ? '1m' : period,
      totalRows: null,
    })
    if (symbols.length) {
      saveSymbolSnapshot({
        selectedSymbol: symbol,
        status,
        symbols,
      })
    }
  }

  async function handleCheckMt5M1() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setStoreActionStatus('正在检查 MT5 终端 M1...')

    try {
      const payload = await fetchStoreV5Check(symbol)
      setStoreCheck(payload)
      setStoreActionStatus('MT5 终端 M1 检查完成。')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreCheck(null)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  void handleCheckMt5M1

  async function handleCheckMt5M1Staged() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setStoreActionStatus('')

    try {
      const previous = storeCheck?.directM1
      const canIncremental = previous?.lastTime != null && (previous.trueM1RowsCount != null || previous.rowsCount != null)
      const started = await startMt5M1CheckJob(symbol, canIncremental
        ? {
            chunk: 200000,
            maxCount: 10000000,
            mode: 'incremental',
            sinceTime: previous.lastTime,
            baseFirstTime: previous.firstTime,
            baseLastTime: previous.lastTime,
            baseTrueM1RowsCount: previous.trueM1RowsCount ?? previous.rowsCount,
            baseMt5RowsCount: previous.mt5RowsCount ?? previous.trueM1RowsCount ?? previous.rowsCount,
            overlapBars: 1000,
          }
        : { chunk: 200000, maxCount: 10000000, mode: 'refresh' })
      activeM1CheckJobRef.current = started.jobId
      setM1CheckJob(started)

      while (activeM1CheckJobRef.current === started.jobId) {
        await delay(600)
        const current = await fetchMt5M1CheckJob(started.jobId)
        setM1CheckJob(current)
        if (current.phase === 'completed') {
          if (current.result) {
            const checkedAt = new Date().toISOString()
            setStoreCheck(current.result)
            setMt5M1LastCheckedAt(checkedAt)
            savePersistedM1CheckResult(symbol, current.result, checkedAt, storePanelPersistenceEnabled)
          }
          setM1CheckJob(null)
          break
        }
        if (current.phase === 'failed' || current.phase === 'cancelled') {
          throw new Error(current.error || current.status || current.phase)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      activeM1CheckJobRef.current = ''
      setPullProgress(null)
      setStoreCheckLoading(false)
    }
  }

  async function handleCancelMt5M1Check() {
    const jobId = m1CheckJob?.jobId
    if (!jobId) return
    activeM1CheckJobRef.current = ''
    try {
      const payload = await cancelMt5M1CheckJob(jobId)
      setM1CheckJob(payload)
      setStoreActionStatus('')
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
    } finally {
      setM1CheckJob(null)
      setStoreCheckLoading(false)
    }
  }

  async function handleCancelPullStore() {
    const jobId = pullProgress?.jobId
    if (!jobId) return
    activePullJobRef.current = ''
    try {
      pullEventSourceRef.current?.close()
    } catch {
      // best effort
    }
    pullEventSourceRef.current = null
    setPullProgress(null)
    setStoreCheckLoading(false)
    setStoreActionStatus('已取消')
    try {
      await cancelStoreV5PullJob(jobId)
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
    }
  }

  function waitStoreV5PullJobBySse(jobId: string) {
    return new Promise<StoreV5PullJobPayload>((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        try {
          pullEventSourceRef.current?.close()
        } catch {
          // best effort
        }
        pullEventSourceRef.current = null
        fn()
      }
      const applyPayload = (event: MessageEvent) => {
        if (activePullJobRef.current !== jobId) return null
        const payload = JSON.parse(event.data || '{}') as StoreV5PullJobPayload
        setPullProgress(payload)
        return payload
      }

      try {
        const source = createStoreV5PullEventSource(jobId)
        pullEventSourceRef.current = source
        source.addEventListener('progress', (event) => {
          try {
            applyPayload(event as MessageEvent)
          } catch {
            // ignore malformed progress
          }
        })
        source.addEventListener('done', (event) => {
          try {
            const payload = applyPayload(event as MessageEvent)
            finish(() => resolve(payload as StoreV5PullJobPayload))
          } catch (err) {
            finish(() => reject(err))
          }
        })
        source.addEventListener('cancelled', (event) => {
          try {
            applyPayload(event as MessageEvent)
          } catch {
            // ignore malformed cancelled payload
          }
          finish(() => reject(new Error('store_v5_pull_cancelled')))
        })
        source.addEventListener('error', (event) => {
          const messageEvent = event as MessageEvent
          if (messageEvent.data) {
            try {
              const payload = applyPayload(messageEvent)
              finish(() => reject(new Error(payload?.error || payload?.status || 'store_v5_pull_failed')))
              return
            } catch {
              // fall through to generic error
            }
          }
          if (!settled && activePullJobRef.current === jobId) {
            finish(() => reject(new Error('store_v5_pull_sse_disconnected')))
          }
        })
      } catch (err) {
        finish(() => reject(err))
      }
    })
  }

  async function waitStoreV5PullJobByPolling(jobId: string) {
    while (activePullJobRef.current === jobId) {
      await delay(600)
      const current = await fetchStoreV5PullJob(jobId)
      setPullProgress(current)
      if (current.phase === 'completed') return current
      if (current.phase === 'failed' || current.phase === 'cancelled') {
        throw new Error(current.error || current.status || current.phase)
      }
    }
    throw new Error('store_v5_pull_cancelled')
  }

  async function handleRefreshStoreStatus() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Reading StoreV5 status...')
    try {
      setStoreActionStatus('Scanning and repairing M1 gaps...')
      const gapRepair = await repairStoreV5M1Gaps(symbol, {
        lookbackMinutes: storeV5M1RepairLookbackMinutes,
        maxGapMinutes: storeV5M1RepairMaxGapMinutes,
      })
      setStoreActionStatus(
        (gapRepair.gapsDetected ?? 0) > 0
          ? `M1 gap repair complete: found ${gapRepair.gapsDetected ?? 0} gaps, wrote ${gapRepair.rowsWritten ?? 0} rows.`
          : 'M1 gap check complete: no recent middle gaps.',
      )
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
      const rowsForPeriod = period === 'M1'
        ? resolveLocalM1Rows(payload)
        : payload.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
      onOpenChart?.({
        symbol,
        period: period === 'M1' ? '1m' : period,
        totalRows: typeof rowsForPeriod === 'number' && Number.isFinite(rowsForPeriod) ? rowsForPeriod : null,
        reloadId: Date.now(),
      })
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus((current) => (current.includes('refresh') ? '' : current))
      }, 1600)
      setStoreActionStatus('StoreV5 status refreshed.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      activeAggregateJobRef.current = ''
      try {
        aggregateEventSourceRef.current?.close()
      } catch {
        // best effort
      }
      aggregateEventSourceRef.current = null
      setStoreCheckLoading(false)
    }
  }

  async function handlePullStore() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setM1CheckJob(null)
    setPullProgress(null)
    setStoreActionStatus('Pulling MT5 M1 into StoreV5...')
    try {
      let pullMode = 'refresh'
      try {
        const currentStore = await fetchStoreV5Status(symbol)
        if (
          currentStore.rawDirectM1?.lastTime != null ||
          currentStore.rawDirectM1?.rowsCount != null ||
          currentStore.directM1?.lastTime != null ||
          currentStore.directM1?.rowsCount != null
        ) {
          pullMode = 'incremental'
        }
      } catch {
        pullMode = 'refresh'
      }
      setStoreActionStatus(
        pullMode === 'incremental'
          ? 'Incremental MT5 M1 pull into StoreV5...'
          : 'Initial MT5 M1 pull into StoreV5...',
      )
      const started = await startStoreV5PullJob(symbol, pullMode)
      activePullJobRef.current = started.jobId
      setPullProgress(started)
      try {
        await waitStoreV5PullJobBySse(started.jobId)
      } catch (err) {
        if (activePullJobRef.current !== started.jobId) throw err
        await waitStoreV5PullJobByPolling(started.jobId)
      }
      setStoreActionStatus('Scanning and repairing recent M1 window...')
      await repairStoreV5M1Gaps(symbol, {
        lookbackMinutes: storeV5M1RepairLookbackMinutes,
        maxGapMinutes: storeV5M1RepairMaxGapMinutes,
      })

      const repairedStatus = await fetchStoreV5Status(symbol)
      const aggregateTargets = resolveStoreV5AggregateTargets(repairedStatus)
      if (aggregateTargets.length) {
        setStoreActionStatus(`Aggregating periods: ${aggregateTargets.join(', ')}...`)
        const aggregateJob = await startStoreV5AggregateJob(symbol, aggregateTargets)
        activeAggregateJobRef.current = aggregateJob.jobId
        setAggregateProgress(aggregateJob)
        try {
          await waitStoreV5AggregateJobBySse(aggregateJob.jobId)
        } catch (err) {
          if (activeAggregateJobRef.current !== aggregateJob.jobId) throw err
          await waitStoreV5AggregateJobByPolling(aggregateJob.jobId)
        }
      }
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
      const rowsForPeriod = period === 'M1'
        ? resolveLocalM1Rows(payload)
        : payload.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
      onOpenChart?.({
        symbol,
        period: period === 'M1' ? '1m' : period,
        totalRows: typeof rowsForPeriod === 'number' && Number.isFinite(rowsForPeriod) ? rowsForPeriod : null,
        reloadId: Date.now(),
      })
      setStoreActionStatus('Pull complete. Store status refreshed.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      activePullJobRef.current = ''
      try {
        pullEventSourceRef.current?.close()
      } catch {
        // best effort
      }
      pullEventSourceRef.current = null
      activeAggregateJobRef.current = ''
      try {
        aggregateEventSourceRef.current?.close()
      } catch {
        // best effort
      }
      aggregateEventSourceRef.current = null
      setPullProgress(null)
      setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
      setStoreCheckLoading(false)
    }
  }

  async function handleDeleteLocalStore() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const ok = window.confirm(`Delete local StoreV5 data for ${symbol}? This clears local M1 and aggregated periods.`)
    if (!ok) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Deleting local StoreV5 data...')
    try {
      await deleteStoreV5Symbol(symbol)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus('Local StoreV5 data deleted.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  async function handleDeleteSelectedAggregates() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const periods = [...selectedAggregatePeriods]
    if (!periods.length) {
      setStoreCheckError('Select aggregated periods to delete first.')
      return
    }
    const ok = window.confirm(`Delete aggregated periods for ${symbol}: ${periods.join(', ')}? M1 will not be deleted.`)
    if (!ok) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress(null)
    setStoreActionStatus(`Deleting aggregated periods: ${periods.join(', ')}...`)
    try {
      await deleteStoreV5AggregatedTimeframes(symbol, periods)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus(`Deleted aggregated periods: ${periods.join(', ')}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  async function handleCleanLocalM1() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Cleaning invalid 1-minute data...')
    try {
      await cleanStoreV5DirectM1(symbol)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus('Local M1 cleaned and aligned with true M1 data.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  function handleAddM1ToStoreList() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreV5ListSymbols((current) => {
      const next = current.includes(symbol) ? current : [...current, symbol]
      saveStoreV5ListSymbols(next, storePanelPersistenceEnabled)
      return next
    })
  }

  function handleSetSelectedWatchlistLoaded(loaded: boolean) {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setWatchlistSymbols((current) => {
      const next = loaded
        ? current.includes(symbol) ? current : [...current, symbol]
        : current.filter((item) => item !== symbol)
      saveWatchlistSymbols(next)
      return next
    })
  }

  function handleSetShortcutMenuLoaded(loaded: boolean) {
    if (!loaded) {
      setShortcutMenuEnabled(false)
      saveShortcutMenuEnabled(false)
      return
    }

    if (selectedRow?.symbol && !watchlistSymbols.includes(selectedRow.symbol)) {
      setWatchlistSymbols((current) => {
        const next = current.includes(selectedRow.symbol) ? current : [...current, selectedRow.symbol]
        saveWatchlistSymbols(next)
        return next
      })
    }
    saveShortcutMenuPeriods([...watchlistDirectPeriods, ...watchlistAggregatedPeriods])
    setShortcutMenuEnabled(true)
    saveShortcutMenuEnabled(true)
  }

  function handleOpenStoreTableRow(row: StoreTableRow) {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const key = `${row.kind}-${row.period}`
    setSelectedStoreTableKey(key)
    savePersistedStoreTableSelection(symbol, key, storePanelPersistenceEnabled)
    publishSharedSelection(symbol, row.period)
    onOpenChart?.({
      symbol,
      period: row.period === 'M1' ? '1m' : row.period,
      totalRows: typeof row.rowsCount === 'number' && Number.isFinite(row.rowsCount) ? row.rowsCount : null,
    })
  }

  function handleOpenWatchlistPeriod(row: StoreTableRow) {
    handleOpenStoreTableRow(row)
  }

  function handleJumpChartToTime() {
    const timestamp = parseChartJumpTime(chartJumpInput)
    if (timestamp == null) {
      setChartJumpError('璇疯緭鍏?YYYY-MM-DD HH:mm')
      return
    }
    setChartJumpError('')
    onJumpChartToTime?.(timestamp)
  }

  function handleResetChartToLatest() {
    setChartJumpError('')
    onResetChartToLatest?.()
  }

  function toggleAggregatePeriod(period: string) {
    setSelectedAggregatePeriods((current) => (
      current.includes(period)
        ? current.filter((item) => item !== period)
        : [...current, period]
    ))
  }

  function toggleAllAggregatePeriods() {
    setSelectedAggregatePeriods((current) => (
      current.length === storeTableAggregatePeriods.length ? [] : [...storeTableAggregatePeriods]
    ))
  }

  function waitStoreV5AggregateJobBySse(jobId: string) {
    return new Promise<StoreV5AggregateJobPayload>((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        try {
          aggregateEventSourceRef.current?.close()
        } catch {
          // best effort
        }
        aggregateEventSourceRef.current = null
        fn()
      }
      const applyPayload = (event: MessageEvent) => {
        if (activeAggregateJobRef.current !== jobId) return null
        const payload = JSON.parse(event.data || '{}') as StoreV5AggregateJobPayload
        setAggregateProgress(payload)
        return payload
      }

      try {
        const source = createStoreV5AggregateEventSource(jobId)
        aggregateEventSourceRef.current = source
        source.addEventListener('progress', (event) => {
          try {
            applyPayload(event as MessageEvent)
          } catch {
            // ignore malformed progress
          }
        })
        source.addEventListener('done', (event) => {
          try {
            const payload = applyPayload(event as MessageEvent)
            finish(() => resolve(payload as StoreV5AggregateJobPayload))
          } catch (err) {
            finish(() => reject(err))
          }
        })
        source.addEventListener('cancelled', (event) => {
          try {
            applyPayload(event as MessageEvent)
          } catch {
            // ignore malformed cancelled payload
          }
          finish(() => reject(new Error('store_v5_aggregate_cancelled')))
        })
        source.addEventListener('error', (event) => {
          const messageEvent = event as MessageEvent
          if (messageEvent.data) {
            try {
              const payload = applyPayload(messageEvent)
              finish(() => reject(new Error(payload?.error || payload?.status || 'store_v5_aggregate_failed')))
              return
            } catch {
              // fall through to generic error
            }
          }
          if (!settled && activeAggregateJobRef.current === jobId) {
            finish(() => reject(new Error('store_v5_aggregate_sse_disconnected')))
          }
        })
      } catch (err) {
        finish(() => reject(err))
      }
    })
  }

  async function waitStoreV5AggregateJobByPolling(jobId: string) {
    while (activeAggregateJobRef.current === jobId) {
      await delay(600)
      const current = await fetchStoreV5AggregateJob(jobId)
      setAggregateProgress(current)
      if (current.phase === 'completed') return current
      if (current.phase === 'failed' || current.phase === 'cancelled') {
        throw new Error(current.error || current.status || current.phase)
      }
    }
    throw new Error('store_v5_aggregate_cancelled')
  }

  async function handleAggregateStore() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const periods = [...selectedAggregatePeriods]
    if (!selectedAggregatePeriods.length) {
      setStoreCheckError('Select at least one aggregated period.')
      return
    }
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress({
      ok: true,
      jobId: '',
      symbol,
      phase: 'running',
      status: 'store_v5_aggregate_running',
      periods,
      currentPeriod: periods[0],
      completed: 0,
      total: periods.length,
    })
    setStoreActionStatus('姝ｅ湪浠?M1 閲嶅缓鑱氬悎鍛ㄦ湡...')
    try {
      if (!canAggregateStoreV5) {
        setStoreActionStatus('姝ｅ湪鍏堟竻鐞嗘棤鏁?M1锛岀敓鎴?direct M1...')
        await cleanStoreV5DirectM1(symbol)
        const cleanedStatus = await fetchStoreV5Status(symbol)
        setLocalStoreStatus(cleanedStatus)
        savePersistedStoreV5Status(symbol, cleanedStatus, new Date().toISOString(), storePanelPersistenceEnabled)
        setStoreActionStatus('direct M1 宸茬敓鎴愶紝寮€濮嬭仛鍚?..')
      }
      const started = await startStoreV5AggregateJob(symbol, periods)
      activeAggregateJobRef.current = started.jobId
      setAggregateProgress(started)
      try {
        await waitStoreV5AggregateJobBySse(started.jobId)
      } catch (err) {
        if (activeAggregateJobRef.current !== started.jobId) throw err
        await waitStoreV5AggregateJobByPolling(started.jobId)
      }
      setAggregateProgress({
        ok: true,
        jobId: activeAggregateJobRef.current,
        symbol,
        phase: 'completed',
        status: 'store_v5_aggregate_completed',
        periods,
        completed: periods.length,
        total: periods.length,
      })
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus('')
      }, 1600)
      setStoreActionStatus('Aggregation complete. Store status refreshed.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setAggregateProgress((current) => current ? { ...current, phase: 'failed' } : null)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  return (
    <>
      <div className="ff-right-rail" aria-label="Right toolbar">
        <button
          className="ff-right-rail__button"
          data-active={activeDrawer === 'mt5'}
          onClick={() => onToggleDrawer('mt5')}
          title="MT5 Import Center"
          type="button"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="M43.5,14.9312c0,4.251-8.73,7.6971-19.5,7.6971S4.5,19.1822,4.5,14.9312,13.23,7.234,24,7.234,43.5,10.68,43.5,14.9312Z" />
            <path d="M43.5,23.9991c0,4.251-8.73,7.6971-19.5,7.6971S4.5,28.25,4.5,23.9991" />
            <path d="M43.5,33.0688c0,4.251-8.73,7.6972-19.5,7.6972S4.5,37.32,4.5,33.0688" />
            <path d="M4.5,33.0688v-9.07" />
            <path d="M43.5,33.0688v-9.07" />
            <path d="M43.5,23.9991v-9.07" />
            <path d="M4.5,24V14.93" />
          </svg>
        </button>
        <button
          className="ff-right-rail__button"
          data-active={activeDrawer === 'settings'}
          onClick={() => onToggleDrawer('settings')}
          title="Settings"
          type="button"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <polygon points="34.75 5.38 13.25 5.38 2.5 24 13.25 42.62 34.75 42.62 45.5 24 34.75 5.38" />
            <circle cx="24" cy="24" r="7.5" />
          </svg>
        </button>
      </div>

      <aside
        className="ff-right-drawer"
        data-open={open}
        aria-hidden={!open}
        style={{
          ['--ff-mt5-top-pane-height' as string]: `${topPaneHeight}px`,
        }}
      >
        <div
          className="ff-right-drawer__resize-handle"
          onDoubleClick={() => onResize(280)}
          onPointerDown={handleResizePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right panel"
          tabIndex={0}
        />

        <header className="ff-right-drawer__header">
          <h2>{activeDrawer === 'settings' ? 'Settings' : 'MT5 Import Center'}</h2>
          <button className="ff-right-drawer__close" onClick={onClose} type="button">
            x
          </button>
        </header>

        {activeDrawer === 'settings' ? (
          <div className="ff-settings-drawer__body">
            <div className="ff-import-selected-tabs ff-settings-tabs" role="tablist" aria-label="Settings panels">
              {settingsPanelTabs.map((tab) => (
                <button
                  aria-selected={selectedSettingsPanelTab === tab.key}
                  className="ff-import-selected-tabs__item ff-settings-tabs__item"
                  data-active={selectedSettingsPanelTab === tab.key}
                  key={tab.key}
                  onClick={() => setSelectedSettingsPanelTab(tab.key)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <section className="ff-settings-panel" role="tabpanel">
                {selectedSettingsPanelTab === 'symbol' && <SettingsSymbolPanel />}
                {selectedSettingsPanelTab === 'status' && <SettingsStatusPanel />}
                {selectedSettingsPanelTab === 'coordinates' && <SettingsCoordinatesPanel />}
                {selectedSettingsPanelTab !== 'symbol' && selectedSettingsPanelTab !== 'status' && selectedSettingsPanelTab !== 'coordinates' && (
                  <div className="ff-settings-empty-panel" />
                )}
              </section>
          </div>
        ) : (
        <div className="ff-right-drawer__body">
          <section className="ff-mt5-pane ff-mt5-pane--top">
            <form className="ff-import-toolbar" onSubmit={handleSearch}>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                value={query}
              />
              <button className="ff-import-toolbar__search" type="submit">Search</button>
              <button disabled={loading} onClick={() => loadSymbols(true)} type="button">
                {loading ? 'Scanning...' : 'Scan MT5'}
              </button>
            </form>

            <div className="ff-import-note" data-error={Boolean(error)}>
              {status}
            </div>

            <div className="ff-symbol-table-wrap" ref={tableWrapRef}>
              <table className="ff-symbol-table">
                <colgroup>
                  <col style={{ width: `${columnWidths.symbol}px` }} />
                  <col style={{ width: `${columnWidths.name}px` }} />
                  <col style={{ width: `${columnWidths.type}px` }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th>
                      浜ゆ槗鍝佺
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('symbol')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'symbol')}
                      />
                    </th>
                    <th>
                      涓枃鍚嶇О
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('name')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'name')}
                      />
                    </th>
                    <th>
                      绫诲瀷
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('type')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'type')}
                      />
                    </th>
                    <th>
                      鎻忚堪
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSymbols.map((row) => {
                    const display = resolveMt5SymbolDisplay(row)
                    return (
                      <tr
                        data-selected={selectedSymbol === row.symbol}
                        key={row.symbol}
                        onClick={() => handleSelectSymbol(row.symbol)}
                        tabIndex={0}
                      >
                        <td title={row.symbol}>{row.symbol}</td>
                        <td title={display.chineseName}>{display.chineseName}</td>
                        <td title={display.assetType}>{display.assetType}</td>
                        <td title={display.description || row.description || row.name || row.path || '-'}>
                          {display.description || row.description || row.name || row.path || '-'}
                        </td>
                      </tr>
                    )
                  })}
                  {!visibleSymbols.length && (
                    <tr>
                      <td className="ff-symbol-table__empty" colSpan={4}>
                        {loading ? 'Scanning MT5 symbols...' : 'No symbols. Click Scan MT5.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div
            className="ff-mt5-pane-splitter"
            onDoubleClick={() => setTopPaneHeight(430)}
            onPointerDown={handleSplitPointerDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize MT5 panel split"
            tabIndex={0}
          />

          <section className="ff-mt5-pane ff-mt5-pane--bottom" aria-label="MT5 lower workspace">
            {selectedRow && selectedDisplay && (
              <section className="ff-import-selected" aria-label="Selected MT5 symbol">
                <div className="ff-import-selected-head">
                  <div className="ff-import-selected-head__text">
                    <h3>{selectedRow.symbol} · {selectedDisplay.chineseName}</h3>
                    <p>{selectedDisplay.assetType}</p>
                  </div>
                  <div className="ff-import-selected-head__actions">
                    <div className="ff-import-load-row">
                      <span>添加自选列表：</span>
                      <div className="ff-import-load-switch" aria-label="添加自选列表">
                        <button
                          data-active={selectedIsInWatchlist}
                          onClick={() => handleSetSelectedWatchlistLoaded(true)}
                          type="button"
                        >
                          Load
                        </button>
                        <button
                          data-active={!selectedIsInWatchlist}
                          onClick={() => handleSetSelectedWatchlistLoaded(false)}
                          type="button"
                        >
                          Unload
                        </button>
                      </div>
                    </div>
                    <div className="ff-import-load-row">
                      <span>添加快捷菜单：</span>
                      <div className="ff-import-load-switch" aria-label="添加快捷菜单">
                        <button
                          data-active={shortcutMenuEnabled}
                          onClick={() => handleSetShortcutMenuLoaded(true)}
                          type="button"
                        >
                          Load
                        </button>
                        <button
                          data-active={!shortcutMenuEnabled}
                          onClick={() => handleSetShortcutMenuLoaded(false)}
                          type="button"
                        >
                          Unload
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ff-import-selected-tabs" role="tablist" aria-label="MT5 symbol panels">
                  {selectedPanelTabs.map((tab) => (
                    <button
                      aria-selected={selectedPanelTab === tab.key}
                      className="ff-import-selected-tabs__item"
                      data-active={selectedPanelTab === tab.key}
                      key={tab.key}
                      onClick={() => setSelectedPanelTab(tab.key)}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {selectedPanelTab === 'details' && (
                  <div className="ff-import-selected-detail" role="tabpanel">
                    {selectedDetailRows(selectedRow).map(([leftLabel, leftValue, rightLabel, rightValue]) => (
                      <div
                        className="ff-import-selected-detail__row"
                        data-wide={rightLabel == null}
                        key={`${leftLabel}-${rightLabel ?? 'wide'}`}
                      >
                        <span>{leftLabel}</span>
                        {rightLabel == null ? (
                          <strong
                            className="ff-import-selected-detail__wide-value"
                            title={formatDetailValue(leftValue)}
                          >
                            {formatDetailValue(leftValue)}
                          </strong>
                        ) : (
                          <>
                            <strong title={formatDetailValue(leftValue)}>{formatDetailValue(leftValue)}</strong>
                            <span>{rightLabel}</span>
                            <strong title={formatDetailValue(rightValue)}>{formatDetailValue(rightValue)}</strong>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedPanelTab === 'store' && (
                  <div className="ff-import-store-panel" role="tabpanel">
                    <section className="ff-store-card ff-store-card--direct">
                      <label className="ff-store-persistence-toggle">
                        <input
                          checked={storePanelPersistenceEnabled}
                          onChange={(event) => handleToggleStorePanelPersistence(event.target.checked)}
                          type="checkbox"
                        />
                        <span>持久化</span>
                      </label>
                      <div className="ff-store-direct-summary">
                        <strong>本地仓库 M1</strong>
                        {storeCheck?.directM1 ? (
                          <>
                            <span>MT5 条数：{formatCount(storeCheck.directM1.mt5RowsCount)}</span>
                            <span>真实条数：{formatCount(storeCheck.directM1.trueM1RowsCount)} · 最后检查：{formatCheckTime(mt5M1LastCheckedAt)}</span>
                            <span>
                              真实 M1 范围：{formatUtcRange(storeCheck.directM1.firstTimeText, storeCheck.directM1.lastTimeText)}
                            </span>
                            {storeCheck.directM1.validationError && (
                              <span className="ff-store-direct-summary__error">
                                校验失败：{storeCheck.directM1.validationError}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span>MT5 条数：-</span>
                            <span>真实条数：-</span>
                            <span>真实 M1 范围：-</span>
                          </>
                        )}
                        <span>
                          本地 M1 数据：{localStoreStatus?.directM1?.rowsCount != null
                            ? `${formatCount(localStoreStatus.directM1.rowsCount)} 条 · 最后更新时间：${formatCheckTime(localStoreStatus.directM1.lastImportAt)}`
                            : '无数据'}
                        </span>
                        {storeCheckError && (
                          <span className="ff-store-direct-summary__error">{storeCheckError}</span>
                        )}
                      </div>
                    </section>

                    {storeOperationLine && (
                      <div className="ff-store-status-line">
                        <div className="ff-store-status-line__row">
                          <span>{storeOperationLine}</span>
                          {m1CheckJob?.jobId && (
                            <button onClick={handleCancelMt5M1Check} type="button">鍙栨秷</button>
                          )}
                          {pullProgress?.jobId && pullProgress.phase !== 'completed' && (
                            <button onClick={handleCancelPullStore} type="button">鍙栨秷</button>
                          )}
                        </div>
                        {storeOperationProgress && (
                          <div
                            className="ff-store-status-line__bar"
                            data-estimated={storeOperationProgress.hasEstimate}
                            aria-hidden="true"
                          >
                            <span style={{ width: `${storeOperationProgress.width}%` }} />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="ff-store-direct-actions">
                      <button disabled={storeCheckLoading} onClick={handleCheckMt5M1Staged} type="button">
                        {isCheckingMt5M1 ? '检查中' : '检查 MT5 数据'}
                      </button>
                      <button disabled={storeCheckLoading} onClick={handleRefreshStoreStatus} type="button">检查本地仓库</button>
                      <button disabled={storeCheckLoading} onClick={handlePullStore} type="button">
                        {isPullingStoreV5 ? '拉取中' : '拉取'}
                      </button>
                      <button disabled={storeCheckLoading} onClick={handleDeleteLocalStore} type="button">删除本地数据</button>
                      <button disabled={storeCheckLoading} onClick={handleCleanLocalM1} type="button">清理无效 M1</button>
                      <button disabled={storeCheckLoading} onClick={handleAddM1ToStoreList} type="button">加入列表</button>
                    </div>
                    <table className="ff-store-detail-table ff-store-aggregate-table">
                      <thead>
                        <tr>
                          <th>周期</th>
                          <th>条数</th>
                          <th>最后K线</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleStoreTableRows.map((row) => (
                          <tr
                            data-selected={selectedStoreTableKeyIsVisible && selectedStoreTableKey === `${row.kind}-${row.period}`}
                            key={`${row.kind}-${row.period}`}
                            onClick={() => handleOpenStoreTableRow(row)}
                          >
                            <td>
                              {row.kind === 'aggregate' ? (
                                <label className="ff-store-period-check" onClick={(event) => event.stopPropagation()}>
                                  <input
                                    checked={selectedAggregatePeriods.includes(row.period)}
                                    disabled={storeCheckLoading}
                                    onChange={() => toggleAggregatePeriod(row.period)}
                                    type="checkbox"
                                  />
                                  <strong>{row.period}</strong>
                                </label>
                              ) : (
                                <strong>{row.period}</strong>
                              )}
                            </td>
                            <td>{row.count}</td>
                            <td>{row.updated}</td>
                          </tr>
                        ))}
                        {!visibleStoreTableRows.length && (
                          <tr>
                            <td className="ff-symbol-table__empty" colSpan={3}>
                              鏆傛棤 StoreV5 鑱氬悎鍛ㄦ湡銆傝鍏堟媺鍙?M1锛屽啀鎵ц鑱氬悎銆?                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <div className="ff-store-direct-actions ff-store-direct-actions--aggregate">
                      <button
                        data-state={
                          selectedAggregatePeriods.length === 0
                            ? 'none'
                            : selectedAggregatePeriods.length === storeTableAggregatePeriods.length
                              ? 'all'
                              : 'mixed'
                        }
                        disabled={storeCheckLoading}
                        onClick={toggleAllAggregatePeriods}
                        type="button"
                      >
                        {selectedAggregatePeriods.length === storeTableAggregatePeriods.length ? '全不选' : '全选'}
                      </button>
                      <button disabled={storeCheckLoading} onClick={handleRefreshStoreStatus} type="button">
                        {storeCheckLoading ? '刷新中' : '刷新仓库'}
                      </button>
                      <button disabled={storeCheckLoading || selectedAggregatePeriods.length === 0} onClick={handleDeleteSelectedAggregates} type="button">删除</button>
                      <button
                        disabled={storeCheckLoading || selectedAggregatePeriods.length === 0}
                        onClick={handleAggregateStore}
                        title={!canAggregateStoreV5 ? '浼氬厛鑷姩娓呯悊鏃犳晥 M1锛屽啀鑱氬悎' : undefined}
                        type="button"
                      >
                        鑱氬悎
                      </button>
                    </div>

                    <div className="ff-chart-jump-controls">
                      <input
                        aria-label="璺宠浆鏃ユ湡鏃堕棿"
                        onChange={(event) => {
                          setChartJumpInput(event.target.value)
                          setChartJumpError('')
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleJumpChartToTime()
                          }
                        }}
                        placeholder="YYYY-MM-DD HH:mm"
                        type="text"
                        value={chartJumpInput}
                      />
                      <button onClick={handleJumpChartToTime} type="button">璺宠浆</button>
                      <button onClick={handleResetChartToLatest} type="button">鍥炲埌褰撳墠</button>
                      <button onClick={() => onLoadChartStep?.('left')} type="button">鍚戝乏10000</button>
                      <button onClick={() => onLoadChartStep?.('right')} type="button">鍚戝彸10000</button>
                      {chartJumpError && <span>{chartJumpError}</span>}
                    </div>

                    <div className="ff-chart-load-status">
                      {formatChartLoadStatus(chartLoadState)}
                    </div>

                  </div>
                )}

                {selectedPanelTab === 'watchlist' && (
                  <div className="ff-import-watchlist-panel" role="tabpanel">
                    <div
                      className="ff-watchlist-table-wrap"
                      style={{ height: `${watchlistTableHeight}px` }}
                    >
                      <table className="ff-watchlist-table" aria-label="Watchlist">
                        <thead>
                          <tr>
                            <th>SYMBOL</th>
                            <th>涓枃鍚嶇О</th>
                            <th>璧勪骇绫诲瀷</th>
                            <th>LAST</th>
                            <th>CHG</th>
                            <th>CHG%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {watchlistRows.map((row) => {
                            const display = resolveMt5SymbolDisplay(row)
                            const tick = watchlistTicks[row.symbol]
                            return (
                              <tr
                                data-selected={selectedSymbol === row.symbol}
                                data-realtime={watchlistRealtimeEnabled && tick ? 'true' : 'false'}
                                key={row.symbol}
                                onClick={() => handleSelectSymbol(row.symbol)}
                                tabIndex={0}
                              >
                                <td title={row.symbol}>{row.symbol}</td>
                                <td title={display.chineseName}>{display.chineseName}</td>
                                <td title={display.assetType}>{display.assetType}</td>
                                <td title={tick?.publishedAt ?? ''}>{formatMarketPrice(tick?.last)}</td>
                                <td data-direction={(tick?.change ?? 0) > 0 ? 'up' : (tick?.change ?? 0) < 0 ? 'down' : 'flat'}>
                                  {formatMarketChange(tick?.change)}
                                </td>
                                <td data-direction={(tick?.changePercent ?? 0) > 0 ? 'up' : (tick?.changePercent ?? 0) < 0 ? 'down' : 'flat'}>
                                  {formatMarketPercent(tick?.changePercent)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div
                      className="ff-watchlist-table-splitter"
                      onDoubleClick={() => {
                        setWatchlistTableHeight(228)
                        try {
                          window.localStorage.setItem(watchlistTableHeightStorageKey, '228')
                        } catch {
                          // Watchlist table height persistence is best-effort only.
                        }
                      }}
                      onPointerDown={handleWatchlistTableResizePointerDown}
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize watchlist table"
                      tabIndex={0}
                    />
                    {(watchlistDirectPeriods.length > 0 || watchlistAggregatedPeriods.length > 0) && (
                      <div className="ff-watchlist-periods" aria-label="Watchlist available periods">
                        {watchlistDirectPeriods.length > 0 && (
                          <section className="ff-watchlist-periods__group">
                            <h4>Direct source</h4>
                            <div className="ff-watchlist-periods__buttons">
                              {watchlistDirectPeriods.map((row) => (
                                <button
                                  data-active={selectedStoreTableKey === `${row.kind}-${row.period}`}
                                  key={`${row.kind}-${row.period}`}
                                  onClick={() => handleOpenWatchlistPeriod(row)}
                                  title={`${row.period} 路 ${row.count} 鏉?路 ${row.updated}`}
                                  type="button"
                                >
                                  {row.period}
                                </button>
                              ))}
                            </div>
                          </section>
                        )}
                        {watchlistAggregatedPeriods.length > 0 && (
                          <section className="ff-watchlist-periods__group">
                            <h4>Aggregated source</h4>
                            <div className="ff-watchlist-periods__buttons">
                              {watchlistAggregatedPeriods.map((row) => (
                                <button
                                  data-active={selectedStoreTableKey === `${row.kind}-${row.period}`}
                                  key={`${row.kind}-${row.period}`}
                                  onClick={() => handleOpenWatchlistPeriod(row)}
                                  title={`${row.period} 路 ${row.count} 鏉?路 ${row.updated}`}
                                  type="button"
                                >
                                  {row.period}
                                </button>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>
                    )}
                    <div className="ff-watchlist-realtime-controls">
                      <button
                        className="ff-watchlist-realtime-toggle"
                        data-active={watchlistRealtimeEnabled}
                        data-ready={watchlistRealtimeReady}
                        onClick={() => setWatchlistRealtimeEnabled((current) => !current)}
                        type="button"
                        aria-pressed={watchlistRealtimeEnabled}
                      >
                        <span>{watchlistRealtimeEnabled && !watchlistRealtimeReady ? 'Syncing' : 'Realtime'}</span>
                        <i aria-hidden="true" />
                      </button>
                      {watchlistRealtimeStatus && (
                        <span className="ff-watchlist-realtime-status">
                          {watchlistRealtimeStatus || 'Live'}
                          {watchlistLastTickAt ? ` 路 ${watchlistLastTickAt}` : ''}
                        </span>
                      )}
                    </div>
                    {watchlistRealtimeLog.length > 0 && (
                      <div className="ff-watchlist-realtime-log" aria-label="Realtime sync log">
                        <div className="ff-watchlist-realtime-log__title">
                          {watchlistRealtimeReady ? 'Realtime Feed' : 'Realtime Sync'}
                        </div>
                        <div className="ff-watchlist-realtime-log__body">
                          {watchlistRealtimeLog.map((line, index) => (
                            <div key={`${line}-${index}`}>{line}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
        )}
      </aside>
    </>
  )
}
