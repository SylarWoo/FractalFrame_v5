import { useEffect, useState } from 'react'
import type { StoreV6HistoryPageWindow } from './historyPageWindowV2'
import {
  preheatHistoryWindowForIndicatorsV2,
  requestHistoryWindowIndicatorsV2,
  type StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestV2'
import { chartWorkspaceIndicatorRegistryV2 } from './chartWorkspaceIndicatorRegistryV2'

function attachIndicatorsToHistoryWindow(
  historyWindow: StoreV6HistoryPageWindow,
  indicators: StoreV6HistoryPageWindow['indicators'],
  indicatorSignature: string,
): StoreV6HistoryPageWindow {
  const indicatorResultSignature = Object.entries(indicators)
    .map(([name, series]) => {
      return [
        name,
        series.key,
        series.source,
      ].join(':')
    })
    .join('|')
  return {
    ...historyWindow,
    indicators,
    key: `${historyWindow.key}:indicators:${indicatorSignature}:results:${indicatorResultSignature}`,
    renderData: {
      ...historyWindow.renderData,
      indicators,
    },
  }
}

export function useHistoryWindowIndicatorsV2(options: {
  activeHistoryPageWindow: StoreV6HistoryPageWindow | null
  indicatorRequests: StoreV6IndicatorRequestSpecV2[]
  indicatorSignature: string
}) {
  const [historyPageWindowWithIndicators, setHistoryPageWindowWithIndicators] = useState<StoreV6HistoryPageWindow | null>(null)

  useEffect(() => {
    let disposed = false
    const historyPageWindow = options.activeHistoryPageWindow
    if (!historyPageWindow) {
      setHistoryPageWindowWithIndicators(null)
      return () => {
        disposed = true
      }
    }
    if (options.indicatorRequests.length === 0) {
      setHistoryPageWindowWithIndicators(historyPageWindow)
      return () => {
        disposed = true
      }
    }
    void preheatHistoryWindowForIndicatorsV2({
      registry: chartWorkspaceIndicatorRegistryV2,
      requests: options.indicatorRequests,
      window: historyPageWindow,
    })
      .then((preheatedWindow) => {
        if (disposed) return null
        const indicatorWindow = preheatedWindow ?? historyPageWindow
        return requestHistoryWindowIndicatorsV2({
          boundary: indicatorWindow.boundary,
          calculationRows: indicatorWindow.calculationRows,
          displayOffset: indicatorWindow.displayOffset,
          displayRows: indicatorWindow.historyRows,
          pageIndex: indicatorWindow.pageIndex,
          period: indicatorWindow.period,
          registry: chartWorkspaceIndicatorRegistryV2,
          requests: options.indicatorRequests,
          symbol: indicatorWindow.symbol,
          warmupRows: indicatorWindow.warmupRows,
        }).then((indicators) => ({ indicatorWindow, indicators }))
      })
      .then((result) => {
        if (disposed || !result) return
        const { indicatorWindow, indicators } = result
        setHistoryPageWindowWithIndicators(attachIndicatorsToHistoryWindow(indicatorWindow, indicators, options.indicatorSignature))
      })
      .catch(() => {
        if (!disposed) setHistoryPageWindowWithIndicators(historyPageWindow)
      })
    return () => {
      disposed = true
    }
  }, [options.activeHistoryPageWindow, options.indicatorRequests, options.indicatorSignature])

  return historyPageWindowWithIndicators
}
