# V2 分页架构与 KLineChart 渲染链路

本文档用于记录当前 V2 图表系统的真实分页架构、数据流、模块边界和关键文件。后续维护这套链路时，先读本文档，再改代码。

这套系统的核心目标是：

1. 历史页、实时页、刷新恢复、跳页移动必须分开。
2. 数据请求、指标计算、窗口合并、KLineChart 渲染必须分层。
3. 渲染层只消费最终 frame，不重新计算指标。
4. 刷新不是重新跳页，刷新要恢复当前视角。
5. 点击分页列表是跳页移动，跳页移动要按目标页重新放置视角。

## 1. 总体数据流

完整链路如下：

```text
StoreV6 仓库数据
  -> 时间对齐分页器
  -> 需求切片器
  -> 历史页 K 线请求
  -> 历史窗口
  -> 指标总控台
  -> 历史窗口指标合并
  -> 实时窗口
  -> 实时指标补齐和尾部更新
  -> chart render window
  -> KLineChart render frame
  -> KLineChart 渲染系统 v2
```

其中：

- 分页器只负责页边界。
- 需求切片器负责按页边界读取仓库数据。
- 历史窗口只负责当前历史页窗口。
- 实时窗口只负责实时页窗口和准历史数据。
- 指标总控台负责指标需求、预热、依赖、计算和缓存。
- 渲染系统只负责把最终 frame 放到 KLineChart 上。

## 2. 分页模型

当前系统存在两类页面：

1. 历史页
   - 第 1 页、第 2 页、第 3 页等。
   - 每一页由 StoreV6 的分页器按时间边界切出来。
   - 历史页本身是固定数据，进入缓存后不应该因为左右拖动反复计算。

2. 实时页
   - 实时页不是普通历史页。
   - 它由历史页右侧接出的实时窗口组成。
   - 当前打开第 1 页时，实时页通常在右侧显示。
   - 当前打开历史页时，实时页可以在后台存在，用于恢复和实时状态维护，但不能被误认为当前历史页。

关键点：

- 第 1 页不是唯一默认页。
- 当前页是多少，刷新恢复就应该恢复哪一页。
- 实时页在后台时，也要允许系统恢复当前页和实时边界状态。
- 不要把“第 1 页 + 实时页”的行为写死成默认模式。

### 2.1 周期分页能力开关

不是所有周期都已经接入 V2 时间分页系统。

当前支持周期由这个文件统一声明：

```text
frontend/src/workbench/chart/pagePartition/periodPageSystemV2.ts
```

当前只有：

```text
M5
M30
```

M5 是按日会话滚动的时间分页系统。M30 是按周归档、按四个完成交易周组成一个历史页的时间分页系统。

M30 规则：

- 历史页：每页覆盖四个已经完成的交易周，第一页结束在上一个周五收盘边界。
- 实时页：从下一周周一 06:00 开始，直到当前活动 M30 K 线。
- 准历史数据：实时窗口中已经收盘的 M30 K 线都属于准历史数据；最后一根 M30 是活动数据。
- 容量估算：正常一周约 288 根 M30，但这只是估算，不能作为硬截断上限；实际数据必须按 `timeFrom/timeTo` 周期边界请求。
- 周五收盘后：本周实时窗口才可以归档进历史分页，并重新生成第一页边界。

未接入周期分页系统的周期，例如 H1、H4 等：

- 顶部周期按钮可以显示，但不能点击打开图表。
- 右侧 MT5 周期按钮可以显示，但不能点击打开图表。
- 历史分页页签里的“更新”按钮禁用。
- 自动打开、刷新推送、StoreV6 作业完成后的打开图表入口都必须跳过。
- 不能走旧 rows 分页链路把数据放进 KLineChart。

未来接入其它周期时，先新增该周期独立的时间分页器，再把 `periodPageSystemV2.ts` 里的支持名单加入对应周期。

关键文件：

