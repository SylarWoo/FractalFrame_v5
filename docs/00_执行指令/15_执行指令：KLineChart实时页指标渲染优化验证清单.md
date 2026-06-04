# 执行指令：KLineChart 实时页指标渲染优化验证清单

> 本清单只用于规划和分刀验证。当前阶段先不改代码，后续每次只选一个方向单独修改、单独测试；方向不对就直接回退该刀。

## 一、目标

解决实时页在缩小到很小 `barSpace` 时，MR、MMF、VWAP 等主图指标再次渲染出现延迟的问题。

当前约束：

1. 实时页数据边界仍由分页器决定。
2. 实时页起点固定，初始显示约 2000 根 K 线。
3. 实时页终点活动增长，最高约 2500 根后触发整理。
4. 指标必须绑定当前实时页 K 线身份，不允许混入其他页面数据。
5. 优化重点是 KLineChart 渲染机制，不改分页器，不改 StoreV6 数据边界。
6. 每一刀都要可回退，不能做临时条件补丁。

## 二、KLineChart 官方机制要点

### 1. 可见区决定 draw 压力

KLineChart 实例提供 `getVisibleRange()`，返回当前屏幕可见范围：

```text
from
to
realFrom
realTo
```

缩小图表时，同屏可见 K 线数量变多。即使实时页总数据只有 2000 到 2500 根，指标 `draw` 的压力也会随着 `visibleRange.to - visibleRange.from` 增大。

官方 API：

```text
https://klinecharts.com/en-US/api/instance/getVisibleRange
```

### 2. 自定义指标 draw 运行在 KLineChart 生命周期内

KLineChart 自定义指标的 `draw` 会拿到：

```text
ctx
visibleRange
barSpace
xAxis
yAxis
indicator.result
```

官方示例也是按照 `visibleRange.from` 到 `visibleRange.to` 循环绘制。

官方示例：

```text
https://v9.klinecharts.com/en-US/sample/indicator
```

### 3. `barSpace` 越小，同屏绘制对象越多

KLineChart 通过 `getBarSpace()` / `setBarSpace()` 管理单根 K 线宽度。

当 `barSpace` 很小时，同一屏会塞进更多 K 线，指标线段、柱子、符号、文字的绘制次数都会增加。

官方实例 API：

```text
https://v9.klinecharts.com/en-US/guide/instance-api
```

### 4. `applyNewData` 和 `updateData` 性质不同

`applyNewData` 是重新灌入整组数据，适合初始化、切页、刷新。

`updateData` 是更新最后一根或追加一根，适合实时 tick / 实时 K 线推进。

实时页正常跳动应尽量走 `updateData`，避免把实时更新变成整页重灌。

### 5. `resize()` 会触发图表模块重新计算

官方说明 `resize()` 会让图表重新计算模块尺寸和布局。它不应该在普通缩放、实时 tick、指标轻量更新中被频繁触发。

## 三、当前本地实现观察

### 1. Page Indicator Runtime 方向是对的

当前已经开始把指标计算从 KLineChart 生命周期里拆出来：

```text
frontend/src/workbench/chart/pageIndicatorRuntime.ts
frontend/src/workbench/chart/indicatorPageSnapshotStore.ts
```

目标是页面准备好后先计算当前页指标，KLineChart 的 `calc` 尽量只读当前页缓存。

### 2. MR 指标注册本体很轻

当前 MR 的 KLineChart 指标本体：

```text
frontend/src/workbench/chart/tradingViewMrIndicator.ts
```

里面的 `calc` 只是返回空行：

```text
dataList.map(() => ({}))
```

所以 MR 延迟大概率不在这个空指标本体，而在 MR 段线、标签、overlay 或主图绘制链路。

### 3. MMF_V3 已经按 visibleRange 绘制

当前 MMF_V3 的绘制函数：

```text
frontend/src/workbench/chart/tradingViewMmfV3Indicator.ts
```

`drawMmfV3Markers` 已经使用 `visibleRange.from/to` 限制绘制范围。这是正确方向。

