const DOC_KEY = '__ffChartColorPalettePopoverV1'

export function getChartColorPalettePopoverStateV1(doc) {
  if (!doc[DOC_KEY]) {
    doc[DOC_KEY] = {
      el: null,
      anchor: null,
      onDocDown: null,
      onKey: null,
      onReposition: null,
      finalize: null,
    }
  }
  return doc[DOC_KEY]
}

export function closeChartColorPalettePopoverV1(doc) {
  const st = doc?.[DOC_KEY]
  if (!st?.el) return
  const fin = st.finalize
  st.finalize = null
  if (typeof fin === 'function') {
    try {
      fin()
    } catch {
      /* ignore */
    }
  }
  if (st.onDocDown) {
    doc.removeEventListener('mousedown', st.onDocDown, true)
    st.onDocDown = null
  }
  if (st.onKey) {
    doc.removeEventListener('keydown', st.onKey, true)
    st.onKey = null
  }
  if (st.onReposition) {
    window.removeEventListener('scroll', st.onReposition, true)
    window.removeEventListener('resize', st.onReposition)
    st.onReposition = null
  }
  if (st.anchor) {
    try {
      st.anchor.removeAttribute('data-open')
      st.anchor.setAttribute('aria-expanded', 'false')
    } catch {
      /* ignore */
    }
  }
  st.el.remove()
  st.el = null
  st.anchor = null
}