- `frontend/src/workbench/chart/pagePartition/pagePartitionBuilder.ts`
- `frontend/src/workbench/chart/pagePartition/periodPageSystemV2.ts`
- `frontend/src/workbench/chart/pagePartition/timeAligned/timeAlignedPageTypes.ts`
- `frontend/src/workbench/chart/pagePartition/timeAligned/m5TradingAnchors.ts`
- `frontend/src/workbench/chart/pagePartition/timeAligned/m30TradingAnchors.ts`
- `frontend/src/workbench/chart/pagePartition/timeAligned/m30TradingMonthPaginator.ts`
- `frontend/src/workbench/chart/pagePartition/timeAligned/timeAlignedRealtimeAnchors.ts`
- `frontend/src/workbench/chart/pageSliceV2/storeV6PageSliceReader.ts`
- `frontend/src/workbench/chart/historyPageRequestV2.ts`

## 3. 历史窗口

历史窗口是当前历史页的数据承载层。

它应该包含：

- 当前历史页显示用 K 线。
- 当前历史页边界。
- 当前历史页在 StoreV6 全局索引中的范围。
- 指标计算可能需要的 warmup 前置数据。
- 用于指标输出对齐的 `displayOffset`。

历史窗口不应该做的事：

- 不主动向上请求 warmup 数据。
- 不决定指标需要多少前置 K 线。
- 不重新切分页。
- 不处理 KLineChart 视角。

正确职责是：

```text
接收页请求结果
  -> 建立 historyRows
  -> 建立 calculationRows
  -> 记录 displayOffset
  -> 提供给指标总控台和后续窗口合并器
```

关键文件：

- `frontend/src/workbench/chart/historyPageWindowV2/historyPageWindowBuilder.ts`
- `frontend/src/workbench/chart/historyPageWindowV2/historyPageWindowTypes.ts`
- `frontend/src/workbench/chart/historyPageWindowV2/index.ts`

## 4. 实时窗口

实时窗口负责把实时数据整理成可并入最终 frame 的窗口。

它包含三类数据概念：

1. 实时 page buffer
   - 本地实时 K 线缓冲。
   - 来自 MT5 实时 tick 和本地补齐。
   - 用于恢复实时页和尾部更新。

2. stable realtime window
   - 把实时数据整理成稳定窗口。
   - 解决实时数据和历史数据的边界衔接。

3. 准历史数据
   - 实时页已经形成的稳定 K 线，可以给指标使用。
   - 指标总控台可以从实时窗口拿准历史数据进行实时段计算。

实时窗口不应该直接承担历史分页职责。它只负责实时段。

关键文件：

- `frontend/src/workbench/chart/realtimePageBuffer.ts`
- `frontend/src/workbench/chart/realtimePageWindowV2/realtimePageWindowBuilder.ts`
- `frontend/src/workbench/chart/realtimePageWindowV2/realtimePageWindowRowsV2.ts`
- `frontend/src/workbench/chart/realtimePageWindowV2/realtimeStableWindowCacheV2.ts`
- `frontend/src/workbench/chart/realtimePageWindowV2/realtimePageMonitorV2.ts`
- `frontend/src/workbench/chart/useChartRealtimeTicks.ts`

## 5. 指标总控台

指标总控台是指标系统的唯一计算入口。

它负责：

- 读取当前已加载指标。
- 读取每个指标的参数。
- 判断每个指标需要多少 warmup。
- 向需求切片器请求补足的 calculationRows。
- 对历史窗口计算指标。
- 对实时窗口计算指标。
- 对 MMF_v3 这类复合指标处理依赖编排。
- 输出已经对齐好的 pane rows。

指标总控台不应该做的事：

- 不直接控制 KLineChart 渲染。
- 不让渲染层重新计算指标。
- 不向历史窗口合并器向下要 warmup。
- 不把隐藏依赖指标显示到前台。

关键链路：

```text
indicator request
  -> registry
  -> warmup planner
  -> warmup preheater
  -> compute cache
  -> runtime calculator
  -> history/realtime pane rows
```

关键文件：

- `frontend/src/workbench/chart/indicatorRequestV2/indicatorRequestControllerV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/indicatorRequestTypes.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/indicatorRegistryV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/indicatorWarmupPlannerV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/indicatorWarmupPreheaterV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/indicatorComputeCacheV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/indicatorRuntimeV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/indicatorRealtimeUpdateV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/realtimeIndicatorStableCacheV2.ts`

