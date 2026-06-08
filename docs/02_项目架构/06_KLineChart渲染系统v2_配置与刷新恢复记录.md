# KLineChart 渲染系统 v2：配置与刷新恢复记录

本文记录 2026-06-08 对 KLineChart 渲染系统 v2 的几次定位和改动，后续排查刷新、视窗恢复、Y 轴自动缩放、实时尾部更新时优先参考这里。

## 当前模块位置

渲染系统 v2 当前属于左侧图表框架，不属于 MT5 数据中心右侧抽屉。

核心链路：

1. 历史分页模块准备 `historyWindow`。
2. 实时窗口模块准备 `realtimeWindow`。
3. 分层缓存模块生成最终 `KLineChartRenderFrameV2`。
4. `KLineChartHostV2` 持有 KLineCharts 实例。
5. `klineChartRenderer.ts` 把最终 frame 写入 KLineCharts。
6. 覆盖层、标题、标签、分页边界标签只读 frame 和 chart 状态，不负责重新算数据。

## 渲染状态控制器

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRenderStateControllerV2.ts`

该模块用于统一管理渲染系统 v2 的“数据进入前配置”和“数据 ready 后恢复”，避免这些逻辑继续散落在 `KLineChartHostV2` 中。

职责分两段：

### 1. 数据进入前：静态渲染配置

入口：

```ts
applyKLineChartPreDataRenderConfigV2(chart)
```

作用：

- 应用主图容器静态配置。
- 设置滚动、缩放、主图 pane、Y 轴 pane 选项。
- 设置左侧边界和右侧实时可拉开距离。

这部分属于“固定渲染模式”，可以在 `applyNewData` 之前执行。

### 2. 数据 ready 后：动态状态恢复

入口：

```ts
createKLineChartRenderStateControllerV2(chart, getViewportState)
```

核心方法：

- `beginFrameRestore(frame, { sameRenderWindow })`
  - full frame 写入前创建恢复计划。
  - 计算是否需要实时边界锚定。
  - 决定是否保留当前可见范围。
  - 暂停 viewport 缓存保存，避免 KLineCharts 初始状态反写缓存。

- `handleDataReady()`
  - `applyNewData` 完成后执行。
  - resize chart。
  - 在不恢复 Y range 时，让主图 Y 轴回到自动计算。

- `restoreViewport`
  - 由 `beginFrameRestore` 返回给 frame renderer。
  - 在数据 ready 后恢复横向视窗和可选 Y range。
  - 恢复完成后延迟打开 viewport 缓存写入。

设计原则：

- `KLineChartHostV2` 只负责实例生命周期和把 frame 推给 renderer。
- Host 不直接判断 `restoreYAxisRangeOnRefresh / restoreHorizontalViewportOnRefresh / anchorRealtimeBoundaryOnFrameLoad`。
- 动态状态必须在 `applyNewData` 完成后恢复；静态配置才允许在数据进入前应用。

## 配置模块

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartConfigV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/klineChartMainContainerSettingsV2.ts`

当前配置含义：

- `restoreLastPageOnRefresh`
  - 刷新后是否恢复上次打开的页。
  - 这属于 v2 的页面恢复入口，不接旧 `ChartCoreHost/useChartDataLoad`。

- `restoreRealtimeEnabledOnRefresh`
  - 刷新后是否恢复实时开关。
  - 只决定是否恢复实时窗口请求和尾部更新，不改变历史页分页。

- `restoreHorizontalViewportOnRefresh`
  - 刷新后是否恢复横向视窗。
  - 由 `klineChartViewportStateV2.ts` 读取本地缓存，恢复 `barSpace / offsetRightDistance / rightTimestamp / visibleTo`。

- `restoreYAxisRangeOnRefresh`
  - 刷新后是否恢复 Y 轴 range。
  - 当前默认关闭：`false`。
  - 原因：恢复 Y 轴 range 会调用内部 `setAutoCalcTickFlag(false)` 和 `setRange(...)`，会让 Y 轴进入手动范围状态，拖慢拖拽和缩放，也容易表现为“锁 Y 轴”。

- `anchorRealtimeBoundaryOnFrameLoad`
  - frame 首次加载后是否自动把视窗锚到历史/实时分界线附近。
  - 当前默认关闭：`false`。
  - 避免刷新后被强制拉回实时边界。

