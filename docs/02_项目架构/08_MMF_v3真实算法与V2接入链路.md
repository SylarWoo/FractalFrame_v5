# MMF_v3 真实算法与 V2 接入链路

本文记录 MMF_v3 的真实计算边界。MMF_v3 不是一个简单的前台 Stoch 交叉指标，它的完整算法在 Python 后端 `python/indicators/mmf_v3` 中完成；前端只负责准备 K 线、传入参数、接收 marker、把 marker 映射成每根 K 线的指标行，再交给 V2 渲染系统。

## 一、结论

1. MMF_v3 的真实计算入口是后端：
   - HTTP 服务：`scripts/http_bridge/mmf_v3_indicator_service.py`
   - 算法入口：`python/indicators/mmf_v3/engine.py`
   - 信号决策：`python/indicators/mmf_v3/signal_decision.py`

2. 前端旧链路的正确入口是：
   - `frontend/src/workbench/chart/tradingViewMmfV3Indicator.ts`
   - `calculateMmfV3RowsForDisplayPage`
   - `calculateMmfV3IndicatorMarkers`
   - `createMmfV3RowsFromMarkers`

3. V2 指标系统接入 MMF_v3 时，不能手写一套前台 MMF_v3 判断逻辑替代后端算法。
   - 前台可以复用 VDO、VMI、TSI、Stoch 等指标定义。
   - 但 MMF_v3 的最终信号仍然必须由后端 MMF_v3 引擎统一判断。
   - 否则会出现随机指数、TSI、VDO 阈值、支撑阻力、趋势回撤等信号全部不一致的问题。

## 二、前端旧链路做什么

前端旧 MMF_v3 链路主要在 `tradingViewMmfV3Indicator.ts`。

1. 归一化参数。
   - `normalizeMmfV3Context` 合并默认参数和用户参数。
   - MMF_v3 内部 MA 默认使用 `length: 120`、`source: hlc3`、`type: sma`。
   - MMF_v3 内部 Stoch 默认使用 `length: 28`、`kSmoothing: 6`、`dSmoothing: 6`。
   - 同时传入 VDO、VMI、TSI、VWAP、Morgan 参数。

2. 剥离未来占位 K 线。
   - `stripFuturePlaceholders` 会把未来占位行从真实计算输入里去掉。
   - 计算完成后再用 `mergeRealRowsWithPlaceholders` 把结果对回原始数据列表。

3. 决定计算范围。
   - 默认远程计算行数：`8000`。
   - M1/M5 使用 `6000` 行。
   - M15/M30 使用 `5000` 行。
   - 实时增量场景会尝试只重算尾部区间。
   - 可视窗口场景会使用 `visibleWarmupRows = 1000` 和 `visibleForwardRows = 240` 扩展计算范围。

4. 生成远程请求。
   - 前端把 K 线转换成后端需要的 `rows`：
     - `barKey`
     - `time`
     - `open`
     - `high`
     - `low`
     - `close`
     - `volume`
     - `sourceIndex`
   - 然后调用 `calculateMmfV3IndicatorMarkers`。

5. 接收后端 marker 并映射成前端指标行。
   - 后端返回 `markers`。
   - 前端用 `createMmfV3RowsFromMarkers(realRows, markers)` 转换成 `MmfV3IndicatorRow[]`。
   - 每个输出行通过 barKey、time、index 对齐到对应 K 线。

6. 前端缓存。
   - `remoteMmfV3RowsBySignature` 缓存远程计算结果。
   - `pageMmfV3RowsBySignature` 缓存整页结果。
   - `lastRemoteMmfV3ResultBySettings` 支持实时尾部增量复用。

## 三、HTTP 后台链路

前端调用：

```ts
calculateMmfV3IndicatorMarkers({
  rows,
  settings,
  symbol,
  timeframe,
  includeSignalFrame: false,
})
```

服务端先走异步任务：

1. `POST /api/indicators/v3/mmf/jobs/start`
2. 如果缓存命中，直接返回 `ready`。
3. 如果未命中，返回 `jobId`。
4. 前端轮询 `GET /api/indicators/v3/mmf/jobs/result?jobId=...`。
5. 如果异步任务失败，前端回退到同步接口 `POST /api/indicators/v3/mmf/calculate`。

服务端缓存分两层：

1. 结果缓存 `_mmf_v3_result_cache`
   - key 包含 symbol、timeframe、rows 签名、完整 settings 签名、debug 开关、signalFrame 开关。
   - 命中后不重新计算。

2. 特征缓存 `_mmf_v3_feature_cache`
   - key 包含 symbol、timeframe、rows 签名、feature settings hash。
   - 只缓存特征表，后续不同显示开关可以复用底层指标特征。

## 四、Python 后端真实算法

真实算法入口：

```py
calculate_mmf_v3_markers(rows, settings)
calculate_mmf_v3_markers_from_features(features, settings)
```

### 1. 构建特征表

