# MMF_V2 信号系统架构说明

## 定位

MMF_V2 是一套后端驱动的信号系统，不是单纯的前端指标。

前端只负责三件事：
- 提供统一参数入口：开关、阈值、符号、颜色、字号、可见范围。
- 请求后端计算结果，并把 marker/signal 画到图表上。
- 展示 VDO、VMI、TSI 等副图，作为观察工具。

后端负责：
- 读取 K 线。
- 统一计算 MA、MR、Stoch、VDO、VMI、TSI。
- 生成 MMF_V2 信号。
- 输出 marker、signal、momentum、debug 数据。

## 六层底座

```text
1. 行情数据层
   Store V5 / DuckDB / Parquet
     -> K线 rows

2. 统一特征层
   FeatureFrame
     -> MA / MR / Stoch / VDO / VMI / TSI

3. 信号决策层
   SignalDecision
     -> high / low / support / resistance / divergence / market / overbought / oversold

4. 增量与缓存层
   rowsSignature + featureSettingsHash + signalSettingsSignature
     -> 复用 K线、FeatureFrame、SignalResult

5. 异步计算层
   job start / job result
     -> 计算不阻塞前端交互

6. 前端渲染层
   markers / momentumSamples
     -> 主图符号、副图观察、策略抽屉
```

## 1. 行情数据层

核心文件：
- `scripts/http_bridge/store_v5_operations_service.py`
- `python/data_warehouse/query/duckdb_ohlcv_query_v5.py`

职责：
- Store V5、DuckDB、Parquet 只负责取 K 线。
- 查询结果按 `symbol + timeframe + mode + baseTimeframe + anchor + timeFrom + timeTo + limit` 做内存缓存。
- 同一个图表窗口重复加载相同 K 线时，优先返回缓存。

输出：
- `rows`
- `rowsCount`
- `metadata.cacheHit`

约束：
- 行情层不计算指标。
- 行情层不生成 MMF_V2 信号。

## 2. 统一特征层

核心文件：
- `python/indicators/mmf_v2/feature_frame.py`
- `python/indicators/stoch.py`
- `python/indicators/vdo.py`
- `python/indicators/vmi.py`
- `python/indicators/tsi.py`
- `python/indicators/ma.py`
- `python/indicators/mmf_v2/features.py`

入口：
```python
build_mmf_v2_feature_frame(frame, settings)
```

统一输出一张 FeatureFrame，每根 K 线一行：
- `time / open / high / low / close / volume`
- `ma / maLength / maType / maSource`
- `stochK / stochD`
- `vdo / vdoBaseMa / vdoBase2Ma / vdoDelta / vdoDirection`
- `vdoEnterOverbought / vdoExitOverbought / vdoOverboughtActive / vdoOverboughtEpoch`
- `vdoEnterOversold / vdoExitOversold / vdoOversoldActive / vdoOversoldEpoch`
- `vmiHistogram / vmiFastMa / vmiSlowMa / vmiDelta / vmiDirection`
- `tsi / tsiSignal / tsiHistogram`
- `morgan_center / morgan_true_range / morgan levels`

关键规则：
- VDO 是独立后端模块。
- VMI 直接使用统一 FeatureFrame 中已经计算好的 VDO，不再重复计算 VDO。
- 超买/超卖状态统一使用外层阈值：
  - 超买阈值：`max(Upper Band, Upper Band 2)`
  - 超卖阈值：`min(Lower Band, Lower Band 2)`
- MMF_V2 所有信号必须读 FeatureFrame，不允许前端另算一套。

## 3. 信号决策层

核心文件：
- `python/indicators/mmf_v2/signal_decision.py`
- `python/indicators/mmf_v2/stoch_state_machine.py`
- `python/indicators/mmf_v2/support_resistance.py`
- `python/indicators/mmf_v2/vmi_divergence.py`
- `python/indicators/mmf_v2/vdo_breaks.py`
- `python/indicators/mmf_v2/signal_catalog.py`

入口：
```python
calculate_mmf_v2_signal_decisions(features, settings)
```

输出：
- `markers`
- `stoch_signals`
- `classifications`
- `decision_frame`

当前主要信号：
- 随机指数高/低点：`MMF_V2_HIGH` / `MMF_V2_LOW`
- 支撑/阻力位：`MMF_V2_SUPPORT` / `MMF_V2_RESISTANCE`
- 顶/底背离：`MMF_V2_TOP_DIVERGENCE` / `MMF_V2_BOTTOM_DIVERGENCE`
- 多/空头市场：`MMF_V2_BULL_MARKET` / `MMF_V2_BEAR_MARKET`
- 超买/超卖开启关闭：`MMF_V2_OVERBOUGHT` / `MMF_V2_OVERBOUGHT_CLOSE` / `MMF_V2_OVERSOLD` / `MMF_V2_OVERSOLD_CLOSE`
- 支撑/阻力突破、真实关闭点等其它结构信号。