## 已定位的触发点

### 1. Y 轴 range 缓存恢复会锁 Y 轴

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartYAxisStateV2.ts`

触发代码：

```ts
yAxis.setAutoCalcTickFlag?.(false)
yAxis.setRange(snapshot.range)
```

这个模块本身可以保留，但默认不应在刷新时启用。只有未来明确需要“恢复手动 Y 轴范围”时，才打开 `restoreYAxisRangeOnRefresh`。

### 2. full frame 加载完成后必须明确回到自动 Y 轴

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartMainContainerSettingsV2.ts`
- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartHostV2.tsx`

当前新增能力：

```ts
resetKLineChartMainYAxisAutoScaleV2(chart)
```

作用：

- 在不恢复 Y 轴 range 时，显式调用内部 `setAutoCalcTickFlag(true)`。
- 再调用 `adjustPaneViewport(..., true)`，让 KLineCharts 重新按当前数据计算 Y 轴。

原因：

- 关闭 Y 轴 range 缓存后，如果不显式把 Y 轴切回自动模式，KLineCharts 可能继续沿用某次交互后的非自动状态。

### 3. `applyNewData` 完成回调必须走官方第三参数

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartRenderer.ts`

已移除的方式：

```ts
subscribeAction(ActionType.OnDataReady)
```

当前方式：

```ts
chart.applyNewData(frame.mainRows, false, afterDataReady)
```

原因：

- 后续的横向视窗恢复、自动 Y 轴恢复、实时窗格更新都依赖数据写入完成后的回调。
- 之前通过 `OnDataReady` 事件等待，存在版本或时序不触发的风险，一旦不触发，刷新后就会吃 KLineCharts 默认视窗状态。

### 4. 实时尾部更新不能重复跑全量显示控制

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartHostV2.tsx`

已处理方向：

- 实时尾部更新走 `applyKLineChartFrameTailUpdate`。
- 只调用 `chart.updateData(latest)`。
- 不再每个 tick 都 `scheduleApply()`，避免 `setStyles` 在实时跳动时反复执行。

效果：

- 拖拽和缩放明显变轻。
- 配置和样式控制只在 full frame 或设置变化时执行。

### 5. `applyNewData` 会先重置横向偏移

本地 KLineCharts 9.8.12 源码中，`applyNewData` 最终会进入内部数据加载流程，并调用：

```ts
resetOffsetRightDistance()
```

这意味着：

- 每次 full frame 写入时，KLineCharts 会先把横向视窗恢复到自己的初始偏移。
- v2 的横向视窗缓存必须在 `applyNewData` 完成后再恢复。
- 恢复期间不能立刻允许缓存保存，否则后续 `resize / visibleRangeChange` 可能把这个官方初始状态写回本地缓存。

当前处理：

- `klineChartViewportStateV2.ts` 增加恢复期控制。
- full frame 写入前调用 `markRestoring()`，暂停 viewport 保存并清掉待保存任务。
- 视窗恢复完成后调用 `markReadyAfterRestore()`，等待一帧和短延迟后再允许保存。

作用：

- 避免刷新后把默认初始视窗反写进缓存。
- 避免下一次刷新继续恢复到默认状态。

后续验证：

- 该改动能避免一部分 full frame 写入后的缓存反写风险，但用户继续观察到刷新后仍会回到初始视窗，并且 Y 轴仍像被锁定。
- 因此它不是最终根因，只能作为缓存写入保护保留。
- 后续不能再把“刷新回默认”简单归因于 viewport 保存时机，必须继续查 KLineCharts 实例初始化、`resize`、`setStyles`、Y 轴交互安装、以及本地缓存读取命中情况。

### 6. 横向恢复不能优先使用 `offsetRightDistance`

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartViewportStateV2.ts`

问题：

- viewport 缓存同时保存 `offsetRightDistance` 和 `rightTimestamp`。
- 旧恢复逻辑优先使用 `offsetRightDistance`。
- 当用户拖到历史区域时，`offsetRightDistance` 可能很大；如果再被容器宽度裁剪或按尾部距离恢复，就会回到接近默认/尾部的位置。
- 这会表现为刷新后没有恢复到上次停留的 K 线时间，而是恢复到某个初始状态。

当前处理：

- 恢复横向视窗时，优先使用 `rightTimestamp`：

