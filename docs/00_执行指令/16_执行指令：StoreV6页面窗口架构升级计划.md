# 执行指令：StoreV6 页面窗口架构升级计划

## 0. 本阶段定位

本阶段目标不是继续给当前页面加载、指标快照、实时 tick 补丁式修复，而是把 StoreV6 前端图表运行系统升级为一套明确的 **页面窗口架构**。

当前 StoreV6 已经具备：

```text
StoreV6 数据仓库
Page Planner 分页规划
Page Data Package
displayRows / warmupRows / lookaheadRows / calculationRows
PageCalculationContext
IndicatorPageSnapshot
RealtimePageBuffer
useChartRealtimeTicks
KLineCharts 渲染
```

但当前问题是：

```text
K 线先进入 KLineCharts。
指标再通过 snapshot / pageKey / runtimeOnly 尝试补进去。
实时 tick 直接更新图表尾部。
历史页和实时页虽然行为不同，但缺少统一 Page Window 状态层。
指标 warmup / lookahead 容易因为生命周期、pageKey、settingsHash、runtimeOnly 不一致而失效。
```

因此，本次升级要把图表前端主链重构为：

```text
StoreV6
  ↓
Page Planner
  ↓
Page Requester / Page Data Provider
  ↓
Indicator Requirement Resolver
  ↓
Indicator Manager
  ↓
Page Window Manager
  ↓
Realtime Page Window / History Page Window
  ↓
Chart Adapter
  ↓
KLineCharts
```

核心原则：

```text
Page Planner 负责“切哪一页”。
Page Data Provider 负责“拿哪些 K 线”。
Indicator Manager 负责“怎么算指标”。
Page Window 负责“当前图表页面的完整状态”。
Chart Adapter 负责“把 Page Window 写进 KLineCharts”。
KLineCharts 只负责画，不再参与数据来源、分页、预热、指标生命周期判断。
```

---

## 1. 关键概念重新定义

### 1.1 StoreV6

StoreV6 是可信 K 线资产中心。

它保存：

```text
Raw M1
Clean M1
Aggregated Store
barKey
globalIndex
sessionId
quality
manifest
```

StoreV6 不知道前端当前打开第几页，也不关心 KLineCharts 当前怎么画。

### 1.2 Page Planner

Page Planner 是分页规划器。

它不直接加载数据，不计算指标，不操作 KLineCharts。

它只输出页面地图：

```ts
type PagePlanItem = {
  pageIndex: number
  mode: 'realtime' | 'history'
  realtime: boolean
  rows: number
  limit: number
  fromGlobalIndex: number | null
  toGlobalIndex: number | null
  timeFrom?: number | null
  timeTo?: number | null
}
```

示例：

```text
第 1 页：实时页，最新 2000 根，realtime = true。
第 2 页：历史页，globalIndex 95000 ~ 97499。
第 3 页：历史页，globalIndex 92500 ~ 94999。
```

Page Planner 相当于给 StoreV6 连续 K 线资产生成“页面地图”，不是往 StoreV6 实体数据里写 page 标签。

### 1.3 displayRows

`displayRows` 是当前 PagePlanItem 对应的显示数据切片。

定义：

```text
displayRows = 当前页面真正交给 KLineCharts 显示的 K 线数组。
```

实时页有 displayRows，历史页也有 displayRows。

区别：

```text
实时页 displayRows：来自 Realtime Page Window，可接 tick，可更新尾部，可追加新 bar。
历史页 displayRows：来自 StoreV6 固定 globalIndex 范围，静态，不接 tick。
```

重要边界：

```text
displayRows 不是查询服务。
displayRows 不是整个仓库。
displayRows 只是当前页面显示结果。
```

### 1.4 calculationRows

`calculationRows` 是指标计算用的扩展数据。

结构：

```text
calculationRows = warmupRows + displayRows + lookaheadRows
```

含义：

```text
warmupRows：当前页左侧预热数据，只参与指标计算，不显示。
displayRows：当前页真正显示数据。
lookaheadRows：当前页右侧确认数据，主要供 MR / MMF 等区间型、确认型指标使用，不显示。
```

规则：

```text
KLineCharts 只能显示 displayRows。
Indicator Manager 可以使用 calculationRows。
指标结果必须裁剪回 displayRows。
```

### 1.5 Page Window

Page Window 是本次升级的核心状态单位。

定义：

```text
Page Window = 一页图表最终准备好的完整运行状态。
```

它包含：

