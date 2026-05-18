宝宝，给你一份**第二刀执行指令文案**：目标很窄——**不用 `DefaultDatafeed`，先写一个本地 mock datafeed，把假 K 线喂给 KLineChart Pro，验证 Pro 图表本体能不能正常显示。** 🧸

---

# 执行指令：FractalFrame_v5 第二刀：Mock Datafeed 喂给 KLineChart Pro

## 0. 当前状态

当前仓库已经完成：

```txt
Vite + React + TypeScript 项目创建完成
已安装 klinecharts / @klinecharts/pro
App.tsx 已挂载 KLineChartPro
```

但当前 `App.tsx` 使用的是：

```ts
datafeed: new DefaultDatafeed('')
```

这会导致默认数据源没有有效 API key，页面可能空白或没有 K 线。

本轮目标：

```txt
不使用 DefaultDatafeed
新增本地 mock datafeed
生成一批假 K 线
让 KLineChart Pro 先显示出图表和 K 线
```

---

## 1. 新增文件

路径：

```txt
frontend/src/datafeed/createMockKLineChartProDatafeed.ts
```

如果没有 `datafeed` 目录，先新建：

```txt
frontend/src/datafeed/
```

写入：

```ts
type KLineData = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  turnover?: number
}

type GetBarsParams = {
  type?: 'init' | 'forward' | 'backward'
  timestamp?: number
  callback?: (data: KLineData[], more?: { forward?: boolean; backward?: boolean }) => void
}

function createMockBars(count = 500): KLineData[] {
  const bars: KLineData[] = []
  const now = Date.now()
  const intervalMs = 5 * 60 * 1000

  let price = 2300

  for (let i = count - 1; i >= 0; i -= 1) {
    const timestamp = now - i * intervalMs
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

export function createMockKLineChartProDatafeed() {
  return {
    getBars(params: GetBarsParams) {
      const type = params?.type ?? 'init'
      const callback = params?.callback

      const data = createMockBars(type === 'init' ? 500 : 200)

      if (typeof callback === 'function') {
        callback(data, {
          forward: true,
          backward: false,
        })
      }

      return Promise.resolve(data)
    },

    subscribeBar() {
      // 第二刀先不接实时数据。
      return undefined
    },

    unsubscribeBar() {
      // 第二刀先不接实时数据。
      return undefined
    },
  }
}
```

---

## 2. 修改 App.tsx

路径：

```txt
frontend/src/App.tsx
```

全部覆盖成：

```tsx
import { useEffect, useRef } from 'react'
import { KLineChartPro } from '@klinecharts/pro'
import '@klinecharts/pro/dist/klinecharts-pro.css'
import './App.css'
import { createMockKLineChartProDatafeed } from './datafeed/createMockKLineChartProDatafeed'

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = new KLineChartPro({
      container: containerRef.current,
      symbol: {
        exchange: 'MT5',
        market: 'forex',
        name: 'XAUUSDm',
        shortName: 'XAUUSDm',
        ticker: 'XAUUSDm',
        priceCurrency: 'USD',
        type: 'forex',
      },
      period: {
        multiplier: 5,
        timespan: 'minute',
        text: '5m',
      },
      datafeed: createMockKLineChartProDatafeed(),
    })

    return () => {
      ;(chart as { destroy?: () => void }).destroy?.()
    }
  }, [])

  return (
    <div className="ff-v5-root">
      <div ref={containerRef} className="ff-v5-chart" />
    </div>
  )
}
```

---

## 3. 保持 App.css

路径：

```txt
frontend/src/App.css
```

保持为：

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
}

* {
  box-sizing: border-box;
}

.ff-v5-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #ffffff;
}

.ff-v5-chart {
  width: 100%;
  height: 100%;
}
```

---

## 4. 启动验证

在终端执行：

```powershell
cd G:\PythonProject\FractalFrame_v5\frontend
npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
```

浏览器打开：

```txt
http://127.0.0.1:5181/
```

---

## 5. 验收标准

这一刀只看：

```txt
1. 页面不再是 Vite 默认页。
2. 页面不空白。
3. 能看到 KLineChart Pro 图表外壳。
4. 能看到 mock K 线。
5. 控制台没有 TypeScript / runtime 报错。
```

如果仍然空白，立即检查浏览器 console：

```txt
F12 -> Console
```

重点看是否有：

```txt
datafeed.getBars is not a function
callback is not a function
KLineChartPro constructor error
CSS import error
version compatibility error
```

---

## 6. 如果版本报错

当前依赖是：

```txt
@klinecharts/pro: 0.1.1
klinecharts: 10.0.0-beta1
```

如果 mock datafeed 也不能显示，并且 console 出现 KLineCharts API 兼容错误，下一步锁回稳定版：

```powershell
cd G:\PythonProject\FractalFrame_v5\frontend
npm install klinecharts@9.8.12
```

然后重新启动：

```powershell
npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
```

---

## 7. 本刀完成后再做什么

如果 mock K 线能显示，第三刀再做：

```txt
createMt5KLineChartProDatafeed.ts
```

把 mock 数据换成：

```txt
MT5 / Store V2 / DuckDB 查询出来的真实 OHLCV
```

现在不要直接接 MT5，先证明：

```txt
KLineChart Pro + React + TypeScript + 本地 datafeed
```

这条链能跑通。
