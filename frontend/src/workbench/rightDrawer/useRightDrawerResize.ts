import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { SymbolTableColumnKey } from '../mt5DataCenter/SymbolTable'
import { writeJson, writeString } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import {
  clampColumnWidth,
  clampDrawerWidth,
  defaultColumnWidths,
  getInitialColumnWidths,
  getInitialTopPaneHeight,
  getInitialWatchlistTableHeight,
} from './rightDrawerLayout'

type UseRightDrawerResizeOptions = {
  drawerWidth: number
  onResize: (width: number) => void
}

export function useRightDrawerResize({ drawerWidth, onResize }: UseRightDrawerResizeOptions) {
  const [topPaneHeight, setTopPaneHeight] = useState(getInitialTopPaneHeight)
  const [watchlistTableHeight, setWatchlistTableHeight] = useState(getInitialWatchlistTableHeight)
  const [columnWidths, setColumnWidths] = useState(getInitialColumnWidths)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = drawerWidth
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget
    const appMain = handle.closest('.ff-app-main') as HTMLElement | null
    let nextWidth = startWidth
    let writeFrameId = 0

    const writeLiveWidth = () => {
      writeFrameId = 0
      appMain?.style.setProperty('--ff-right-drawer-width', `${nextWidth}px`)
    }

    const scheduleLiveWidthWrite = () => {
      if (writeFrameId !== 0) return
      writeFrameId = window.requestAnimationFrame(writeLiveWidth)
    }

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-resizing', 'true')
    appMain?.style.setProperty('--ff-right-drawer-width', `${startWidth}px`)
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      nextWidth = clampDrawerWidth(startWidth - deltaX)
      scheduleLiveWidthWrite()
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-resizing')
      if (writeFrameId !== 0) {
        window.cancelAnimationFrame(writeFrameId)
        writeFrameId = 0
      }
      appMain?.style.setProperty('--ff-right-drawer-width', `${nextWidth}px`)
      onResize(nextWidth)
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
        writeString(storageKeys.importCenterTopPaneHeightPx, String(next))
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
    column: SymbolTableColumnKey,
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
          writeJson(storageKeys.importCenterColumnWidthsPx, next)
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
        writeString(storageKeys.importCenterWatchlistTableHeightPx, String(next))
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

  function resetColumnWidth(column: SymbolTableColumnKey) {
    setColumnWidths((current) => {
      const next = { ...current, [column]: defaultColumnWidths[column] }
      try {
        writeJson(storageKeys.importCenterColumnWidthsPx, next)
      } catch {
        // Column width persistence is best-effort only.
      }
      return next
    })
  }

  function resetWatchlistTableHeight() {
    setWatchlistTableHeight(228)
    try {
      writeString(storageKeys.importCenterWatchlistTableHeightPx, '228')
    } catch {
      // Watchlist table height persistence is best-effort only.
    }
  }

  function resetTopPaneHeight() {
    setTopPaneHeight(430)
  }

  return {
    columnWidths,
    handleColumnResizePointerDown,
    handleResizePointerDown,
    handleSplitPointerDown,
    handleWatchlistTableResizePointerDown,
    resetColumnWidth,
    resetTopPaneHeight,
    resetWatchlistTableHeight,
    tableWrapRef,
    topPaneHeight,
    watchlistTableHeight,
  }
}
