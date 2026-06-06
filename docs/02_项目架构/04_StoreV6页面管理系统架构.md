# StoreV6 页面管理系统架构

## 0. 定位

StoreV6 页面管理系统是 StoreV6 数据中心与 KLineCharts 图表工作台之间的前端运行态管理层。

它不是旧版“加载更多”逻辑，也不是单纯的历史分页 UI，而是负责把：

```text
StoreV6 数据资产状态
实时页缓存
历史页分页
图表加载计划
指标计算范围
实时行情尾部更新
历史页实时价标记
每日整理状态
```

统一编排成一套稳定的看盘页面系统。

核心目标：

1. 让图表只负责渲染，不负责决定数据来源。
2. 让分页只依赖 StoreV6 的 `barKey / globalIndex / totalRows`，不依赖前端临时数组长度。
3. 让实时页和历史页使用两套明确的运行模式。
4. 让历史页保持静态，不被实时 tick 改写。
5. 让第 1 页作为活动实时页缓存，持续接收尾部更新。
6. 让第 2 页及之后作为固定历史页，按 `fromGlobalIndex / toGlobalIndex` 查询。
7. 让“更新分页”升级为完整的 StoreV6 页面整理入口。
8. 为后续指标、Signal Table、回测、回放提供稳定页面边界。

总原则：

```text
StoreV6 决定可信数据资产。
Page Planner 决定有哪些页。
Realtime Page Buffer 决定实时页怎么活着。
Load Planner 决定当前页怎么加载。
KLineCharts 只负责渲染和交互。
```

---

## 1. 总链路

页面管理系统处在 StoreV6 查询层和图表渲染层之间：

```text
MT5 / StoreV6 数据中心
        ↓
StoreV6 Status / Manifest / TotalRows
        ↓
Symbol Runtime Context
        ↓
Page Planner
        ↓
Realtime Page Buffer
        ↓
Load Planner
        ↓
Datafeed / Indicator Runtime
        ↓
KLineCharts
        ↓
History Realtime Price Marker
```

简化职责链：

```text
用户选择 symbol + period
        ↓
读取 StoreV6 status / manifest
        ↓
Page Planner 根据 totalRows 生成页面列表
        ↓
第 1 页绑定 Realtime Page Buffer
        ↓
第 2 页以后绑定固定 globalIndex 范围
        ↓
用户点击某一页
        ↓
Load Planner 生成 LoadPlan
        ↓
Datafeed 根据 LoadPlan 查询 StoreV6
        ↓
KLineCharts 渲染
        ↓
指标按 LoadPlan 的 page scope 计算
        ↓
实时 tick 只更新 Realtime Page Buffer
        ↓
历史页只显示实时价标记，不改 K 线
```

---

## 2. 核心模块

### 2.1 Symbol Runtime Context

Symbol Runtime Context 是页面管理系统的当前运行上下文。

它回答的问题是：

```text
当前图表正在看哪个品种、哪个周期、哪个页面？
```

建议结构：

```ts
type SymbolRuntimeContext = {
  symbol: string
  period: string
  displayName: string | null
  market: string | null
  selectedPageIndex: number
  selectedPageMode: 'realtime' | 'history'
}
```

来源：

1. 用户点击自选列表。
2. 用户切换周期按钮。
3. 用户点击历史分页列表。
4. 初始化恢复上次会话状态。

规则：

1. 切换 symbol 后，必须重新读取 StoreV6 status。
2. 切换 period 后，必须重新读取当前 `symbol + period` 的 page plan。
3. 切换 page 后，不改变 StoreV6 仓库，只改变 LoadPlan。
4. Symbol Runtime Context 不保存 OHLCV。
5. Symbol Runtime Context 不判断 K 线质量。

---

### 2.2 StoreV6 Status Model

StoreV6 Status Model 是右侧“仓库”页和 Page Planner 的共同输入。

它回答的问题是：

```text
当前 symbol 的 StoreV6 数据资产到哪里了？
```

建议结构：

