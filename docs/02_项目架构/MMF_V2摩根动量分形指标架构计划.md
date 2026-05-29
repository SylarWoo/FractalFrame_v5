# MMF_V2 摩根动量分形指标架构计划

本文定义 `MMF_V2 - 摩根动量分形指标` 的目标架构。V2 的核心目标是把指标计算从前端补画逻辑中拆出来，做成可测试、可复现、可扩展的 Python 独立指标引擎。

## 1. 核心结论

V2 不依赖前端当前已加载指标的输出。

`Stoch`、`VDO`、`MA`、`摩根区间` 作为 MMF_V2 的基础特征，在 Python 指标引擎内部重新计算。前端现有 Stoch/VDO/MA/MR 指标只作为视觉参考，不作为 V2 的计算输入。

这样做的原因：

1. 用户没有加载 Stoch/VDO/MA/MR 时，MMF_V2 仍然应该可以独立计算。
2. 前端指标输出有显示缓存、未来占位 K 线、可见周期过滤、图表加载顺序等问题，不适合作为策略级计算真源头。
3. Python 独立计算后，可以写单元测试和样例回放，结果更容易复现。
4. 后续做回测、扫描、批量计算时，可以直接复用 Python 引擎，不需要启动前端。

## 2. V2 边界

### Python 负责

1. 标准化 OHLCV 输入。
2. 计算 Stoch/VDO/MA/摩根区间基础特征。
3. 识别金叉、死叉、真实交叉、粘合过滤。
4. 执行状态机。
5. 处理 7 根 K 线推进、7 根 K 线反向交叉取消。
6. 在交叉点前后 N 根 K 线内寻找最高价/最低价锚点。
7. 执行 VDO、MA、摩根区间过滤。
8. 输出 markers。
9. 输出可选 debug rows，方便对照前端图表。

### 前端负责

1. MMF_V2 设置面板。
2. 调用 Python V2 API。
3. 接收 markers。
4. 根据样式设置画符号、颜色、字号。
5. 展示 debug 信息或原因说明。

前端不再补写 MMF_V2 状态机。

## 3. 总链路

```txt
StoreV5 / 图表 OHLCV
  ↓
Python MMF_V2 Engine
  ↓
Feature Layer
  ├─ Stoch Feature
  ├─ VDO Feature
  ├─ MA Feature
  └─ Morgan Range Feature
  ↓
Cross Detector
  ↓
Signal State Machines
  ↓
Price Anchor Resolver
  ↓
Filters / Dedupe
  ↓
MMF_V2 Markers
  ↓
Frontend Marker Renderer
```

## 4. 推荐项目结构

```txt
python/indicators/mmf_v2/
  __init__.py
  models.py
  features.py
  crosses.py
  price_anchor.py
  filters.py
  state_machine.py
  engine.py
  debug.py
  tests/
    test_features.py
    test_crosses.py
    test_state_machine.py
    test_engine.py
```

### models.py

定义 V2 的输入、配置、特征行和 marker 类型。

建议核心类型：

```txt
MmfV2Settings
MmfV2FeatureRow
MmfV2Marker
MmfV2SignalType
MmfV2CalculationResult
```

Marker 必须保留三个关键位置：

```txt
eventIndex      交叉发生的位置
confirmIndex    快线推进满足条件的位置
markerIndex     最终价格锚点位置
```

不要只输出 `index`，否则后面很难判断信号到底是按交叉点还是按标记点计算出来的。

### features.py

负责从 OHLCV 重新计算基础特征。

```txt
calculate_stoch_feature()
calculate_vdo_feature()
calculate_ma_feature()
calculate_morgan_feature()
build_mmf_v2_features()
```

V2 暂定只使用这四类特征：

1. `Stoch`：触发信号。
2. `VDO`：动量和支撑/阻力过滤。
3. `MA`：趋势背景过滤。
4. `摩根区间`：价格结构过滤。

### crosses.py

负责所有交叉判断。

需要统一处理：