```ts
type ChartPageWindow = {
  mode: 'realtime' | 'history'
  symbol: string
  period: string
  pageIndex: number

  displayRows: KLineData[]
  warmupRows: KLineData[]
  lookaheadRows: KLineData[]
  calculationRows: KLineData[]

  indicators: IndicatorPageResult

  behavior: {
    acceptRealtimeTicks: boolean
    followLatest: boolean
    staticPage: boolean
  }

  meta: {
    pageKey: string
    settingsHashMap: Record<string, string>
    builtAt: string
    rows: number
    warmupRows: number
    lookaheadRows: number
  }
}
```

Page Window 是交给 Chart Adapter 的唯一图表页面状态。

---

## 2. 新主链路

### 2.1 历史页链路

```text
用户点击历史页 Page N
  ↓
Page Planner 返回 PagePlanItem
  ↓
Indicator Requirement Resolver 读取当前已加载指标需求
  ↓
Page Data Provider 根据 PagePlanItem + 指标需求加载：
  displayRows
  warmupRows
  lookaheadRows
  calculationRows
  ↓
Indicator Manager 使用 calculationRows 计算指标
  ↓
按 barKey 裁剪回 displayRows
  ↓
History Page Window 生成静态页面窗口
  ↓
Page Window Manager 激活该窗口
  ↓
Chart Adapter 把窗口写入 KLineCharts
```

历史页特点：

```text
不接 tick。
不自动跳回最新。
不会因为实时行情变化而重算。
指标在窗口构建时计算一次。
可缓存为静态 History Page Window。
```

### 2.2 实时页链路

```text
用户打开第 1 页实时页
  ↓
Realtime Page Window 从 StoreV6 最新 2000 根建立基准
  ↓
Indicator Requirement Resolver 读取当前已加载指标需求
  ↓
Page Data Provider 额外加载实时页 warmupRows
  ↓
Indicator Manager 计算初始指标
  ↓
Realtime Page Window 保存：
  displayRows
  calculationRows
  indicators
  behavior
  ↓
Chart Adapter 初始写入 KLineCharts
  ↓
后续 tick 进入 Realtime Page Window
  ↓
Realtime Page Window 更新最后一根或追加新 bar
  ↓
Indicator Manager 增量刷新尾部指标或局部重算
  ↓
Chart Adapter 调用 updateData / updateIndicator
```

实时页特点：

```text
接 tick。
最后一根会跳动。
新 K 出现时 append。
displayRows 可以从 2000 增长到 2500。
达到整理阈值后触发 Page Maintenance。
实时页不是历史页，不应该每个 tick 重新走全量历史页加载。
```

---

## 3. 模块职责

### 3.1 Page Planner

职责：

1. 读取 StoreV6 totalRows。
2. 固定第 1 页为实时页。
3. 第 1 页默认 2000 根。
4. 第 2 页以后为历史页。
5. 历史页默认每页 2500 根。
6. 输出 PagePlanItem 列表。
7. 只维护页面范围，不加载 OHLCV。

禁止：

1. 不计算指标。
2. 不写 KLineCharts。
3. 不接 tick。
4. 不处理 warmup / lookahead。

### 3.2 Page Requester / Page Data Provider

职责：

1. 接收 PagePlanItem。
2. 接收 Indicator Requirement Resolver 给出的 warmup / lookahead 需求。
3. 向 StoreV6 查询 displayRows。
4. 向 StoreV6 查询 warmupRows。
5. 向 StoreV6 查询 lookaheadRows。
6. 合并生成 calculationRows。
7. 输出 PageDataSlice。

建议类型：

```ts
type PageDataSlice = {
  symbol: string
  period: string
  pageIndex: number
  mode: 'realtime' | 'history'

  displayRows: KLineData[]
  warmupRows: KLineData[]
  lookaheadRows: KLineData[]
  calculationRows: KLineData[]

  displayOffset: number

  range: {
    displayFromBarKey: string | null
    displayToBarKey: string | null
    calculationFromBarKey: string | null
    calculationToBarKey: string | null
  }
}
```

关键规则：

```text
Page Data Provider 可以跨分页边界向左取 warmupRows。
Page Data Provider 可以跨分页边界向右取 lookaheadRows。
但它不能把 warmupRows / lookaheadRows 交给 KLineCharts 显示。
```

### 3.3 Indicator Requirement Resolver

职责：

1. 读取当前已加载指标。
2. 读取指标设置参数。
3. 计算每个指标需要的 warmupRows。
4. 计算每个指标需要的 lookaheadRows。
5. 取最大需求作为页面数据请求需求。

建议类型：