```ts
type StoreV6PeriodStatus = {
  period: string
  mode: 'clean' | 'aggregated'
  rowsCount: number
  firstOpenTime: number | null
  lastOpenTime: number | null
  firstGlobalIndex?: number | null
  lastGlobalIndex?: number | null
  dirty?: boolean
  lastUpdatedAt?: string | null
}

type StoreV6SymbolStatus = {
  symbol: string
  rawM1RowsCount: number | null
  cleanM1RowsCount: number | null
  mt5RowsCount: number | null
  lastPullAt: string | null
  periods: StoreV6PeriodStatus[]
}
```

右侧“仓库”页展示：

```text
MT5 条数
仓库条数
数据范围
最后更新时间
各周期聚合条数
各周期最后时间
dirty 状态
```

按钮职责：

```text
拉取：触发 StoreV6 pull job。
聚合：触发 StoreV6 aggregate job。
```

边界：

1. 仓库页只显示 StoreV6 状态，不直接读 parquet。
2. 仓库页只触发后端 job，不在前端计算数据真假。
3. 仓库页的 rowsCount 是 Page Planner 的 totalRows 来源之一。

---

### 2.3 Page Planner

Page Planner 是 StoreV6 仓库和图表加载之间的第一层前端规划模块。

它回答的问题是：

```text
当前 symbol + period 应该被切成哪些页面？
```

核心规则：

```text
第 1 页 = 活动实时页，默认 2,000 根。
第 2 页以后 = 静态历史页，默认每页 2,500 根。
```

Page Planner 职责：

1. 读取 StoreV6 当前 `symbol + period` 的 totalRows。
2. 固定第 1 页为实时页。
3. 第 1 页以 StoreV6 最新 2,000 根作为活动实时页基准。
4. 第 2 页开始为历史页。
5. 历史页大小默认 2,500 根。
6. 为每一页生成 `fromGlobalIndex / toGlobalIndex / rows / pageIndex`。
7. 只为当前页和下一页懒加载 `timeFrom / timeTo`。
8. 缓存分页符，避免每次打开都重新规划。
9. 管理第 1 页活动实时缓存的 `rows / timeFrom / timeTo` 展示状态。

建议结构：

```ts
type PagePlanItem = {
  index: number
  realtime: boolean
  rows: number
  limit: number
  fromGlobalIndex: number | null
  toGlobalIndex: number | null
  timeFrom?: number | null
  timeTo?: number | null
}

type PagePlan = {
  symbol: string
  period: string
  totalRows: number
  realtimePageRows: number
  historyPageSize: number
  generatedAt: string
  items: PagePlanItem[]
}
```

Page Planner 不做的事：

1. 不直接查询整页 OHLCV。
2. 不计算指标。
3. 不直接处理 MT5 tick。
4. 不决定 KLineCharts 的实时/静态行为。
5. 不一次性补齐所有页的起止时间。

时间范围加载规则：

```text
点击更新：
  生成全部分页符。
  自动打开第 1 页。
  只预取第 1 页和第 2 页的 timeFrom / timeTo。

点击第 N 页：
  打开第 N 页。
  只预取第 N 页和第 N+1 页的 timeFrom / timeTo。

禁止：
  点击更新时一次性查询所有页的起止时间。
```

原因：

1. `globalIndex` 可以快速确定分页边界。
2. 起止时间只在展示和快捷翻页时需要。
3. 一次性补全所有页时间会让 DuckDB 扫描和前端等待变重。
4. 当前页 + 下一页预取即可支持主图下方快捷翻页提示。

---

### 2.4 Realtime Page Buffer

Realtime Page Buffer 是第 1 页的活动实时页缓存。

它回答的问题是：

```text
最新行情页如何保持活动状态？
```

第 1 页不是普通历史页，也不是每次打开都重新查询的静态页。第 1 页是一个独占活动缓存：

```text
StoreV6 最新 2,000 根
  -> 建立活动实时页缓存基准
  -> MT5 tick 持续更新最后一根或追加新 K 线
  -> 缓存 rows 从 2,000 增长到 2,001、2,002...
  -> 达到 2,500 后触发整理提示或整理事件
```