1. 金叉。
2. 死叉。
3. 交叉值插值。
4. 真实交叉过滤：交叉前快慢线距离必须大于等于 1 点。
5. 粘合状态过滤：交叉前距离小于 1 点不算真实交叉。
6. 7 点推进确认。
7. 7 根 K 线内反向交叉取消。

核心规则：

```txt
死叉：
  前一根 K 必须高于 D 至少 1 点
  当前 K 向下穿越 D
  后续快线向下推进至少 7 点才确认
  7 根 K 线内再次金叉则取消

金叉：
  前一根 K 必须低于 D 至少 1 点
  当前 K 向上穿越 D
  后续快线向上推进至少 7 点才确认
  7 根 K 线内再次死叉则取消
```

### state_machine.py

每一类信号都应该走统一生命周期。

```txt
idle
  ↓
candidate_cross
  ↓
pending_confirm
  ↓
confirmed
  ↓
anchored
  ↓
filtered
  ↓
emitted
```

取消路径：

```txt
pending_confirm
  ↓
opposite_cross_within_7_bars
  ↓
cancelled
```

状态机只看 `eventIndex` 之后的推进和取消，不以最终 `markerIndex` 作为右侧确认中心。

### price_anchor.py

负责价格锚点。

规则：

```txt
以 eventIndex 为中心
向左 N 根 K 线
向右 N 根 K 线
在窗口内找最高价或最低价
```

输出：

```txt
markerIndex
markerTime
markerPrice
windowStartIndex
windowEndIndex
```

### filters.py

负责 VDO、MA、摩根区间过滤。

建议不要把过滤条件写死在状态机内部，而是独立成组合式过滤器。

示例：

```txt
match_vdo_resistance()
match_vdo_support()
match_ma_trend_up()
match_ma_trend_down()
match_morgan_level_near()
match_morgan_zone()
```

这样后续新增信号时，可以复用过滤器。

### engine.py

唯一对外入口。

```txt
calculate_mmf_v2_markers(rows, settings, include_debug=False)
```

职责：

1. 标准化输入。
2. 构建 features。
3. 调用状态机。
4. 去重。
5. 排序。
6. 返回统一结果。

## 5. HTTP API 设计

建议新增独立接口：

```txt
POST /api/indicators/v2/mmf/calculate
```

请求：

```json
{
  "symbol": "XAUUSDm",
  "period": "M5",
  "rows": [],
  "settings": {
    "stoch": {
      "length": 14,
      "kSmoothing": 3,
      "dSmoothing": 3
    },
    "vdo": {
      "length": 14,
      "emaSmoothing": 0
    },
    "ma": {
      "length": 20,
      "type": "sma",
      "source": "close"
    },
    "morgan": {
      "anchor": "h4",
      "ratios": [-0.236, -0.118, 0.118, 0.236]
    },
    "signals": {}
  },
  "includeDebug": false
}
```

返回：

```json
{
  "ok": true,
  "version": "MMF_V2",
  "rowsCount": 5000,
  "markersCount": 0,
  "markers": [],
  "debug": null
}
```

Marker 示例：

```json
{
  "type": "MMF_V2_LOW_POSITION_HIGH",
  "eventIndex": 120,
  "confirmIndex": 124,
  "markerIndex": 116,
  "time": 1710000000,
  "price": 2388.12,
  "windowStartIndex": 113,
  "windowEndIndex": 127,
  "reason": [
    "stoch_dead_cross",
    "cross_separation_ok",
    "stoch_advance_7",
    "vdo_resistance",
    "morgan_zone"
  ]
}
```

## 6. 前端接线计划

V2 前端应新增独立文件，不复用 v1 的大文件。

建议结构：

```txt
frontend/src/services/mt5/mmfV2IndicatorApi.ts

frontend/src/workbench/chart/tradingViewMmfV2Indicator.ts

frontend/src/workbench/rightDrawer/indicators/panels/
  MmfV2SettingsPanels.tsx
  MmfV2SettingsControls.tsx
```

### 前端指标注册

内部注册名使用：

```txt
MMF_V2
```

展示名使用：

```txt
MMF v2 - 摩根动量分形指标
```

### 前端职责限制

前端只做：