后续重点不是让它扫全页，而是看可见区太大时，是否需要像素级降采样或分级显示。

## 四、七个可选优化方向

### 方向 1：统一确认所有指标 draw 只画 visibleRange

目标：

确认所有主图、副图指标的 `draw` 都只循环当前可见范围，不允许在缩放、拖动时扫完整 2000/2500 根。

重点检查：

```text
tradingViewMmfV3Indicator.ts
tradingViewVwapIndicator.ts
tradingViewMaShiftIndicator.ts
tradingViewVdoIndicator.ts
tradingViewVmiIndicator.ts
tradingViewTsiIndicator.ts
tradingViewDpoIndicator.ts
tradingViewSqzmomIndicator.ts
mainVolumeIndicator.ts
MR overlay / segment / label 相关文件
```

验证标准：

1. 缩小到最小可接受 `barSpace` 后，不出现完整数据循环。
2. draw 循环范围最多是 `visibleRange` 前后少量 buffer。
3. 不改变指标计算结果。

风险：

如果某些指标用完整区间计算 Y 轴范围或状态，需要先拆成计算缓存，不能直接删循环。

### 方向 2：缩小时做像素级降采样

目标：

当 `barSpace` 很小、同一像素列对应多根 K 线时，减少重复绘制。

适用对象：

```text
MR 标签
MMF 标记
VWAP 辅助线以外的标记
主图复杂文字
密集符号
```

建议规则：

1. 同一 x 像素列只画最高优先级对象。
2. 同类型连续对象可合并。
3. `barSpace` 小于阈值时不画文字，只画必要点/线。
4. 数据不丢，只减少屏幕绘制对象。

验证标准：

1. 缩小后拖动明显更跟手。
2. 放大后完整显示恢复。
3. 指标数值和 K 线身份不变。

风险：

视觉信息会分级显示，需要先选 MR 或 MMF 的一个小分支试，不要一次覆盖所有指标。

### 方向 3：主图复杂指标使用 KLineChart 生命周期，但绘制由自己控制

目标：

保留 KLineChart 的坐标、缩放、拖动生命周期，避免外部 canvas 跟随延迟；但具体绘制逻辑由项目自己控制，不依赖默认 figures 的重逻辑。

适用对象：

```text
VWAP
MMF_V3
MR
主图成交量
```

原则：

1. `draw` 只读 `indicator.result` 和可见区。
2. 不在 `draw` 中重新计算指标。
3. 不在 `draw` 中触发状态写入。
4. 不在 `draw` 中调用 `overrideIndicator` / `applyNewData`。

验证标准：

1. 纵向缩放坐标跟随不延迟。
2. 横向缩放/拖动不触发重新计算。
3. 与 KLineChart 主图坐标一致。

风险：

如果 draw 中包含大量文字、save/restore、measureText，仍然会卡，需要配合方向 2。

### 方向 4：calc 与 draw 彻底分层

目标：

页面指标计算由 Page Indicator Runtime 管理；KLineChart 的 `calc` 尽量只读当前页快照。

规则：

1. 页面加载、参数变化、周期切换、品种切换时允许计算。
2. 实时 K 线推进时只更新尾部缓存。
3. zoom、drag、crosshair、Y 轴拖动只触发渲染。
4. KLineChart `calc` 不再承担重计算。

验证标准：

1. 缩放和拖动时没有指标重算日志。
2. 新 K 线进来后，不复位副图窗口。
3. 当前页指标结果与 K 线 `barKey` 对齐。

风险：

这刀涉及架构边界，必须按指标逐个接入，不能一次迁移所有指标。

### 方向 5：MR 链路单独排查

目标：

MR 延迟不要只查 `tradingViewMrIndicator.ts`，要查真正画 MR 段线、标签、区间的链路。

原因：

MR 的 KLineChart 指标注册本体目前只是空行占位。实际显示可能来自：

```text
Morgan Range overlays
MR segment drawing
MR labels
pane title / price label
主图 overlay
```

验证标准：

1. 找到 MR 实际绘制对象数量。
2. 记录缩小时 MR 每帧绘制耗时。
3. 确认 MR 是否在缩放时重复生成段数据。