建议结构：

```ts
type RealtimePageBuffer = {
  key: `${symbol}:${period}`
  symbol: string
  period: string
  savedAt: string
  rows: KLineData[]
  timeFrom: number | null
  timeTo: number | null
}
```

本地持久化键：

```text
fractalframe:chartRealtimePageBuffer:v1
```

职责：

1. 保存 `symbol + period` 对应的实时页 K 线数组。
2. 初始基准来自 StoreV6 最新 2,000 根。
3. 后续只接收尾部实时更新。
4. 切到历史页时继续在后台更新，不渲染实时 K 线。
5. 切回第 1 页时直接渲染缓存，不重新按 StoreV6 固定 2,000 根重建。
6. 刷新前端后从本地持久化恢复缓存。
7. 缓存行数变化时通知 Page Planner 更新第 1 页 `rows / timeFrom / timeTo`。

缓存边界：

```text
基础容量 = 2,000 根。
硬上限 = 2,500 根。
写入缓存时按 timestamp 去重、升序排列。
只保留最新 2,500 根。
手动更新分页或自动整理完成后，重新从 StoreV6 最新 2,000 根建立活动页缓存。
```

第 1 页和历史页的差异：

```text
第 1 页：活动实时页，可以接 tick，可以增长。
第 2 页以后：静态历史页，不接 tick，不增长。
```

---

### 2.5 Page Maintenance Trigger

Page Maintenance Trigger 是页面整理触发器。

它回答的问题是：

```text
什么时候应该重新拉取、聚合、审计并重建分页？
```

实时更新和分页整理必须隔离：

```text
实时更新：
  高频，只更新活动实时页缓存最后一根或追加尾部。
  不重排分页符。

分页整理：
  低频，事件触发。
  执行完整链路：拉取 -> 聚合 -> audit/repair -> 重建分页规划。
```

触发事件：

1. 用户手动点击“更新”。
2. 每日固定维护时间，例如本地时间 06:00。
3. 后端桥服务启动时的补整理检查。
4. 拉取任务完成。
5. 聚合任务完成。
6. 未来实时缓存累计新增 >= 500 根 K 线。

前端“更新分页”按钮的正式链路：

```text
点击更新
  -> 拉取 StoreV6 最新 M1
  -> 按 dirty 状态聚合需要更新的高周期
  -> audit/repair
  -> 重新读取 StoreV6 status / totalRows
  -> 从 StoreV6 最新 2,000 根重建活动实时页缓存
  -> 重新生成分页符
  -> 自动打开第 1 页实时页
```

因此，“更新”按钮不是简单重新切分页符，而是手动页面整理入口。

建议函数命名：

```ts
runPageMaintenance()
refreshStoreAndPagePlan()
rebuildPagePlanAfterMaintenance()
```

不建议继续使用含义过弱的命名：

```ts
reloadPageList()
loadMoreHistory()
refreshPaginationOnly()
```

---

### 2.6 Daily Maintenance Ledger

为了避免关闭终端、重新打开终端后重复整理，StoreV6 需要记录每日整理状态。

判断标准不是“今天开过几次终端”，而是：

```text
今天这个 symbol 是否已经完成过每日整理。
```

建议落地文件：

```text
runtime_data/store_v6/diagnostics/daily_maintenance_ledger.json
runtime_data/store_v6/diagnostics/daily_maintenance_events.jsonl
```

Ledger 记录当前状态：

```json
{
  "date": "2026-06-03",
  "symbol": "XAUUSDm",
  "status": "completed",
  "trigger": "manual",
  "startedAt": "2026-06-03T06:02:10+08:00",
  "finishedAt": "2026-06-03T06:08:44+08:00",
  "pullJobId": "pull-xxx",
  "aggregateJobId": "aggregate-xxx",
  "pagePlanVersion": "page-plan-xxx"
}
```

Events 记录过程：