```ts
type IndicatorDataRequirement = {
  indicator: string
  warmupRows: number
  lookaheadRows: number
  reason: string
}

type PageIndicatorDataRequirement = {
  entries: IndicatorDataRequirement[]
  warmupRows: number
  lookaheadRows: number
}
```

示例默认策略：

```text
MA：length + 20
RSI：length * 5
Stoch：length * 5
MACD：slow * 5
DPO：length * 5
VDO：max(length, emaSmoothing) * 5
VMI：slowLength * 5
TSI：longLength * 5 + shortLength * 3
SQZMOM：max(bbLength, kcLength) * 5
MR-M5：1200 warmup + 300 lookahead
MR-M30：1200 warmup + 300 lookahead
MMF_V3：1200 warmup + 300 lookahead
VWAP：优先使用 sessionAnchor，后续独立实现
Vol：0
```

注意：

```text
第一阶段不要追求每个指标最精确 warmup。
先保守，保证指标连续性。
后续再逐步参数化。
```

### 3.4 Indicator Manager

职责：

1. 接收 PageDataSlice。
2. 使用 calculationRows 计算指标。
3. 按 barKey 把指标结果裁剪回 displayRows。
4. 输出与 displayRows 一一对应的 IndicatorPageResult。
5. 维护 settingsHash。
6. 维护 indicator result cache。

建议类型：

```ts
type IndicatorPageResult = {
  pageKey: string
  settingsHashMap: Record<string, string>
  rows: Array<{
    barKey: string
    time: number
    sourceIndex: number
    values: Record<string, unknown>
  }>
  byBarKey: Record<string, Record<string, unknown>>
}
```

关键规则：

```text
Indicator Manager 不直接操作 KLineCharts。
Indicator Manager 不决定页面范围。
Indicator Manager 只输出页面指标结果。
指标结果 rows.length 必须等于 displayRows.length。
指标结果必须按 barKey 对齐，不准用裸 index 对齐。
```

### 3.5 Page Window Manager

职责：

1. 接收 PageDataSlice。
2. 接收 IndicatorPageResult。
3. 生成 Realtime Page Window 或 History Page Window。
4. 管理当前激活窗口。
5. 管理窗口缓存。
6. 通知 Chart Adapter 切换窗口。

建议类型：

```ts
type PageWindowManagerState = {
  activeWindowKey: string | null
  realtimeWindows: Record<string, ChartPageWindow>
  historyWindows: Record<string, ChartPageWindow>
}
```

窗口 key：

```text
realtime:{symbol}:{period}
history:{symbol}:{period}:{pageIndex}:{fromGlobalIndex}:{toGlobalIndex}
```

### 3.6 Realtime Page Window

职责：

1. 保存实时页 displayRows。
2. 保存实时页 calculationRows。
3. 保存实时页 indicators。
4. 接收 tick。
5. 判断 tick 是更新当前 bar 还是追加新 bar。
6. 更新 Realtime Page Buffer。
7. 更新实时页指标尾部。
8. 输出给 Chart Adapter。
9. 达到 2500 根时触发整理事件。

规则：

```text
Realtime Page Window 是活的。
它可以变化。
它接收 tick。
它拥有当前实时页最终状态。
KLineCharts 不直接接 tick，tick 先进入 Realtime Page Window。
```

### 3.7 History Page Window

职责：

1. 保存历史页 displayRows。
2. 保存历史页 calculationRows。
3. 保存历史页 indicators。
4. 保存当前页状态。
5. 支持用户返回该历史页时恢复。

规则：

```text
History Page Window 是静态的。
它不接 tick。
它不被实时行情打断。
它可以显示 History Realtime Price Marker，但不改写自己的 K 线。
```

### 3.8 Chart Adapter

职责：

1. 接收当前激活 Page Window。
2. 把 displayRows 写入 KLineCharts。
3. 把 indicator results 写入或绑定到 KLineCharts 指标。
4. 根据窗口 behavior 决定是否 followLatest。
5. 根据窗口 mode 决定是否显示倒计时、实时价标记。
6. 实时页更新时，只更新尾部。
7. 历史页切换时，整页加载。

规则：

```text
Chart Adapter 是唯一可以直接操作 KLineCharts 的模块。
其他模块不直接调用 chart.applyNewData / chart.updateData。
```

---

## 4. 旧结构问题与新结构修复点

### 4.1 当前旧结构问题

```text
1. K 线先进入 KLineCharts，指标后补。
2. 指标结果依赖 snapshot / pageKey / settingsHash / runtimeOnly，生命周期容易错位。
3. warmupRows 即使加载，也可能没有成功映射回图表。
4. 实时 tick 直接碰 KLineCharts，实时页窗口概念不够明确。
5. 历史页和实时页行为差异分散在多个 hook 中。
6. displayRows、calculationRows、indicatorRows 没有被统一包装成 Page Window。
```