1. 请求 Python API。
2. 处理返回 markers。
3. 根据样式画图。
4. 缓存请求结果。

前端不做：

1. Stoch/VDO/MA/MR 重算。
2. 状态机。
3. 反向交叉取消。
4. 价格锚点寻找。
5. 信号去重。

## 7. 第一阶段实施顺序

第一阶段只打通框架，不做复杂信号。

1. 新建 `python/indicators/mmf_v2/` 模块。
2. 建立 `models.py` 和 `engine.py`。
3. `calculate_mmf_v2_markers` 先返回空 markers。
4. 新增 `/api/indicators/v2/mmf/calculate`。
5. 新增 `frontend/src/services/mt5/mmfV2IndicatorApi.ts`。
6. 新增 `tradingViewMmfV2Indicator.ts`，只负责空 markers 渲染链路。
7. `ChartCoreHost` 接入 `MMF_V2` 加载/卸载。
8. `MMF_V2` 面板保留 input/style/strategy/visibility 四个 tab。
9. 构建和基础测试通过。

第一阶段完成标准：

```txt
MMF_V2 能加载
MMF_V2 能卸载
MMF_V2 能请求 Python API
Python API 返回空 markers
前端不报错
不影响 MMF v1
```

## 8. 第二阶段实施顺序

第二阶段加入基础特征。

1. Python 实现 Stoch feature。
2. Python 实现 VDO feature。
3. Python 实现 MA feature。
4. Python 实现摩根区间 feature。
5. 每个 feature 单独写测试。
6. debug rows 返回每根 K 线的 feature 值。
7. 前端可选展示 debug 信息。

第二阶段完成标准：

```txt
Python 能独立算出 Stoch/VDO/MA/摩根区间
结果与前端视觉指标公式尽量对齐
每个 feature 有单元测试
```

## 9. 第三阶段实施顺序

第三阶段才开始加信号。

建议先做两个最小信号：

1. 低位高点。
2. 高位低点。

这两个信号的规则由 V2 状态机统一处理：

```txt
低位高点：
  Stoch 在 30 到 50 区间内发生真实死叉
  交叉前 K 高于 D 至少 1 点
  7 根 K 线内没有反向金叉
  快线向下推进至少 7 点
  以 eventIndex 为中心前后 7 根找最高价
  通过 VDO/摩根阻力过滤

高位低点：
  Stoch 在 50 到 70 区间内发生真实金叉
  交叉前 K 低于 D 至少 1 点
  7 根 K 线内没有反向死叉
  快线向上推进至少 7 点
  以 eventIndex 为中心前后 7 根找最低价
  通过 VDO/摩根支撑过滤
```

## 10. 测试策略

### Python 单元测试

必须覆盖：

1. Stoch 金叉/死叉识别。
2. 交叉前距离小于 1 点时排除。
3. 交叉后 7 根 K 线内反向交叉取消。
4. 快线没有推进 7 点时不确认。
5. 价格锚点以 eventIndex 为中心，而不是 markerIndex。
6. VDO 过滤。
7. 摩根区间过滤。
8. 去重逻辑。

### 前端测试

只覆盖：

1. `MMF_V2` 指标列表存在。
2. `MMF_V2` 可加载/卸载。
3. API 返回 marker 后能画出来。
4. 样式设置能影响 marker 显示。

不要在前端重复测试 Python 状态机。

## 11. 兼容策略

1. `MMF` 保持 v1，不改现有算法。
2. `MMF_V2` 使用独立 key、独立 API、独立前端注册名。
3. v1 和 v2 可以同时出现在指标列表。
4. v2 不读取 v1 设置，除非后续明确做迁移。
5. v2 的缓存 key 必须包含 `MMF_V2` 和 settings 版本号。

## 12. 关键原则

1. V2 先搭架构，再加细节。
2. Python 是计算真源头。
3. 前端只显示，不补算。
4. 每个信号都要输出 eventIndex、confirmIndex、markerIndex。
5. 每个过滤条件都要能在 reason 里解释。
6. 新增信号优先复用 feature 和 filter，不直接写进大函数。
7. 不影响 MMF v1。