```json
{"eventId":"evt-001","date":"2026-06-03","symbol":"XAUUSDm","trigger":"scheduled_0600","step":"pull_started","status":"running","createdAt":"2026-06-03T06:00:00+08:00"}
{"eventId":"evt-002","date":"2026-06-03","symbol":"XAUUSDm","trigger":"scheduled_0600","step":"pull_completed","status":"completed","rowsAdded":351}
{"eventId":"evt-003","date":"2026-06-03","symbol":"XAUUSDm","trigger":"scheduled_0600","step":"aggregate_completed","status":"completed"}
{"eventId":"evt-004","date":"2026-06-03","symbol":"XAUUSDm","trigger":"scheduled_0600","step":"page_plan_rebuilt","status":"completed"}
```

后端桥服务启动时的判断：

```text
1. 读取 daily_maintenance_ledger.json。
2. 查今天 date + symbol 的记录。
3. 如果 status = completed，不触发。
4. 如果没有记录，且当前时间已经过 06:00，触发补整理事件链。
5. 如果 status = running，判断是否超时。
6. 如果 running 超时，追加 previous_running_expired event，再决定重跑或等待人工处理。
7. 如果 status = failed，可以允许启动补整理，也可以要求人工手动触发。
```

这套机制保证：

1. 终端关闭再打开不会重复整理。
2. 06:00 未运行程序时，后续启动可以补整理。
3. 手动整理成功后，当天不再自动重复整理。
4. 崩溃中的 running 任务可以被识别和恢复。
5. 分页规划器的重排是低频事件，不是 tick 轮询。

---

### 2.7 Load Planner

Load Planner 是 Page Planner 之后、KLineCharts 之前的第二层前端规划模块。

它回答的问题是：

```text
当前页面应该如何加载、如何计算、是否实时跳动？
```

Load Planner 不是数据仓库，也不是图表组件。它是看图模式调度层。

输入：

```ts
type LoadPlanInput = {
  symbol: string
  period: string
  page: PagePlanItem
  totalRows: number | null
  indicatorConfigs: IndicatorConfig[]
}
```

输出：

```ts
type LoadPlan = {
  mode: 'realtime' | 'history'
  symbol: string
  period: string
  query: {
    mode: 'clean' | 'aggregated'
    limit?: number
    fromGlobalIndex?: number
    toGlobalIndex?: number
    timeFrom?: number | null
    timeTo?: number | null
  }
  chartBehavior: {
    followLatest: boolean
    acceptRealtimeTicks: boolean
    showCountdown: boolean
  }
  indicatorBehavior: {
    calculateOnLoad: boolean
    recalculateOnTick: boolean
    scope: 'page'
  }
  prefetch?: {
    nextPageIndex?: number
    nextPageTimeFrom?: number | null
    nextPageTimeTo?: number | null
  }
}
```

实时页模式：

```text
目标：看最新行情。
来源：Realtime Page Buffer。
首次基准：StoreV6 最新 2,000 根。
查询：首次 limit=2,000；运行中不因缩放、拖动补载历史。
实时：允许接 tick、倒计时、当前 K 线更新，只更新尾部。
指标：按当前活动页数据计算，可随实时更新重新计算或局部刷新。
图表：可以自动跟随最新 K 线。
```

历史页模式：

```text
目标：稳定查看历史分页。
来源：StoreV6 指定 fromGlobalIndex / toGlobalIndex 范围。
查询：按分页符读取固定范围，默认 2,500 根。
实时：不渲染实时 K 线，不被最新行情打断。
后台实时：Realtime Page Buffer 继续更新。
实时价标记：可在右侧价格轴显示后台实时页最后价和倒计时。
指标：进入页面时按当前页数据一次性计算。
图表：保持静态，不自动跳回最新。
```

边界：

1. Load Planner 可以决定怎么查，但不直接操作 parquet。
2. Load Planner 可以决定是否实时，但不直接接 MT5。
3. Load Planner 可以决定指标计算范围，但不保存指标结果为历史固定资产。
4. Load Planner 可以使用 Page Planner 的下一页时间范围，但不重新规划分页符。
5. Load Planner 把最终 LoadPlan 交给 datafeed、指标计算器和 KLineCharts。
6. 实时页禁止使用 KLineCharts 的加载更多回调补历史，只允许尾部 tick 更新。
7. 历史页禁止被 tick 重建 K 线，但允许显示后台实时价 DOM 标记。