### 4.2 新结构修复点

```text
1. 先构建 Page Window，再交给图表。
2. K 线和指标在 Page Window 中统一成为一页完整状态。
3. warmupRows / lookaheadRows 只在 Page Data Provider 和 Indicator Manager 内部使用。
4. 图表只接收 displayRows + 已裁剪好的指标结果。
5. 实时页尾部跳动统一由 Realtime Page Window 管理。
6. 历史页静态状态统一由 History Page Window 管理。
7. Chart Adapter 成为唯一 KLineCharts 写入入口。
```

---

## 5. 实施阶段

### 阶段 1：架构文档和命名统一

新增或更新文档：

```text
docs/02_项目架构/04_StoreV6页面管理系统架构.md
```

补充以下章节：

```text
Page Window Manager
Realtime Page Window
History Page Window
Page Data Provider
Indicator Requirement Resolver
Indicator Manager
Chart Adapter
```

统一命名：

```text
Page Planner
PagePlanItem
Page Data Provider
PageDataSlice
Indicator Requirement Resolver
Indicator Manager
IndicatorPageResult
Page Window Manager
ChartPageWindow
Realtime Page Window
History Page Window
Chart Adapter
```

### 阶段 2：抽出 PageDataSlice

基于现有：

```text
frontend/src/workbench/chart/pageData/pageDataLoader.ts
frontend/src/workbench/chart/pageData/pageDataTypes.ts
```

升级为：

```text
frontend/src/workbench/chart/pageData/pageDataProvider.ts
frontend/src/workbench/chart/pageData/pageDataSlice.ts
```

目标：

```text
统一输出 displayRows / warmupRows / lookaheadRows / calculationRows / displayOffset。
禁止 KLineCharts 直接读取 warmupRows / lookaheadRows。
```

### 阶段 3：启用 Indicator Requirement Resolver

基于现有：

```text
frontend/src/workbench/chart/indicatorWarmupPlanner.ts
```

改造为：

```text
frontend/src/workbench/chart/indicator/indicatorRequirementResolver.ts
```

目标：

```text
不再返回固定 0。
先对历史页启用。
先对 MA / VDO 验证。
再扩展 RSI / TSI / SQZMOM / MR。
```

验收：

```text
VDO 历史页：
  displayRows = 2500
  warmupRows > 0
  calculationRows > displayRows
  indicatorRows.length = displayRows.length
  第一根 displayRows 已有有效指标值
```

### 阶段 4：抽出 Indicator Manager

基于现有：

```text
pageIndicatorRuntime.ts
indicatorPageSnapshotStore.ts
chartIndicatorCommandHandlers.ts
```

新增：

```text
frontend/src/workbench/chart/indicator/indicatorManager.ts
frontend/src/workbench/chart/indicator/indicatorPageResult.ts
```

目标：

```text
用 calculationRows 计算。
用 barKey 裁剪回 displayRows。
输出 IndicatorPageResult。
不直接操作 KLineCharts。
```

### 阶段 5：实现 History Page Window

新增：

```text
frontend/src/workbench/chart/pageWindow/historyPageWindow.ts
```

目标：

```text
点击历史页时，完整构建 History Page Window。
K 线和指标一起准备好。
再交给 Chart Adapter。
历史页不接 tick。
```

### 阶段 6：实现 Realtime Page Window

新增：

```text
frontend/src/workbench/chart/pageWindow/realtimePageWindow.ts
```

迁移现有：

```text
realtimePageBuffer.ts
useChartRealtimeTicks.ts
realtimeIndicatorRuntime.ts
```

目标：

```text
tick 先进入 Realtime Page Window。
Realtime Page Window 更新 displayRows 和指标尾部。
Chart Adapter 再把尾部更新写入 KLineCharts。
```

### 阶段 7：实现 Chart Adapter

新增：

```text
frontend/src/workbench/chart/chartAdapter/chartWindowAdapter.ts
```

目标：

```text
统一 chart.applyNewData / chart.updateData / indicator apply 入口。
ChartCoreHost 不再散落直接操作 KLineCharts。
```

### 阶段 8：逐步迁移 ChartCoreHost

当前 ChartCoreHost 负责太多：

```text
数据加载
页面判断
实时 tick
指标命令
snapshot
overlay
KLineCharts 写入
```

迁移目标：

