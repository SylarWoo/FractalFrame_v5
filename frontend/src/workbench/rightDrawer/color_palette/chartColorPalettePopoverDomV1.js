export function createChartColorPalettePopoverShellV1(doc) {
  const root = doc.createElement('div')
  root.className = 'ff-chart-color-palette-popover-v1'
  root.setAttribute('data-testid', 'chart-color-palette-popover-v1')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', '调色板')

  const column = doc.createElement('div')
  column.className = 'ff-chart-color-palette-popover-v1__column'

  const presetsStack = doc.createElement('div')
  presetsStack.className = 'ff-chart-color-palette-popover-v1__presets-stack'

  const tabBar = doc.createElement('div')
  tabBar.className = 'ff-chart-color-palette-popover-v1__tabs'

  const tabPreset = doc.createElement('button')
  tabPreset.type = 'button'
  tabPreset.className = 'ff-chart-color-palette-popover-v1__tab'
  tabPreset.textContent = '色板'
  tabPreset.setAttribute('data-active', 'true')

  const tabCustom = doc.createElement('button')
  tabCustom.type = 'button'
  tabCustom.className = 'ff-chart-color-palette-popover-v1__tab'
  tabCustom.textContent = '自选颜色'
  tabCustom.setAttribute('data-active', 'false')

  const customPane = doc.createElement('div')
  customPane.className = 'ff-chart-color-palette-popover-v1__custom-pane'
  customPane.dataset.visible = 'false'

  return { root, column, presetsStack, tabBar, tabPreset, tabCustom, customPane }
}

export function createChartColorPaletteGridV1(doc) {
  const grid = doc.createElement('div')
  grid.className = 'ff-chart-color-palette-popover-v1__grid'
  return grid
}

export function createChartColorPaletteSwatchButtonV1(doc, hex) {
  const button = doc.createElement('button')
  button.type = 'button'
  button.className = 'ff-chart-color-palette-popover-v1__sw'
  button.style.background = hex
  button.title = hex
  return button
}

export function createChartColorPaletteCustomRowV1(doc) {
  const row = doc.createElement('div')
  row.className = 'ff-chart-color-palette-popover-v1__custom-row'
  return row
}

export function createChartColorPaletteCustomAddButtonV1(doc) {
  const button = doc.createElement('button')
  button.type = 'button'
  button.className = 'ff-chart-color-palette-popover-v1__custom-add'
  button.title = '加入常用色'
  button.textContent = '+'
  button.setAttribute('data-active', 'false')
  return button
}

export function createChartColorPaletteSettingRowV1(doc, labelText) {
  const row = doc.createElement('div')
  row.className = 'ff-chart-color-palette-popover-v1__row'
  const label = doc.createElement('div')
  label.className = 'ff-chart-color-palette-popover-v1__label'
  label.textContent = labelText
  return { row, label }
}

export function createChartColorPaletteSegmentV1(doc) {
  const segment = doc.createElement('div')
  segment.className = 'ff-chart-color-palette-popover-v1__seg'
  return segment
}

export function createChartColorPaletteSegmentButtonV1(doc, className = '') {
  const button = doc.createElement('button')
  button.type = 'button'
  const line = doc.createElement('span')
  line.className = `ff-chart-color-palette-popover-v1__seg-line ${className}`.trim()
  button.appendChild(line)
  return { button, line }
}

export function createChartColorPaletteOpacityControlsV1(doc, opacity) {
  const wrap = doc.createElement('div')
  wrap.className = 'ff-chart-color-palette-popover-v1__opacity'

  const range = doc.createElement('input')
  range.type = 'range'
  range.min = '0'
  range.max = '100'
  range.value = String(Math.round(opacity * 100))

  const numberInput = doc.createElement('input')
  numberInput.className = 'ff-chart-color-palette-popover-v1__opacity-val'
  numberInput.type = 'text'
  numberInput.inputMode = 'numeric'
  numberInput.value = `${Math.round(opacity * 100)}%`

  wrap.append(range, numberInput)
  return { wrap, range, numberInput }
}

export function createChartColorPaletteCustomPickerDomV1(doc) {
  const hexRow = doc.createElement('div')
  hexRow.className = 'ff-chart-color-palette-popover-v1__hex-row'

  const hexPreview = doc.createElement('span')
  hexPreview.className = 'ff-chart-color-palette-popover-v1__hex-preview'

  const hexInput = doc.createElement('input')
  hexInput.className = 'ff-chart-color-palette-popover-v1__hex-input'
  hexInput.type = 'text'
  hexInput.spellcheck = false
  hexInput.autocomplete = 'off'
  hexInput.maxLength = 7

  const hexAdd = doc.createElement('button')
  hexAdd.type = 'button'
  hexAdd.className = 'ff-chart-color-palette-popover-v1__hex-add'
  hexAdd.textContent = '增加'

  const svWrap = doc.createElement('div')
  svWrap.className = 'ff-chart-color-palette-popover-v1__sv-wrap'

  const sv = doc.createElement('div')
  sv.className = 'ff-chart-color-palette-popover-v1__sv'

  const svCursor = doc.createElement('div')
  svCursor.className = 'ff-chart-color-palette-popover-v1__sv-cursor'
  sv.appendChild(svCursor)

  const hue = doc.createElement('div')
  hue.className = 'ff-chart-color-palette-popover-v1__hue'

  const hueCursor = doc.createElement('div')
  hueCursor.className = 'ff-chart-color-palette-popover-v1__hue-cursor'
  hue.appendChild(hueCursor)

  svWrap.append(sv, hue)
  hexRow.append(hexPreview, hexInput, hexAdd)

  return { hexRow, hexPreview, hexInput, hexAdd, svWrap, sv, svCursor, hue, hueCursor }
}
