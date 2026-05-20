export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

export function normalizeHex6(raw) {
  const s = String(raw || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const a = s.slice(1)
    return `#${a[0]}${a[0]}${a[1]}${a[1]}${a[2]}${a[2]}`.toLowerCase()
  }
  return '#787b86'
}

export function hexToRgb(hex) {
  const h = normalizeHex6(hex).slice(1)
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex(r, g, b) {
  const x = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${x(r)}${x(g)}${x(b)}`
}

export function blendHexOnWhite(fgHex, opacity) {
  const a = clamp(Number(opacity) || 0, 0, 1)
  const { r, g, b } = hexToRgb(fgHex)
  const br = 255 * (1 - a) + r * a
  const bg = 255 * (1 - a) + g * a
  const bb = 255 * (1 - a) + b * a
  return rgbToHex(br, bg, bb)
}

const FF_CHECKER_GRAY = '#7f8794'

export function checkerboardSvgDataUrl(tilePx = 12) {
  const z = tilePx / 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tilePx}" height="${tilePx}">` +
    `<rect fill="${FF_CHECKER_GRAY}" width="${z}" height="${z}"/>` +
    `<rect fill="${FF_CHECKER_GRAY}" x="${z}" y="${z}" width="${z}" height="${z}"/>` +
    `<rect fill="#ffffff" x="${z}" width="${z}" height="${z}"/>` +
    `<rect fill="#ffffff" y="${z}" width="${z}" height="${z}"/>` +
    `</svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}

export function clearOpacityPreviewLayers(el) {
  if (!el?.style) return
  el.style.backgroundImage = ''
  el.style.backgroundSize = ''
  el.style.backgroundPosition = ''
  el.style.backgroundRepeat = ''
  el.style.backgroundClip = ''
  el.style.backgroundOrigin = ''
}

export function setOpacityPreviewWithCheckerboard(el, chromaHex, opacity) {
  if (!el?.style) return
  const opacityNumber = Number(opacity)
  const op = clamp(Number.isFinite(opacityNumber) ? opacityNumber : 1, 0, 1)
  const chroma = normalizeHex6(chromaHex)
  if (op >= 0.999) {
    clearOpacityPreviewLayers(el)
    el.style.backgroundColor = chroma
    return
  }
  const { r, g, b } = hexToRgb(chroma)
  const tile = 12
  el.style.backgroundColor = '#ffffff'
  el.style.backgroundImage = `linear-gradient(rgba(${r},${g},${b},${op}), rgba(${r},${g},${b},${op})), ${checkerboardSvgDataUrl(tile)}`
  el.style.backgroundSize = `100% 100%, ${tile}px ${tile}px`
  el.style.backgroundPosition = '0 0, 0 0'
  el.style.backgroundRepeat = 'no-repeat, repeat'
}

export function rgbToHsv(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d > 1e-8) {
    if (max === rn) h = 60 * (((gn - bn) / d + 6) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / d + 2)
    else h = 60 * ((rn - gn) / d + 4)
  }
  const s = max === 0 ? 0 : d / max
  const v = max
  return { h, s, v }
}

export function hsvToRgbHex(h, s, v) {
  const hh = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (hh < 60) {
    rp = c
    gp = x
  } else if (hh < 120) {
    rp = x
    gp = c
  } else if (hh < 180) {
    gp = c
    bp = x
  } else if (hh < 240) {
    gp = x
    bp = c
  } else if (hh < 300) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }
  return rgbToHex((rp + m) * 255, (gp + m) * 255, (bp + m) * 255)
}

export function lineStyleUiToLw(ui) {
  if (ui === 'dashed') return 2
  if (ui === 'dotted') return 1
  return 0
}

export function lineStyleLwToUi(n) {
  const v = Number(n)
  if (v === 2) return 'dashed'
  if (v === 1) return 'dotted'
  return 'solid'
}

export function applySwatchLineBarPreviewV1(barEl, colorHex, thicknessStep, lineStyleUi) {
  if (!barEl || typeof colorHex !== 'string') return
  const color = /^#[0-9a-fA-F]{6}$/.test(colorHex.trim()) ? normalizeHex6(colorHex) : '#2563eb'
  const t = Math.round(Number(thicknessStep))
  const px = Number.isFinite(t) ? Math.min(8, Math.max(1, t)) : 2
  const ui = lineStyleUi === 'dashed' || lineStyleUi === 'dotted' ? lineStyleUi : 'solid'
  const borderStyle = ui === 'dashed' ? 'dashed' : ui === 'dotted' ? 'dotted' : 'solid'
  barEl.style.boxSizing = 'border-box'
  barEl.style.backgroundColor = 'transparent'
  barEl.style.backgroundImage = 'none'
  barEl.style.height = '0'
  barEl.style.minHeight = '0'
  barEl.style.maxHeight = 'none'
  barEl.style.border = 'none'
  barEl.style.borderBottom = `${px}px ${borderStyle} ${color}`
}

export function hslToHex(h, s, l) {
  const hh = ((Number(h) % 360) + 360) % 360
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2
  let rp = 0
  let gp = 0
  let bp = 0
  if (hh < 60) {
    rp = c
    gp = x
  } else if (hh < 120) {
    rp = x
    gp = c
  } else if (hh < 180) {
    gp = c
    bp = x
  } else if (hh < 240) {
    gp = x
    bp = c
  } else if (hh < 300) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }
  return rgbToHex((rp + m) * 255, (gp + m) * 255, (bp + m) * 255)
}

export function buildPresetGrid() {
  const grays = [
    '#ffffff',
    '#f0f3fa',
    '#e0e3eb',
    '#d1d4dc',
    '#b2b5be',
    '#787b86',
    '#555965',
    '#434651',
    '#2a2e39',
    '#131722',
  ]
  const rows = [grays]
  const hues = [0, 28, 48, 158, 198, 218, 265, 305, 330, 355]
  for (let li = 0; li < 5; li += 1) {
    const l = 92 - li * 16
    const row = hues.map((h) => {
      const s = li === 0 ? 55 : 70
      return hslToHex(h, s, l)
    })
    rows.push(row)
  }
  return rows
}