```text
ChartCoreHost 只负责组装模块和传递 props。
真实逻辑下沉到 Page Window Manager / Chart Adapter。
```

---

## 6. 迁移安全策略

不要一次性替换全部。

推荐顺序：

```text
1. 先实现 History Page Window。
2. 只对历史页启用 Page Window 架构。
3. 只接 MA / VDO 两个简单 row-by-row 指标。
4. 验证 warmup 成功。
5. 再接 RSI / TSI / SQZMOM。
6. 再单独处理 MR。
7. 最后迁移 Realtime Page Window。
```

为什么先历史页：

```text
历史页静态。
pageKey 稳定。
displayRows 稳定。
不接 tick。
问题更容易定位。
```

为什么最后迁移实时页：

```text
实时页有 tick。
最后一根会跳动。
pageKey 可能变化。
窗口 rows 可能增长。
指标需要增量刷新。
复杂度更高。
```

---

## 7. 调试指标

必须增加调试输出：

```text
PagePlanItem:
  pageIndex
  mode
  fromGlobalIndex
  toGlobalIndex
  rows

PageDataSlice:
  displayRows.length
  warmupRows.length
  lookaheadRows.length
  calculationRows.length
  displayOffset
  firstDisplayBarKey
  lastDisplayBarKey
  firstCalculationBarKey
  lastCalculationBarKey

IndicatorManager:
  indicator
  settingsHash
  calculationInputRows
  outputRows
  firstValidOutputIndex
  outputRows.length === displayRows.length

PageWindow:
  windowKey
  mode
  builtAt
  displayRows
  indicators
  behavior

ChartAdapter:
  applyNewData rows
  updateData barKey
  activeWindowKey
```

最小验收断言：

```text
1. displayRows.length > 0
2. calculationRows.length >= displayRows.length
3. indicatorRows.length === displayRows.length
4. displayRows 每一根都有 barKey
5. indicatorRows 按 barKey 对齐 displayRows
6. KLineCharts 当前 dataList.length === activeWindow.displayRows.length
```

---

## 8. 验收标准

### 8.1 历史页验收

1. 点击第 2 页，生成 History Page Window。
2. History Page Window 包含 displayRows / calculationRows / indicators。
3. KLineCharts 只显示 displayRows。
4. 指标使用 calculationRows 计算。
5. 指标结果裁剪回 displayRows。
6. VDO / MA 在页面左侧第一段不再因为缺少 warmup 而断开。
7. 历史页不接 tick。
8. 历史页显示实时价标记时，不改写历史 K 线。

### 8.2 实时页验收

1. 打开第 1 页，生成 Realtime Page Window。
2. Realtime Page Window 初始 displayRows 为最新 2000 根。
3. tick 到来时，更新 Realtime Page Window，而不是直接绕过窗口写 KLineCharts。
4. 当前 bar 内 tick 更新最后一根。
5. 新周期 tick append 新 K。
6. Realtime Page Window 可增长到 2500 根。
7. 达到整理阈值后触发 Page Maintenance。
8. 实时页指标尾部能同步更新。

### 8.3 架构验收

1. Page Planner 不加载 OHLCV。
2. Page Data Provider 不操作 KLineCharts。
3. Indicator Manager 不操作 KLineCharts。
4. Page Window Manager 不直接查询 StoreV6。
5. Chart Adapter 是唯一 KLineCharts 写入入口。
6. displayRows 只表示当前页显示数据。
7. calculationRows 只表示指标计算数据。
8. warmupRows / lookaheadRows 不进入主图显示。
9. 指标结果必须按 barKey 对齐。
10. ChartCoreHost 职责明显变薄。

---

## 9. 核心结论

这次升级的本质是：

```text
从“图表先加载，指标后补”的旧模式，
升级为“Page Window 先构建完整页面状态，再统一交给图表”的新模式。
```

最终稳定结构：

```text
PagePlanItem = 我要哪一页。
PageDataSlice = 这一页需要的所有 K 线数据。
IndicatorPageResult = 这一页算好的指标。
ChartPageWindow = 这一页最终图表状态。
ChartAdapter = 把这一页状态写进 KLineCharts。
```

最终边界：

```text
实时页窗口负责活数据。
历史页窗口负责静态页。
前面的请求器和指标管理器把数据拼好。
后面的 KLineCharts 只显示当前激活窗口。
```

这套架构完成后，StoreV6 页面系统会从“分页 + 快照 + 实时补丁”升级成真正的页面运行时系统。后续 MMF 指标、Signal Table、Trade Table、回放系统，都可以直接基于 Page Window 和 barKey/globalIndex 坐标继续扩展。