`build_mmf_v3_feature_frame` 会把原始 OHLCV 扩展成完整特征表：

1. 原始 K 线字段：
   - `barKey`
   - `sourceIndex`
   - `time`
   - `open`
   - `high`
   - `low`
   - `close`
   - `volume`

2. Stoch 特征：
   - `stochK`
   - `stochD`
   - 随机指数交叉和状态判断的基础数据。

3. VDO 特征：
   - `vdo`
   - `vdoBaseMa`
   - `vdoBase2Ma`
   - 上下阈值穿越。
   - 超买、超卖状态机。
   - 多头、空头状态机。

4. VMI 特征：
   - `vmiHistogram`
   - VMI 零轴穿越窗口。
   - 支撑、阻力和背离分类依赖它。

5. TSI 特征：
   - `tsi`
   - `tsiSignal`
   - `tsiHistogram`
   - TSI 金叉、死叉和确认点。

6. MA 特征：
   - MMF_v3 内部 MA 默认 `120 SMA HLC3`。

7. VWAP 特征。

8. Morgan 特征：
   - Morgan anchor 默认按前端传参选择 `h4` 或 `d1`。
   - ratios 默认 `[-0.236, -0.118, 0.118, 0.236]`。

### 2. Stoch 状态机

`calculate_stoch_state_signals(features, settings)` 先生成基础高低点信号。

高点侧大致链路：

1. Stoch 发生死叉。
2. 在回看窗口内找到价格高点 anchor。
3. 后续 K 值向下推进达到 `highStochKAdvance`。
4. 推进必须发生在 `highConfirmLookaheadBars` 内。
5. 生成 high 类信号，包含：
   - anchor 点
   - cross 事件点
   - confirm 确认点
   - pointDistance

低点侧大致链路：

1. Stoch 发生金叉。
2. 在回看窗口内找到价格低点 anchor。
3. 后续 K 值向上推进达到 `lowStochKAdvance`。
4. 推进必须发生在 `lowConfirmLookaheadBars` 内。
5. 生成 low 类信号。

### 3. 支撑阻力分类

`classify_vmi_zero_levels(features, stoch_signals, settings)` 不使用前台可见 VMI 指标行，而是使用后端特征表里的 VMI histogram。

支撑：

1. VMI 从零轴上方向下穿越，开启 support window。
2. VMI 再从零轴下方向上穿越，关闭 support window。
3. 在这个窗口内找 Stoch low 信号。
4. 取窗口内价格最低的 low 信号。
5. 将该 low 分类成 `MMF_V3_SUPPORT`。

阻力：

1. VMI 从零轴下方向上穿越，开启 resistance window。
2. VMI 再从零轴上方向下穿越，关闭 resistance window。
3. 在这个窗口内找 Stoch high 信号。
4. 取窗口内价格最高的 high 信号。
5. 将该 high 分类成 `MMF_V3_RESISTANCE`。

### 4. VMI 背离分类

`apply_vmi_divergence_classifications` 会在已有 Stoch high/low 和支撑阻力分类基础上，继续判断顶背离、底背离等分类。

这部分不是简单的 Stoch 交叉，它依赖：

1. Stoch anchor。
2. VMI histogram。
3. 已有分类。
4. 价格结构。

### 5. 趋势回撤类信号

`create_trend_retrace_markers` 基于特征表、Stoch 信号、支撑阻力和背离分类生成趋势回撤类 marker。

相关输出包括：

1. `MMF_V3_TREND_DOWN_REBOUND`
2. `MMF_V3_TREND_UP_PULLBACK`
3. `MMF_V3_TREND_DOWN_RETURN`
4. `MMF_V3_TREND_UP_RETURN`
5. `MMF_V3_TREND_DOWN_DIVERGENCE`
6. `MMF_V3_TREND_UP_DIVERGENCE`

当前服务端配置里部分旧扩展开关被固定关闭，不能在前端绕过后端私自生成。

### 6. TSI 信号

`create_tsi_cross_markers(features, settings)` 负责：

1. `MMF_V3_TSI_DEAD_CROSS`
2. `MMF_V3_TSI_DEAD_CROSS_CONFIRM`
3. `MMF_V3_TSI_GOLDEN_CROSS`
4. `MMF_V3_TSI_GOLDEN_CROSS_CONFIRM`

确认点距离使用：

1. `tsiDeadCrossConfirmDistance`
2. `tsiGoldenCrossConfirmDistance`

### 7. VDO 阈值和市场状态

`apply_mmf_v3_vdo_threshold_states` 和 `create_vdo_break_markers` 负责 VDO 相关状态。

典型输出包括：

1. `MMF_V3_BULL_MARKET`
2. `MMF_V3_BEAR_MARKET`
3. `MMF_V3_OVERBOUGHT`
4. `MMF_V3_OVERBOUGHT_CLOSE`
5. `MMF_V3_OVERSOLD`
6. `MMF_V3_OVERSOLD_CLOSE`

