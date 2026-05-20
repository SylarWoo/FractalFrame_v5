import { chartColorSwatchHostCssV1 } from './chartColorSwatchStylesV1.js'

const STYLE_ID = 'ff-chart-color-palette-popover-v1-style'

export function ensureChartColorPaletteStyles(doc) {
  if (!doc?.head) return
  let style = doc.getElementById(STYLE_ID)
  if (!style) {
    style = doc.createElement('style')
    style.id = STYLE_ID
    doc.head.appendChild(style)
  }
  style.textContent = `
.ff-chart-color-palette-popover-v1 {
  position: fixed;
  z-index: 50000;
  width: 256px;
  box-sizing: border-box;
  padding: 10px 10px 8px;
  border: 1px solid #d1d4dc;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #131722;
}
.ff-chart-color-palette-popover-v1__column {
  width: 236px;
  margin: 0 auto;
  box-sizing: border-box;
}
.ff-chart-color-palette-popover-v1__tabs {
  display: flex;
  gap: 3px;
  margin-bottom: 8px;
}
.ff-chart-color-palette-popover-v1__tab {
  flex: 1 1 0;
  margin: 0;
  padding: 5px 2px;
  border: 1px solid #d1d4dc;
  border-radius: 4px;
  background: #f8fafc;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  min-width: 0;
}
.ff-chart-color-palette-popover-v1__tab[data-active='true'] {
  background: #e0e3eb;
  color: #131722;
  border-color: #d1d4dc;
  box-shadow: none;
}
.ff-chart-color-palette-popover-v1__tab:focus,
.ff-chart-color-palette-popover-v1__tab:focus-visible {
  outline: none;
  border-color: #d1d4dc;
  box-shadow: none;
}
.ff-chart-color-palette-popover-v1__grid {
  display: grid;
  grid-template-columns: repeat(10, 18px);
  gap: 6px;
  margin-bottom: 8px;
}
.ff-chart-color-palette-popover-v1__sw {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid rgba(19,23,34,0.12);
  border-radius: 2px;
  cursor: pointer;
  box-sizing: border-box;
}
.ff-chart-color-palette-popover-v1__sw[data-active='true'] {
  outline: 2px solid #131722;
  outline-offset: 2px;
}
.ff-chart-color-palette-popover-v1__custom-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding-top: 6px;
  border-top: 1px solid #e0e3eb;
}
.ff-chart-color-palette-popover-v1__custom-add {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px dashed #94a3b8;
  border-radius: 5px;
  background: #fff;
  color: #64748b;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.ff-chart-color-palette-popover-v1__custom-add:hover {
  border-color: #2962ff;
  color: #2962ff;
}
.ff-chart-color-palette-popover-v1__row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e3eb;
}
.ff-chart-color-palette-popover-v1__row--tight {
  margin-top: 6px;
  padding-top: 6px;
}
.ff-chart-color-palette-popover-v1__row:first-of-type {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
.ff-chart-color-palette-popover-v1__label {
  flex: 0 0 48px;
  color: #787b86;
  font-size: 11px;
}
.ff-chart-color-palette-popover-v1__opacity {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ff-chart-color-palette-popover-v1__opacity input[type='range'] {
  flex: 1 1 auto;
  min-width: 0;
  height: 4px;
  accent-color: #2962ff;
}
.ff-chart-color-palette-popover-v1__opacity-val {
  flex: 0 0 40px;
  width: 40px;
  box-sizing: border-box;
  padding: 3px 4px;
  border: 1px solid #d1d4dc;
  border-radius: 5px;
  font-size: 11px;
  text-align: right;
}
.ff-chart-color-palette-popover-v1__seg {
  flex: 1 1 auto;
  display: flex;
  border: 1px solid #d1d4dc;
  border-radius: 4px;
  overflow: hidden;
}
.ff-chart-color-palette-popover-v1__seg button {
  flex: 1 1 0;
  margin: 0;
  height: 20px;
  min-height: 20px;
  padding: 0;
  border: 0;
  border-right: 1px solid #d1d4dc;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ff-chart-color-palette-popover-v1__seg button:last-child { border-right: 0; }
.ff-chart-color-palette-popover-v1__seg button[data-active='true'] {
  background: #e0e3eb;
}
.ff-chart-color-palette-popover-v1__seg-line {
  display: block;
  width: 70%;
  height: 0;
  border-bottom: 1px solid #131722;
  border-radius: 1px;
}
.ff-chart-color-palette-popover-v1__seg-line--dash {
  border-bottom-style: dashed;
  border-bottom-width: 2px;
}
.ff-chart-color-palette-popover-v1__seg-line--dot {
  border-bottom-style: dotted;
  border-bottom-width: 2px;
}
.ff-chart-color-palette-popover-v1__custom-pane {
  display: none;
  flex-direction: column;
  gap: 8px;
}
.ff-chart-color-palette-popover-v1__custom-pane[data-visible='true'] {
  display: flex;
}
.ff-chart-color-palette-popover-v1__hex-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ff-chart-color-palette-popover-v1__hex-preview {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid #d1d4dc;
  flex-shrink: 0;
}
.ff-chart-color-palette-popover-v1__hex-input {
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  padding: 5px 6px;
  border: 1px solid #d1d4dc;
  border-radius: 6px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
}
.ff-chart-color-palette-popover-v1__hex-add {
  flex: 0 0 auto;
  margin: 0;
  padding: 5px 6px;
  border: 0;
  border-radius: 4px;
  background: #131722;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}
.ff-chart-color-palette-popover-v1__sv-wrap {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.ff-chart-color-palette-popover-v1__sv {
  position: relative;
  flex: 1 1 auto;
  height: 120px;
  border-radius: 4px;
  border: 1px solid #d1d4dc;
  cursor: crosshair;
  touch-action: none;
  overflow: hidden;
}
.ff-chart-color-palette-popover-v1__sv-cursor {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: 0 0 0 1px #131722;
  pointer-events: none;
}
.ff-chart-color-palette-popover-v1__hue {
  position: relative;
  flex: 0 0 14px;
  border-radius: 4px;
  border: 1px solid #d1d4dc;
  cursor: ns-resize;
  touch-action: none;
  background: linear-gradient(
    to bottom,
    #f00 0%,
    #ff0 17%,
    #0f0 33%,
    #0ff 50%,
    #00f 67%,
    #f0f 83%,
    #f00 100%
  );
}
.ff-chart-color-palette-popover-v1__hue-cursor {
  position: absolute;
  left: -5px;
  width: 22px;
  height: 4px;
  margin-top: -2px;
  border: 1px solid #131722;
  border-radius: 2px;
  background: rgba(255,255,255,0.9);
  pointer-events: none;
}
${chartColorSwatchHostCssV1}
`
}