## 6. 复合指标依赖编排

MMF_v3 不是普通单线指标。它是复合判断指标。

当前正确模型是：

```text
MMF_v3 被加载
  -> 总控台读取 MMF_v3 需要的依赖
  -> 检查前台是否已经挂载这些依赖指标
  -> 前台没有挂载的依赖，由隐藏依赖模块自动挂载计算
  -> 所有依赖结果交给 MMF_v3
  -> MMF_v3 只做自己的判断输出
  -> 输出结果再进入 V2 frame
```

注意：

- MMF_v3 不应该恢复旧后台独立计算链路。
- MMF_v3 可以使用其它指标的计算结果。
- 其它指标没显示在前台，也可以通过隐藏依赖计算。
- 如果前台已经挂载同参数指标，不要重复隐藏计算。
- MMF_v3 的显示样式和依赖指标的显示样式没有关系。
- MMF_v3 只关心依赖指标参数和结果是否对齐。

关键文件：

- `frontend/src/workbench/chart/indicatorRequestV2/compositeIndicatorDependencyOrchestratorV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/mmfV3IndicatorV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/mmfV3FrontendEngineV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/mmfV3FrontendMathV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/mmfV3FeatureRowsV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/mmfV3StochStateSignalsV2.ts`
- `frontend/src/workbench/chart/mmfV3Types.ts`
- `docs/02_项目架构/08_MMF_v3真实算法与V2接入链路.md`

## 7. chart render window

chart render window 是历史窗口和实时窗口进入最终 frame 之前的合并层。

它负责：

- 把历史 K 线和实时 K 线拼成一个渲染窗口。
- 标记历史段和实时段。
- 修正实时段起始索引。
- 保证主图 K 线和指标 pane rows 长度对齐。
- 给后续 render frame builder 提供稳定输入。

关键点：

- 历史段和实时段要有明确边界。
- 实时段不能丢第一根 K 线。
- 成交量、指标和主 K 线要按同一套索引对齐。
- MR 这类按时间段分组的指标，必须知道实时段起始位置。

关键文件：

- `frontend/src/workbench/chart/chartRenderWindowV2/chartRenderWindowBuilder.ts`
- `frontend/src/workbench/chart/chartRenderWindowV2/chartRenderWindowTypes.ts`
- `frontend/src/workbench/chart/chartRenderWindowV2/index.ts`

## 8. KLineChart render frame

render frame 是渲染系统唯一应该接收的数据结构。

它包含：

- `mainRows`
- `panes`
- `segments.history`
- `segments.realtime`
- `pageIndex`
- `pageNavigation`
- `symbol`
- `period`
- `key`

渲染层不应该重新向 StoreV6 请求数据，也不应该重新计算指标。它只消费 frame。

关键文件：

- `frontend/src/workbench/chart/klineChartRenderFrameV2/klineChartRenderFrameBuilder.ts`
- `frontend/src/workbench/chart/klineChartRenderFrameV2/klineChartRenderFrameTypes.ts`
- `frontend/src/workbench/chart/klineChartRenderFrameV2/index.ts`

## 9. KLineChart 渲染系统 v2

KLineChart 渲染系统 v2 的职责是把 render frame 放到 klinecharts 实例上。

模块分层：

```text
KLineChartHostV2
  -> klineChartRenderer
  -> frame apply controller
  -> frame lifecycle
  -> overlay controller
  -> indicator lifecycle
  -> realtime pane
  -> axis label layer
```

### 9.1 Host

Host 负责 React 层容器、图表实例挂载和生命周期入口。

关键文件：

- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartHostV2.tsx`
- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartMainPaneV2.tsx`
- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartSubPaneStackV2.tsx`
- `frontend/src/workbench/chart/klineChartRendererV2/BlankKLineChartHostV2.tsx`

### 9.2 frame apply controller

负责把 frame 应用到 KLineChart，并避免拖动、刷新、实时 tick 之间互相打架。

关键文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartFrameApplyControllerV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartFrameLifecycleV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/chartRafSchedulerV2.ts`

### 9.3 overlay controller

overlay controller 只管理渲染覆盖层。