顶底背离规则：
- 顶背离只在 `超买开启 -> 超买关闭` 区间内计算。
- 底背离只在 `超卖开启 -> 超卖关闭` 区间内计算。
- 区间内第一个阻力/支撑位只作为基准点，不标背离。
- 后续候选点可以是随机指数高/低点，也可以是支撑/阻力位。
- 顶背离：候选价格更高，候选 VMI 更低。
- 底背离：候选价格更低，候选 VMI 更高。
- 成立后替换当前点原来的高/低点或支撑/阻力位符号，不额外叠加。

## 4. 增量与缓存层

核心文件：
- `scripts/http_bridge/mmf_v2_indicator_service.py`

当前缓存分三层：

### K 线缓存

位置：
- `scripts/http_bridge/store_v5_operations_service.py`

缓存键：
```text
symbol + timeframe + mode + baseTimeframe + anchor + timeFrom + timeTo + limit
```

### FeatureFrame 缓存

缓存键：
```text
symbol + timeframe + rowsSignature + featureSettingsHash
```

用途：
- 相同 K 线、相同 MA/MR/Stoch/VDO/VMI/TSI 参数时，直接复用 FeatureFrame。
- MMF_V2、VDO、VMI、后续策略统计都应逐步读同一套 FeatureFrame。

### Result 缓存

缓存键：
```text
symbol + timeframe + rowsSignature + fullSignalSettingsSignature + includeDebug + includeSignalFrame
```

用途：
- 相同信号开关、阈值、参数时，直接返回 marker/signal 结果。

## 5. 异步计算层

核心接口：
- `POST /api/indicators/v2/mmf/jobs/start`
- `GET /api/indicators/v2/mmf/jobs/result?jobId=...`

兼容接口：
- `POST /api/indicators/v2/mmf/calculate`

工作方式：
- 前端优先调用 job start。
- 如果后端已有缓存，直接返回 `status=ready` 和 result。
- 如果没有缓存，后端创建 job，后台线程计算。
- 前端轮询 job result。
- job ready 后返回完整 MMF_V2 payload。
- 如果异步接口失败，前端回退旧同步 calculate 接口。

这样做的目的：
- 避免指标计算卡住 HTTP 请求。
- 避免刷新、切周期、参数变化时 UI 长时间无响应。
- 为后续 worker 池、队列、增量计算留接口。

## 6. 前端渲染层

核心文件：
- `frontend/src/services/mt5/mmfV2IndicatorApi.ts`
- `frontend/src/workbench/chart/tradingViewMmfV2Indicator.ts`
- `frontend/src/workbench/chart/mmfV2MarkerMapping.ts`
- `frontend/src/workbench/chart/mmfV2MarkerSpecs.ts`
- `frontend/src/workbench/chart/mmfV2SignalCatalog.ts`

职责：
- 只画后端返回的 marker。
- 不在前端重新定义 MMF_V2 信号语义。
- 主图符号按当前 K 线 index 绘制，不左右偏移。
- 同一根 K 线多个符号时，只做上下堆叠错开。
- 正常看盘不请求完整 debug/decisionFrame。

前端请求：
- 默认走异步 job。
- 缓存命中会直接拿结果。
- job 失败时自动回退同步接口。
- 正常远程计算只提交尾部计算窗口，当前上限为 `8000` 根 K 线；返回结果会用空行补齐前面的历史区间，保证 marker 的 `sourceIndex` 仍然对齐原始 K 线。
- 同一套参数只追加新 K 线时，前端先复用上一轮前段 marker，只把尾部 overlap 窗口重新提交后端计算；当前 overlap 上限为 `1600` 根 K 线。
- 指标参数输入会做 `220ms` debounce；连续输入时只让最后一次设置刷新进入图表计算。

## 当前状态

已经完成：
- Store V5 查询缓存。
- MMF_V2 FeatureFrame 缓存。
- MMF_V2 Result 缓存。
- MMF_V2 异步 job 接口。
- 前端 MMF_V2 异步请求与同步回退。
- 前端 MMF_V2 远程请求尾部窗口裁剪，减少大周期/长历史下的 payload 与后端计算量。
- 前端 MMF_V2 追加 K 线时的尾部 overlap 增量计算。
- 指标设置刷新 debounce，避免每敲一次数字就触发一次完整重算。
- VMI 复用统一 VDO，不再重复计算。
- 正常看盘不生成 `decisionFrame`，只有 debug 才生成。
- 超买/超卖状态与 marker 使用同一外层阈值口径。

还需要继续升级：
- 把当前前端侧尾部 overlap 增量，继续下沉到后端 FeatureFrame/SignalResult 层，形成真正的服务端增量复用。
- 把单独 VDO/VMI 副图也逐步迁移为读取统一 FeatureFrame。
- job 后台从普通线程升级为稳定 worker 池。
- 增加可观测统计：每次计算的 rowsCount、featureCacheHit、resultCacheHit、耗时。
- 对不同指标设置不同 debounce 策略：样式即时刷新，算法参数延迟刷新。

## 设计原则

以后新增 MMF_V2 信号，必须遵守：
- 指标值来自 FeatureFrame。
- 信号判断进入 SignalDecision。
- 输出进入 signal catalog。
- 前端只负责显示，不负责补算法。
- debug 只在排查时开启。
- 缓存键必须包含影响结果的参数。
