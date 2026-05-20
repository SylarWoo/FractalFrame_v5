export function markChartColorPaletteAnchorOpenV1(anchorEl) {
  try {
    anchorEl.setAttribute('data-open', 'true')
    anchorEl.setAttribute('aria-expanded', 'true')
  } catch {
    /* ignore */
  }
}