现在指标生命周期已经从 overlay controller 里拆出。overlay controller 不应该再直接安装 MA、MR、VDO、VMI 等指标。

关键文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartOverlayControllerV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartAxisLabelLayerV2.tsx`
- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartRealtimePaneV2.ts`

## 10. 指标生命周期模块

指标生命周期模块属于 KLineChart 渲染系统，但它只负责“把已经算好的指标结果挂到 klinecharts”，不负责指标计算。

当前拆分：

1. `klineChartIndicatorLifecycleV2.ts`
   - 指标生命周期总入口。
   - 安装各指标 renderer。
   - 根据 frame 更新各指标。
   - 记录 dev perf。

2. `klineChartIndicatorFrameIdentityV2.ts`
   - 判断某个指标 pane 是否真的变化。
   - 没变化就跳过更新，减少左右拖动卡顿。

3. `klineChartIndicatorSnapshotBridgeV2.ts`
   - 生成指标 pageKey。
   - 生成 settingsHash。
   - 生成 runtime calcParams。
   - 统一连接 indicator snapshot store。

4. `klineChartIndicatorMountAdapterV2.ts`
   - 统一处理 `getIndicatorByPaneId`、`createIndicator`、`overrideIndicator`、`removeIndicator`。
   - MA、VWAP、MMF_v3、STOCH、TSI、VDO、VMI 已接入。

5. `klineChartSubPaneHeightLifecycleV2.ts`
   - 统一保存和恢复副图高度。
   - STOCH、TSI、VDO、VMI 共用。

指标 renderer 文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartMainMaOverlayV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartMainMmfV3OverlayV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartMainMorganRangeOverlayV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartMainVolumeOverlayV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartMainVwapOverlayV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartSubPaneStochV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartSubPaneTsiV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartSubPaneVdoV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartSubPaneVmiV2.ts`

## 11. MR 指标特殊边界

MR 已进入 KLineChart 生命周期，但它不是普通连续线指标。

MR 的关键要求：

- 保留原始 fib 样式。
- 按配置周期分段，例如 M5 下每 4 小时一段。
- 每段不要连成一条连续线。
- 实时段要能显示。
- 价格轴缩放后，MR 几何要跟随刷新。

关键文件：

- `frontend/src/workbench/chart/indicatorRequestV2/morganRangeIndicatorV2.ts`
- `frontend/src/workbench/chart/tradingViewMrIndicator.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartMainMorganRangeOverlayV2.ts`
- `frontend/src/workbench/chart/fibRetracementOverlayFigures.ts`
- `frontend/src/workbench/chart/morganRangePreset.ts`

## 12. 刷新恢复

刷新恢复不是跳页。

刷新恢复的语义是：

```text
当前用户停在哪一页
  -> 记录当前页
  -> 记录当前视角
  -> 刷新后恢复这页数据
  -> 恢复最后拖动位置
  -> 恢复 Y 轴和窗口配置
  -> 不重新按点击分页列表的逻辑定位
```

刷新恢复要恢复：

- 当前 symbol。
- 当前 period。
- 当前 pageIndex。
- 当前 page target。
- 当前实时开关。
- 当前横向 viewport。
- 当前 Y 轴范围。
- 指标窗格高度。

关键文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRenderPageConfigV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRefreshRestoreConfigV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartViewportStateV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartYAxisRestoreV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRenderStateControllerV2.ts`

注意：

- 刷新恢复要恢复当前视角，不要触发跳页移动。
- 如果用户停在历史页刷新，不能默认回到实时页。
- 如果实时页在后台，也要允许当前历史页恢复。

## 13. 跳页移动

跳页移动是用户点击分页列表或通过页边界按钮移动时的逻辑。

它和刷新恢复不同。

跳页移动的语义是：

- 点击第 1 页，应该看到实时页尾部或第一页对应默认位置。
- 点击第 2 页、第 3 页，应该按分页列表动作定位。
- 连续向左翻页时，从第 2 页第一根进入第 3 页，应看到第 3 页最后一根附近。
- 连续向右翻页时，从第 4 页最后一根进入第 3 页，应看到第 3 页第一根附近。
- 从第 11 页直接跳回第 1 页，不等于连续移动 10 页，应使用跳页默认定位。