```ts
chart.scrollToTimestamp(snapshot.rightTimestamp, 0)
```

- 只有没有 `rightTimestamp` 时，才退回使用 `offsetRightDistance`。
- `offsetRightDistance` 不再按容器宽度裁剪，避免保存时丢失真实偏移信息。

作用：

- 历史页视窗恢复以“右侧可见 K 线时间”为锚点。
- 避免把历史位置错误恢复成默认尾部距离。

### 7. 自动 Y 轴恢复要放在横向恢复之后

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/KLineChartHostV2.tsx`

原因：

- `setBarSpace / scrollToTimestamp / setOffsetRightDistance` 都可能触发 KLineCharts 内部 `adjustPaneViewport`。
- 如果自动 Y 轴恢复只发生在这些操作之前，后续横向恢复仍可能改变 Y 轴状态或显示范围。

当前处理：

- 在横向视窗恢复之后，再执行一次：

```ts
resetKLineChartMainYAxisAutoScaleV2(chart)
```

作用：

- 确保最终进入渲染稳定状态前，主图 Y 轴仍回到自动计算。

## 当前仍需继续排查的问题

用户当前仍观察到：

1. 刷新后视窗仍恢复到某个默认初始状态。
2. Y 轴仍像被锁定。

下一步排查方向：

- 确认 `restoreKLineChartViewportStateV2` 是否读到了正确的 symbol/period 缓存。
- 确认 `applyNewData(..., callback)` 的 callback 是否一定执行。
- 确认 `resetKLineChartMainYAxisAutoScaleV2` 执行后，是否又被后续 `resize / setStyles / adjustPaneViewport` 覆盖。
- 确认 `installKLineChartMainYAxisInteractionV2` 是否在非 Y 轴拖拽时误触发 `setAutoCalcTickFlag(false)`。
- 确认 KLineCharts 内部是否因 `resize` 在 callback 之后再次重算视窗。

## 设计原则

- v2 渲染系统只接收分层缓存模块输出的最终 frame。
- 不接旧 `ChartCoreHost/useChartDataLoad/chartViewportPersistence` 链路。
- 横向视窗恢复、Y 轴恢复、实时锚点恢复都必须从 `kLineChartConfigV2` 统一控制。
- Y 轴 range 缓存默认关闭，避免默认锁轴。
- 实时 tick 只更新尾部，不重跑 full frame 和样式配置。

## 2026-06-08：Y 轴恢复模块独立化

新增模块：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartYAxisRestoreV2.ts`

职责：

- 单独负责 v2 主图 Y 轴状态的读取、保存、自动恢复和手动 range 恢复。
- 本地缓存 key 使用 `fractalframe:klinechart-v2:yAxisRestore:{symbol}:{period}`，不复用旧 `klineChartYAxisStateV2` 的缓存 key。
- 缓存结构分成 `mode` 和 `range`：
  - `mode: "auto"`：表示刷新后应该回到 KLineCharts 自动 Y 轴。
  - `mode: "manual"`：表示用户手动拖拽过 Y 轴，只有配置允许时才恢复 range。

接入点：

- `KLineChartHostV2.tsx`
  - 不再安装旧 `installKLineChartYAxisStateV2`。
  - 改为安装 `installKLineChartYAxisRestorePersistenceV2`。
  - Y 轴拖拽后保存当前状态；双击 Y 轴回自动后保存 `auto` 状态。
- `klineChartRenderStateControllerV2.ts`
  - 不再调用旧 `restoreKLineChartYAxisStateV2`。
  - full frame 数据 ready 后，先恢复横向视窗，再处理 Y 轴。
  - `restoreYAxisRangeOnRefresh: false` 时调用 `resetKLineChartYAxisToAutoV2`，确保最终是自动 Y 轴。
  - `restoreYAxisRangeOnRefresh: true` 时调用 `restoreKLineChartYAxisAfterDataReadyV2`，只在缓存为 manual 且 range 能覆盖当前可见价格时恢复。

当前默认策略：

- `kLineChartConfigV2.viewport.restoreYAxisRangeOnRefresh` 已打开为 `true`。
- 刷新后会恢复用户手动拖过的 Y 轴范围。
- 双击 Y 轴回自动后，缓存会保存 `auto`，后续刷新会回到自动 Y 轴。
- manual 恢复时会显式调用 `setAutoCalcTickFlag(false)` 再 `setRange(...)`，避免只写 range 但没有进入手动 Y 轴状态。