---

### 2.8 History Realtime Price Marker

History Realtime Price Marker 是历史页实时价标记器。

它回答的问题是：

```text
用户看历史页时，如何同时知道当前实时价格？
```

历史页不能接 tick 改写 K 线，但可以读取 Realtime Page Buffer 的最后价，在当前历史页价格轴上显示一个独立标记。

链路：

```text
Realtime Page Buffer
  -> 读取最后一根 K 线 close / timestamp
  -> 换算到当前历史页价格轴 y 坐标
  -> 在右侧价格轴显示实时价标签
  -> 在主图区域显示横向虚线
```

职责：

1. 只读 Realtime Page Buffer。
2. 不写 KLineCharts 数据。
3. 不触发页面切换。
4. 不参与历史页指标计算。
5. 根据当前价格轴缩放和滚动重新定位。
6. 显示价格、倒计时和实时价虚线。

显示规则：

```text
当前页 = 实时页：
  使用实时页当前 K 线倒计时标签。
  History Realtime Price Marker 隐藏，避免重复。

当前页 = 历史页：
  历史 K 线保持静态。
  History Realtime Price Marker 显示后台实时缓存最后价。
  右侧价格标签和横向虚线跟随价格轴移动。
```

这样，“看历史页”和“知道当前实时价格”可以同时成立。

---

## 3. 右侧数据中心页面结构

右侧数据中心面板是 StoreV6 的前端控制台，不是数据源本身。

当前建议分为四个 Tab：

```text
详情
仓库
历史分页
自选列表
```

### 3.1 详情 Tab

定位：

```text
SymbolInfo Viewer
```

展示内容：

```text
名称
描述
分类
市场
小数位
点差
合约量
基础货币
盈利货币
保证金币种
交易模式
执行模式
最小量
最大量
步长
Tick Size
Tick Value
交易时段
时段更新时间
时段文件
路径
最后扫描时间
```

边界：

1. 详情页只展示 MT5 symbol 元信息。
2. 详情页不展示 StoreV6 rowsCount。
3. 详情页不触发拉取和聚合。
4. 详情页不参与 Page Planner。

---

### 3.2 仓库 Tab

定位：

```text
StoreV6 Asset Status
```

展示内容：

```text
本地仓库 M1
MT5 条数
仓库条数
范围
最后更新时间
MT5 最新时间
仓库尾部
落后 M1 根数
各聚合周期 rowsCount
各聚合周期最后时间
```

操作按钮：

```text
拉取：触发 StoreV6 pull job。
聚合：触发 StoreV6 aggregate job。
```

边界：

1. 仓库页读取 StoreV6 status，不直接读 parquet。
2. 仓库页不生成分页。
3. 仓库页的 totalRows 是 Page Planner 的输入。
4. 仓库页触发的 job 完成后，应通知 Page Maintenance Trigger 刷新状态。

---

### 3.3 历史分页 Tab

定位：

```text
Page Plan Manager
```

展示内容：

```text
上次整理时间
实时页状态
当前页列表
每页 rows
每页 timeFrom / timeTo
每页 globalIndex 范围
当前总数
```

第 1 页展示规则：

```text
第 1 页 = 实时页。
默认显示 2,000 根。
运行中可能增长到 2,500 根。
超过整理阈值后提示或触发整理。
```

第 2 页及之后展示规则：

```text
第 2 页以后 = 历史页。
默认每页 2,500 根。
范围来自 fromGlobalIndex / toGlobalIndex。
```

操作按钮：

```text
更新：执行完整 Page Maintenance 链路。
```

点击某页：

```text
点击第 1 页：
  Load Planner 生成 realtime LoadPlan。
  图表渲染 Realtime Page Buffer。

点击第 N 页：
  Load Planner 生成 history LoadPlan。
  图表查询 StoreV6 固定 globalIndex 范围。
```

边界：