关键文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartPageJumpMovementV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRenderViewportPolicyV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRenderPageConfigV2.ts`

禁止事项：

- 不要把刷新恢复走成跳页移动。
- 不要把跳页移动走成刷新恢复。
- 不要只靠第 1 页默认行为处理所有页面。

## 14. 实时边界和页标签

实时边界负责在图上标出历史段和实时段的分界。

它需要支持：

- 上下纵轴拖动时边界线即时跟随。
- 左右横轴拖动时边界线即时跟随。
- 历史页标签和实时页标签正确落在主图成交量区域附近。
- 当前页开盘、当前页停盘、实时页开盘三个标签分别显示。

关键文件：

- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartRealtimePaneV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRealtimeBoundaryV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRealtimePageLabelsV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRealtimePaneV2.css`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRealtimeXAxisV2.ts`

## 15. 缓存分层

当前缓存分层大致分为：

1. StoreV6 仓库缓存
   - 原始历史 K 线数据。

2. 分页缓存
   - 页边界、页索引、页范围。

3. 历史窗口缓存
   - 当前页窗口。
   - calculationRows 和 displayRows。

4. 实时窗口缓存
   - realtime page buffer。
   - stable realtime window。
   - realtime snapshot。

5. 指标计算缓存
   - 按指标参数、页 key、输入 rows 缓存计算结果。

6. indicator page snapshot
   - 渲染层指标使用的页级快照。
   - 用于刷新恢复和避免重复转换。

7. chart render cache
   - 缓存最终可渲染窗口和尾部 patch。

关键文件：

- `frontend/src/workbench/chart/chartRenderCacheV2/chartRenderCache.ts`
- `frontend/src/workbench/chart/chartRenderCacheV2/chartRenderFrameTailPatchV2.ts`
- `frontend/src/workbench/chart/indicatorPageSnapshotStore.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/indicatorComputeCacheV2.ts`
- `frontend/src/workbench/chart/realtimePageWindowV2/realtimeStableWindowCacheV2.ts`
- `frontend/src/workbench/chart/realtimePageBuffer.ts`

## 16. 缓存清理

历史页缓存清理和实时页缓存清理不能混在一起。

历史页切换时：

- 可以清理历史窗口缓存。
- 可以清理 chart render window。
- 可以重建当前 page frame。
- 不应该清空实时 page buffer。

实时停盘或重建实时页时：

- 可以清理实时 page buffer。
- 可以清理 stable realtime window。
- 可以清理 realtime snapshot。
- 不应该清掉历史页缓存。

关键文件：

- `frontend/src/workbench/chart/historyPageCacheCleanupV2.ts`

## 17. 性能策略

当前性能优化重点：

1. 左右拖动时不要重算历史指标。
2. 尾部实时 tick 只更新尾部。
3. 没变化的指标 pane 不要 overrideIndicator。
4. KLineChart 边界线和标签跟随横轴时使用轻量刷新。
5. MR 价格轴变化只刷新几何，不重新计算 MR 算法。
6. MMF_v3 的依赖计算进入缓存后，不要重复计算整页。

关键文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartIndicatorFrameIdentityV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartIndicatorLifecycleV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartFrameApplyControllerV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/chartRafSchedulerV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartBenchmarkV2.ts`
- `frontend/src/workbench/chart/chartRenderCacheV2/chartRenderFrameTailPatchV2.ts`

浏览器调试入口：

- `window.__ffKLineChartV2IndicatorLifecyclePerf`
- `window.__ffKLineChartV2OverlayPerf`
- `window.__ffKLineChartV2MrDebug`
- `window.__ffKLineChartV2`

## 18. 当前重要入口文件

React 和工作区入口：

