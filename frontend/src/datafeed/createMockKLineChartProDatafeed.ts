import type { Datafeed, Period, SymbolInfo } from '@klinecharts/pro'
import type { KLineData } from 'klinecharts'

type GetBarsParams = {
  type?: 'init' | 'forward' | 'backward'
  timestamp?: number
  callback?: (
    data: KLineData[],
    more?: { forward?: boolean; backward?: boolean },
  ) => void
}

const intervalMs = 5 * 60 * 1000

function createMockBars(count = 500, endTimestamp = Date.now()): KLineData[] {
  const bars: KLineData[] = []
  let price = 2300

  for (let i = count - 1; i >= 0; i -= 1) {
    const timestamp = endTimestamp - i * intervalMs
    const drift = (Math.random() - 0.48) * 6
    const open = price
    const close = Math.max(1, open + drift)
    const high = Math.max(open, close) + Math.random() * 4
    const low = Math.min(open, close) - Math.random() * 4
    const volume = Math.round(100 + Math.random() * 1000)

    bars.push({
      timestamp,
      open: Number(open.toFixed(3)),
      high: Number(high.toFixed(3)),
      low: Number(low.toFixed(3)),
      close: Number(close.toFixed(3)),
      volume,
    })

    price = close
  }

  return bars
}

export function createMockKLineChartProDatafeed(): Datafeed & {
  getBars(params: GetBarsParams): Promise<KLineData[]>
  subscribeBar(): undefined
  unsubscribeBar(): undefined
} {
  return {
    searchSymbols(search?: string) {
      const symbol: SymbolInfo = {
        exchange: 'MT5',
        market: 'forex',
        name: 'XAUUSDm',
        shortName: 'XAUUSDm',
        ticker: 'XAUUSDm',
        priceCurrency: 'USD',
        type: 'forex',
      }

      if (!search) {
        return Promise.resolve([symbol])
      }

      const normalizedSearch = search.toLowerCase()
      return Promise.resolve(
        [symbol].filter((item) =>
          item.ticker.toLowerCase().includes(normalizedSearch),
        ),
      )
    },

    getHistoryKLineData(
      _symbol: SymbolInfo,
      _period: Period,
      from: number,
      to: number,
    ) {
      const count = Math.max(1, Math.min(500, Math.ceil((to - from) / intervalMs)))
      return Promise.resolve(createMockBars(count, to))
    },

    subscribe() {
      return undefined
    },

    unsubscribe() {
      return undefined
    },

    getBars(params: GetBarsParams) {
      const type = params?.type ?? 'init'
      const callback = params?.callback
      const data = createMockBars(type === 'init' ? 500 : 200, params.timestamp)

      if (typeof callback === 'function') {
        callback(data, {
          forward: true,
          backward: false,
        })
      }

      return Promise.resolve(data)
    },

    subscribeBar() {
      return undefined
    },

    unsubscribeBar() {
      return undefined
    },
  }
}