风险：

不能用“删除旧数据”或“限制分页边界”的方式处理 MR 延迟。分页器不是这刀目标。

### 方向 6：限制最小 barSpace 或分级显示

目标：

避免实时页缩小到极端状态后，一屏绘制 2000 根以上复杂指标对象。

两个可选方案：

```text
方案 A：设置合理最小 barSpace
方案 B：保留缩小能力，但指标进入轻量显示模式
```

轻量显示模式示例：

```text
大 barSpace：完整标签、完整符号、完整线
中 barSpace：只画关键点和主要线
小 barSpace：只画线段/区域，不画文字和密集符号
```

验证标准：

1. 极小缩放时仍可流畅拖动。
2. 放大后信息完整恢复。
3. 不改变实时页数据窗口。

风险：

限制最小 `barSpace` 会影响用户查看全页概览，需要先确认体验是否接受。

### 方向 7：避免误触发 resize / applyNewData / overrideIndicator

目标：

确保普通缩放、拖动、实时 tick 不触发重灌数据、重建指标或重新布局。

重点排查：

```text
chart.applyNewData(...)
chart.updateData(...)
chart.overrideIndicator(...)
chart.createIndicator(...)
chart.resize()
setStyles(...)
adjustPaneViewport(...)
```

规则：

1. 初始化、刷新、切页可以 `applyNewData`。
2. 实时 tick / 实时 K 线推进应走 `updateData`。
3. 参数变化才允许 `overrideIndicator`。
4. 缩放、拖动、十字光标移动不允许触发重建指标。

验证标准：

1. 缩放时无 `applyNewData`。
2. 拖动时无 `createIndicator` / `overrideIndicator`。
3. 实时 tick 时不触发整页重灌。

风险：

如果当前某些 UI 状态变更绑定过宽，可能会误触发 React effect，需要逐个 effect 排查。

## 五、建议执行顺序

### 第一刀：只加性能观测，不改行为

目的：

记录每次指标绘制的关键数据：

```text
indicatorName
visibleCount
barSpace
drawCostMs
drawObjectCount
triggerReason
```

优先观测：

```text
MR
MMF_V3
VWAP
mainVolume
```

验收：

缩小、放大、拖动、新 K 线进来时，能看出到底是哪条绘制链路最重。

### 第二刀：先处理最重的一个指标

如果第一刀发现 MR 最重，就只处理 MR。

如果 MMF_V3 最重，就只处理 MMF_V3。

如果 VWAP 最重，就只处理 VWAP。

不允许一刀同时改多个指标。

### 第三刀：验证是否需要像素级降采样

只在最重指标上试。

通过后再写入统一绘制规则。

### 第四刀：再检查误触发重建链路

确认缩放、拖动时有没有误触发：

```text
applyNewData
overrideIndicator
createIndicator
resize
```

## 六、回退规则

每一刀必须满足：

1. 只改一个方向。
2. 修改前能说明要验证的假设。
3. 修改后必须能对比缩小前后的流畅度。
4. 如果方向不对，直接回退该刀，不继续在错误方向上叠补丁。
5. 不新增“看起来能修一下”的临时条件判断。

## 七、验收命令

前端基础验证：

```powershell
cd G:\PythonProject\FractalFrame_v5\frontend
npm run test:logic
npm run build
```

人工验证：

```text
1. 实时页加载 2000 根左右 K 线。
2. 加载 MR、MMF_V3、VWAP、成交量。
3. 缩小到最小观察拖动延迟。
4. 放大观察指标是否恢复完整显示。
5. 等待实时 K 线更新，确认不复位副图、不重灌整页。
6. 切换指标参数，确认只重算当前页。
```

## 八、当前暂不执行的事项

1. 不做副图 Y 轴状态持久化。
2. 不改分页器。
3. 不改 StoreV6 落盘规则。
4. 不做指标 warmup 回补。
5. 不统一迁移所有指标。
6. 不做全局锁轴策略。
7. 不做定时轮询补偿。