1. 历史分页 Tab 展示 PagePlanItem，不直接展示 OHLCV。
2. 点击历史页不触发拉取。
3. 点击历史页不触发聚合。
4. 更新按钮才触发完整整理链路。

---

### 3.4 自选列表 Tab

定位：

```text
Symbol Watchlist / Runtime Shortcut
```

职责：

1. 管理自选 symbol。
2. 管理快速菜单 symbol。
3. 触发 symbol runtime context 切换。
4. 切换后刷新 StoreV6 status。
5. 切换后读取或重建对应 `symbol + period` 的 PagePlan。

边界：

1. 自选列表不是数据源。
2. 自选列表不保存 OHLCV。
3. 自选列表不保存 StoreV6 仓库状态。
4. 自选列表只负责快速切换上下文。

---

## 4. 页面切换流程

### 4.1 切换 symbol

```text
用户点击自选列表 symbol
  -> 更新 Symbol Runtime Context.symbol
  -> 读取 SymbolInfo
  -> 读取 StoreV6 status
  -> 读取当前 period 的 PagePlan
  -> 如果没有 PagePlan，则根据 totalRows 生成
  -> 默认打开第 1 页实时页
  -> Load Planner 生成 realtime LoadPlan
  -> KLineCharts 渲染实时页
```

### 4.2 切换 period

```text
用户点击周期按钮
  -> 更新 Symbol Runtime Context.period
  -> 读取该 symbol + period 的 StoreV6 period status
  -> 读取该 runtimeKey 的 Realtime Page Buffer
  -> 读取或生成该 symbol + period 的 PagePlan
  -> 默认打开第 1 页实时页
  -> Load Planner 生成 realtime LoadPlan
  -> KLineCharts 渲染实时页
```

runtimeKey：

```text
runtimeKey = symbol + ':' + period
```

每个 runtimeKey 都有独立实时缓存：

```text
XAUUSDm:M1
XAUUSDm:M5
XAUUSDm:H1
BTCUSDm:M5
```

### 4.3 切换历史页

```text
用户点击 Page N
  -> 更新 selectedPageIndex
  -> Page Planner 返回 PagePlanItem
  -> Load Planner 判断 mode = history
  -> Datafeed 查询 StoreV6 fromGlobalIndex / toGlobalIndex
  -> 指标按当前页一次性计算
  -> KLineCharts 渲染静态历史页
  -> History Realtime Price Marker 开启
```

### 4.4 切回实时页

```text
用户点击第 1 页
  -> Load Planner 判断 mode = realtime
  -> 读取 Realtime Page Buffer
  -> KLineCharts 渲染实时页缓存
  -> 接入 tick / 当前 K 更新
  -> 指标随实时页刷新
  -> History Realtime Price Marker 隐藏
```

---

## 5. 指标系统边界

页面管理系统不直接定义指标语义，但它决定指标计算范围。

原则：

```text
裸 K 加载底座只加载 Page Planner 给出的页面 K 线。
实时页不回到旧的全局 5,000 根加载逻辑。
历史页不让指标反向决定分页大小。
指标读取当前 LoadPlan 的 displayRows + 必要 warmup。
```

实时页指标：

```text
来源：Realtime Page Buffer rows。
行为：允许随 tick 或新 bar 局部刷新。
作用：实时看盘。
```

历史页指标：

```text
来源：固定历史页 rows。
行为：进入页面时一次性计算。
作用：复盘、观察历史结构。
```

禁止：

1. 指标模块重新决定页面大小。
2. 指标模块绕过 LoadPlan 直接查询 StoreV6。
3. 历史页指标被实时 tick 改写。
4. 实时页拖动缩放时触发旧式加载更多。

---

## 6. 与 Signal Table / 回测 / 回放的关系

当前页面管理系统不是回测系统，但它要为后续回测和回放提供稳定页面边界。

未来接入顺序：

```text
StoreV6 K 线
  -> Feature Table
  -> Signal Table
  -> Strategy Decision Table
  -> Trade Table
  -> Replay Timeline / Chart Jump
```

页面管理系统提供：

