export function positionChartColorPalettePopoverV1(el, anchor) {
  const r = anchor.getBoundingClientRect()
  const pad = 0
  let top = r.bottom + pad
  let left = r.left
  const w = el.offsetWidth || 236
  const h = el.offsetHeight || 320
  if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8
  if (left < 8) left = 8
  if (top + h > window.innerHeight - 8) top = r.top - h - pad
  if (top < 8) top = 8
  el.style.left = `${Math.round(left)}px`
  el.style.top = `${Math.round(top)}px`
}

export function setChartColorPaletteSvPlaneBackgroundV1(svEl, hueDeg) {
  const h = ((hueDeg % 360) + 360) % 360
  svEl.style.background = [
    'linear-gradient(to top, #000, rgba(0,0,0,0))',
    `linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`,
  ].join(', ')
}