- `frontend/src/workbench/chart/ChartWorkspaceV2.tsx`
- `frontend/src/workbench/chart/ChartCoreHost.tsx`
- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartHostV2.tsx`

数据分页和窗口：

- `frontend/src/workbench/chart/pageSliceV2/storeV6PageSliceReader.ts`
- `frontend/src/workbench/chart/historyPageWindowV2/historyPageWindowBuilder.ts`
- `frontend/src/workbench/chart/realtimePageWindowV2/realtimePageWindowBuilder.ts`
- `frontend/src/workbench/chart/chartRenderWindowV2/chartRenderWindowBuilder.ts`
- `frontend/src/workbench/chart/klineChartRenderFrameV2/klineChartRenderFrameBuilder.ts`

指标系统：

- `frontend/src/workbench/chart/indicatorRequestV2/indicatorRequestControllerV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/compositeIndicatorDependencyOrchestratorV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/mmfV3IndicatorV2.ts`
- `frontend/src/workbench/chart/indicatorRequestV2/morganRangeIndicatorV2.ts`

渲染系统：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRenderer.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartOverlayControllerV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartIndicatorLifecycleV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRenderPageConfigV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartPageJumpMovementV2.ts`

## 19. 修改时的禁止事项

1. 不要让分页器理解指标 warmup。
2. 不要让历史窗口向下游模块要 warmup。
3. 不要让 KLineChart 渲染层重新计算指标。
4. 不要把刷新恢复和跳页移动合成一个逻辑。
5. 不要把实时页当成普通历史页。
6. 不要把第 1 页写死成唯一默认页。
7. 不要让 MMF_v3 回到旧后台独立计算链路。
8. 不要把隐藏依赖指标显示到前台。
9. 不要在左右拖动时触发整页指标重算。
10. 不要把 MR 的 4 小时分段画成连续线。

## 20. 排错顺序

### 20.1 历史页刷新后出不来

先查：

1. `klineChartRenderPageConfigV2.ts` 是否读到正确 pageIndex。
2. `restoreKLineChartRenderPageTargetV2` 是否拿到历史窗口。
3. `historyPageWindowBuilder.ts` 是否生成 historyRows。
4. `klineChartRenderFrameBuilder.ts` 是否生成 mainRows。
5. `KLineChartHostV2.tsx` 是否收到 frame。

### 20.2 切换页面后位置不对

先查：

1. `klineChartPageJumpMovementV2.ts`
2. `klineChartRenderViewportPolicyV2.ts`
3. `klineChartViewportStateV2.ts`
4. 当前动作到底是刷新恢复还是跳页移动。

### 20.3 实时段丢 K 线

先查：

1. `realtimePageBuffer.ts`
2. `realtimePageWindowBuilder.ts`
3. `chartRenderWindowBuilder.ts`
4. `segments.realtime.fromIndex`
5. 主图 rows 和指标 pane rows 长度是否一致。

### 20.4 指标加载不出来

先查：

1. `indicatorRequestControllerV2.ts` 是否有请求。
2. `indicatorWarmupPreheaterV2.ts` 是否拿到 calculationRows。
3. `indicatorComputeCacheV2.ts` 是否命中或写入。
4. `klineChartRenderFrameBuilder.ts` 是否把 pane rows 放进 frame。
5. `klineChartIndicatorLifecycleV2.ts` 是否安装了 renderer。
6. `klineChartIndicatorMountAdapterV2.ts` 是否真正 create/override。

### 20.5 左右拖动卡顿

先查：

1. `window.__ffKLineChartV2IndicatorLifecyclePerf`
2. `window.__ffKLineChartV2OverlayPerf`
3. 是否有指标 pane 被重复 override。
4. 是否有 MMF_v3 或 MR 被整页重算。
5. 是否有边界线和页标签在高频事件里做重布局。

### 20.6 MR 样式或分段错误

先查：

1. `morganRangeIndicatorV2.ts` 的输出段。
2. `tradingViewMrIndicator.ts` 的 figure 生成。
3. `klineChartMainMorganRangeOverlayV2.ts` 的实时段和 price scale 刷新。
4. `fibRetracementOverlayFigures.ts` 是否保留原始样式。

## 21. 一句话记忆

V2 分页系统不是“点击第 1 页就渲染一页”的简单结构。它是：

```text
分页器定边界
需求切片器取数据
历史窗口放当前页
实时窗口放实时段
指标总控台算指标
render window 合并历史和实时
render frame 作为唯一渲染输入
KLineChart v2 只负责生命周期和显示
刷新恢复恢复当前视角
跳页移动按分页动作重新定位
```