## 2026-06-08：横向视窗右侧空白恢复

文件：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartViewportStateV2.ts`

问题：

- 刷新后如果优先使用 `rightTimestamp` 恢复，KLineCharts 会把视窗右边对齐到某根 K 线。
- 这样会丢失用户拖出来的右侧空白距离，表现为先顶到最右侧，再恢复成一个固定空白。

当前规则：

- 恢复顺序改为：
  1. `setBarSpace(snapshot.barSpace)`
  2. `setOffsetRightDistance(snapshot.offsetRightDistance)`
  3. 没有 offset 时才退回 `scrollToTimestamp(snapshot.rightTimestamp)`
  4. 再没有 timestamp 时退回 `visibleTo`
- `offsetRightDistance` 是恢复“右侧空白多少”的主字段。
- `rightTimestamp` 只作为没有 offset 缓存时的兜底字段。

测试：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartViewportStateV2.test.ts`
- 测试保证同时存在 `offsetRightDistance` 和 `rightTimestamp` 时，必须优先调用 `setOffsetRightDistance`，不允许先 `scrollToTimestamp`。

## 2026-06-08：配置模块加固和旧 Y 链路清理

配置入口：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartConfigV2.ts`

当前配置模块已经承载：

- 刷新后是否恢复上次页。
- 刷新后是否恢复实时开关。
- 是否首次锚定实时边界。
- 是否恢复横向视窗。
- 是否恢复 Y 轴手动范围。
- 主图左侧最大拖动边界。
- 主图右侧最大拖动边界。

本次整理：

- 为 `kLineChartConfigV2` 增加 `KLineChartConfigV2` 类型约束。
- 将 `maxOffsetLeftDistance` 和 `maxOffsetRightDistance` 从 `klineChartMainContainerSettingsV2.ts` 的局部常量迁入配置模块。
- `klineChartMainContainerSettingsV2.ts` 只负责把配置应用到 KLineCharts 实例，不再藏独立参数。
- 删除旧文件 `klineChartYAxisStateV2.ts`。
- 删除旧的 `resetKLineChartMainYAxisAutoScaleV2` 出口；Y 轴恢复/回自动统一走 `klineChartYAxisRestoreV2.ts`。

后续原则：

- 新增渲染恢复策略时，先加到 `kLineChartConfigV2`，再由对应执行模块读取。
- `KLineChartHostV2` 只安装模块和推 frame，不直接散写配置判断。
- Y 轴相关逻辑只进 `klineChartYAxisRestoreV2.ts`。
- 横向视窗相关逻辑只进 `klineChartViewportStateV2.ts`。
- 主图容器能力只进 `klineChartMainContainerSettingsV2.ts`，参数来自配置模块。

## 2026-06-08：Host 继续变薄与配置参数归位

新增模块：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartFrameLifecycleV2.ts`

职责：

- 计算 render window key。
- 判断当前 frame 是否允许走 tail update。
- 避免 `KLineChartHostV2` 直接写“同一窗口、同长度或尾部多一根”的策略判断。

配置继续归位：

- `kLineChartConfigV2.viewport.barSpaceMin`
- `kLineChartConfigV2.viewport.barSpaceMax`
- `kLineChartConfigV2.viewport.saveDelayMs`
- `kLineChartConfigV2.overlays.pageBoundaryLabels.labelMinVisibleWidth`
- `kLineChartConfigV2.overlays.pageBoundaryLabels.startLabelInset`
- `kLineChartConfigV2.overlays.pageBoundaryLabels.stopLabelGap`
- `kLineChartConfigV2.overlays.pageBoundaryLabels.realtimeLabelGap`

影响：

- `klineChartViewportStateV2.ts` 不再硬编码 barSpace 上下限和保存延迟。
- `KLineChartRealtimePaneV2.ts` 不再硬编码分页边界标签的最小宽度、左右间距和实时标签间距。
- `KLineChartHostV2.tsx` 只调用 `buildKLineChartRenderWindowKeyV2` 和 `canApplyKLineChartTailUpdateV2`，不直接维护 frame 生命周期策略。

测试：

- `frontend/src/workbench/chart/klineChartRendererV2/klineChartFrameLifecycleV2.test.ts`
- 覆盖 render window key 和 tail update 判定规则。