这些信号不是单根 K 线上的简单阈值判断，而是带状态机的开关逻辑。

### 8. BPR 策略信号

`create_bpr_m5_strategy_markers` 可生成 BPR M5 策略信号：

1. `MMF_V3_BPR_LONG_ENTRY`
2. `MMF_V3_BPR_LONG_EXIT`
3. `MMF_V3_BPR_SHORT_ENTRY`
4. `MMF_V3_BPR_SHORT_EXIT`
5. `MMF_V3_BPR_LONG_STOP_LOSS`
6. `MMF_V3_BPR_SHORT_STOP_LOSS`

## 五、marker 到前端行的映射

后端返回的是 marker 列表，不是每根 K 线的前端渲染行。前端通过 `createMmfV3RowsFromMarkers` 转换。

关键规则：

1. marker 通过 `markerBarKey`、`time`、`index` 找到所属 K 线。
2. `MMF_V3_HIGH` 会映射：
   - anchor 行：`highMarker`
   - event 行：`deadCrossMarker`
   - entry/confirm 行：`highConfirmPointMarker`

3. `MMF_V3_LOW` 会映射：
   - anchor 行：`lowMarker`
   - event 行：`goldenCrossMarker`
   - entry/confirm 行：`lowConfirmPointMarker`

4. 支撑阻力、背离、趋势、VDO、TSI 类 marker 映射到各自字段。

5. 映射后执行优先级替换：
   - 例如 `MMF_V3_RESISTANCE` 可以替换普通 `highMarker`。
   - `MMF_V3_SUPPORT` 可以替换普通 `lowMarker`。
   - 背离、趋势回撤、突破类信号也会按 catalog 中的 `replaces` 规则覆盖低优先级标记。

## 六、V2 新系统应如何接入

MMF_v3 接入 V2 时，正确链路应该是：

1. 指标总控台收到 `MMF_V3` 请求。
2. 预热器按 MMF_v3 的固定 warmup 需求向上请求 K 线。
3. 历史窗口提供：
   - `calculationRows = warmupRows + displayRows`
   - `displayRows = 当前页 K 线`

4. MMF_v3 V2 definition 调用后台计算模块。
5. 后台计算模块调用 `calculateMmfV3RowsForDisplayPage`。
6. 后台返回当前页对应的 `MmfV3IndicatorRow[]`。
7. 结果进入 V2 指标缓存和历史窗口合并器。
8. 渲染系统 V2 只读取 frame，不重新计算 MMF_v3。

## 七、复合指标依赖编排模块和 MMF_v3 的边界

复合指标依赖编排模块可以服务于 MMF_v3，但不能替代 MMF_v3 后端算法。

正确边界是：

1. 总控台可以识别 MMF_v3 依赖哪些参数：
   - Stoch 参数。
   - VDO 参数。
   - VMI 参数。
   - TSI 参数。
   - MA 参数。
   - VWAP 参数。
   - Morgan 参数。

2. 如果未来要做前台特征缓存，可以由总控台统一调度隐藏依赖。

3. 但在真实 MMF_v3 迁移完成前，MMF_v3 的最终输出必须来自后端：
   - 后端负责生成 feature frame。
   - 后端负责状态机。
   - 后端负责支撑阻力、背离、趋势、VDO、TSI、BPR 信号。
   - 前端不能用隐藏依赖行临时拼一个 `MMF_V3` 输出。

4. 如果未来要把 MMF_v3 完全改成前台计算，必须逐项迁移 Python 算法，而不是只迁移 Stoch 交叉：
   - feature frame 构建。
   - Stoch 状态机。
   - VMI 零轴窗口。
   - VMI 背离分类。
   - VDO 阈值状态机。
   - TSI 交叉确认。
   - 趋势回撤。
   - marker factory。
   - signal catalog 和 priority replace。

## 八、禁止事项

1. 禁止把 MMF_v3 改成只依赖前台 Stoch 行的同步指标。
2. 禁止在 V2 definition 里手写一套简化版 MMF_v3 代替 Python 后端。
3. 禁止把“隐藏挂载依赖指标”当成“已经得到 MMF_v3 结果”。
4. 禁止让渲染层触发 MMF_v3 计算。
5. 禁止只按 timestamp 对齐，忽略 `barKey` 和 `sourceIndex`。

## 九、当前修复方向

当前应先恢复 MMF_v3 旧后台计算链路，让 V2 能加载真实 MMF_v3：

1. 恢复 `mmfV3BackgroundIndicatorV2`。
2. 恢复 `mmfV3IndicatorV2` 使用后台计算。
3. 恢复后台 ready event，让后台算完后推动当前页重新合并和渲染。
4. 保留复合指标依赖编排模块，但不要用它生成最终 MMF_v3 输出。
5. 等真实链路稳定后，再考虑是否把 Python MMF_v3 逐模块迁移成前台计算。