1. 当前页的 `symbol / period / fromGlobalIndex / toGlobalIndex`。
2. 当前页的 `barKey` 序列。
3. 当前页的可视范围。
4. 图表跳转入口。
5. 历史页静态环境。
6. 实时页最新环境。

后续 Trade Table 点击跳转时：

```text
Trade entryBarKey / exitBarKey
        ↓
barKey resolver
        ↓
定位 globalIndex
        ↓
Page Planner 找到所在页
        ↓
Load Planner 加载该历史页
        ↓
KLineCharts 滚动到对应 K 线
        ↓
显示十字线 / 高亮 / marker
```

因此，页面管理系统必须长期坚持：

```text
页面边界基于 globalIndex。
图表跳转基于 barKey。
实时页和历史页模式不可混用。
```

---

## 7. 命名规范

统一使用以下命名：

```text
StoreV6
Page Planner
Page Plan
PagePlanItem
Realtime Page Buffer
Page Maintenance
Daily Maintenance Ledger
Load Planner
LoadPlan
History Realtime Price Marker
Symbol Runtime Context
StoreV6 Status
```

避免继续使用旧命名：

```text
StoreV5 页面
load more
历史加载补丁
实时加载补丁
全局 5000 根
前端临时分页
```

旧链路隔离要求：

1. 前端命名统一使用 StoreV6 / Page Planner / Load Planner / Realtime Buffer。
2. 旧 StoreV5 后端服务文件可以作为兼容层暂时保留，但不能再作为前端主链路命名。
3. 后续如果重命名后端文件，应先保留路由兼容，再迁移内部模块名，最后删除旧别名。

---

## 8. 验收标准

1. 第 1 页固定为实时页。
2. 第 1 页初始基准为 StoreV6 最新 2,000 根。
3. 第 1 页运行中可以追加到 2,500 根。
4. 第 1 页缓存按 `symbol + period` 隔离。
5. 第 2 页及之后固定为历史页。
6. 历史页默认每页 2,500 根。
7. 历史页按 `fromGlobalIndex / toGlobalIndex` 查询。
8. Page Planner 不直接查询 OHLCV。
9. Load Planner 负责生成 realtime/history 两套 LoadPlan。
10. 实时页可以接 tick。
11. 历史页不接 tick，不被实时行情改写。
12. 历史页可以显示 History Realtime Price Marker。
13. History Realtime Price Marker 不写 KLineCharts 数据。
14. 更新按钮执行完整 Page Maintenance 链路。
15. Page Maintenance 完成后重建 Realtime Page Buffer 和 PagePlan。
16. 每日整理状态写入 Daily Maintenance Ledger。
17. 已完成每日整理后，终端重启不重复整理。
18. Symbol 切换后重新读取 StoreV6 status 和 PagePlan。
19. Period 切换后使用独立 runtimeKey 和 Realtime Page Buffer。
20. 指标计算范围由 LoadPlan 决定。
21. 指标不能反向决定分页大小。
22. KLineCharts 只负责渲染和交互。
23. 前端不判断 K 线真假，不直接读 parquet，不直接接 MT5 历史 K 线。
24. 图表跳转必须基于 `barKey`。
25. 页面边界必须基于 `globalIndex`。

---

## 9. 核心结论

StoreV6 页面管理系统的本质，是 StoreV6 数据资产中心的前端运行态管理器。

它把原本容易混在一起的几件事拆开：

```text
数据资产归 StoreV6。
页面边界归 Page Planner。
实时尾部归 Realtime Page Buffer。
加载行为归 Load Planner。
历史实时价归 History Realtime Price Marker。
图表渲染归 KLineCharts。
指标计算归 Indicator Runtime。
```

最终形成的稳定模式是：

```text
第 1 页负责活着。
历史页负责稳定。
更新按钮负责整理。
LoadPlan 负责调度。
barKey 负责跳转。
globalIndex 负责分页。
```

这套边界建立后，后续 MMF 指标、Signal Table、Trade Table、K 线回放、vectorBT 适配都会有稳定的页面坐标系，不再被实时 tick、临时数组长度和旧式加载更多逻辑干扰。
