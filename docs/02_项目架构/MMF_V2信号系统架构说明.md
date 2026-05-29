# MMF_V2 信号系统架构说明

## 定位

MMF_V2 现在不是单纯的前端指标，而是一套后端驱动的信号系统。

前端只作为控制面板和显示层：

- 控制是否显示某类信号。
- 控制符号、颜色、大小。
- 绘制后端返回的 marker。

真正的计算、信号身份、信号语义、策略意图，统一由后端系统定义。

## 总链路

```text
K线数据
  -> Python 特征层
  -> Python 随机指数状态机
  -> Python MMF_V2 信号模块
  -> 后端信号目录 signal catalog
  -> HTTP marker payload
  -> 前端控制面板和绘制层
  -> 未来策略/回测/提醒模块
```

## 一、数据输入层

入口：

- `scripts/http_bridge/mmf_v2_indicator_service.py`
- `python/indicators/mmf_v2/engine.py`

前端会把当前 K 线数据、开关和参数发送给后端。

这里的前端参数只是输入，不直接参与算法判断。后端会把这些输入归一化成 `MmfV2Settings`。

## 二、Python 特征层

核心文件：

- `python/indicators/mmf_v2/features.py`

这一层统一生成 MMF_V2 的底座字段：

- `Stoch`：`stochK`、`stochD`
- `VDO`：`vdo`、`vdoCrossUpUpper`、`vdoCrossDownLower` 等突破字段
- `MA`：内部固定 `SMA(120)`，source 为 `hlc3`
- `Morgan`：`morgan_center`、`morgan_true_range`、各比例位

也就是说，MMF_V2 的关键指标已经全部是 Python 后端版本。

## 三、随机指数状态机

核心文件：

- `stoch_state_machine.py`
- `stoch_models.py`
- `stoch_cross_detection.py`
- `stoch_confirmation.py`
- `stoch_signal_factory.py`

职责：

- 识别死叉、金叉。
- 根据确认窗口确认高点/低点。
- 找到锚点 K 线。
- 输出基础 `StochStateSignal`。

这层只负责随机指数结构，不负责支撑阻力、趋势、回归、背离。

## 四、MMF_V2 信号模块

核心聚合入口：

- `python/indicators/mmf_v2/state_machine.py`

信号模块：

- `support_resistance.py`：支撑位、阻力位
- `expected_levels.py`：预期支撑位、预期阻力位
- `trend_retrace.py`：下降趋势反弹点、上升趋势回撤点
- `trend_return.py`：下降趋势回归点、上升趋势回归点
- `trend_divergence.py`：下降趋势背离点、上升趋势背离点
- `vdo_breaks.py`：支撑/阻力突破事件

这些模块都消费同一个 Python 特征层，不依赖前端图形。

## 五、信号目录

核心文件：

- `python/indicators/mmf_v2/signal_catalog.py`

信号目录是 MMF_V2 的统一语言。

每个信号有稳定 ID：

- `MMF_V2_HIGH`
- `MMF_V2_LOW`
- `MMF_V2_SUPPORT`
- `MMF_V2_RESISTANCE`
- `MMF_V2_TREND_DOWN_RETURN`
- `MMF_V2_TREND_UP_DIVERGENCE`
- `MMF_V2_SUPPORT_DOWN_BREAK`
- `MMF_V2_RESISTANCE_UP_BREAK`

每个信号目录项包含：

- `catalogId`：稳定信号类型 ID
- `label`：中文名称
- `category`：信号类别
- `direction`：方向
- `role`：角色
- `timing`：当期信号或后期确认信号
- `layer`：显示层级
- `strategyIntent`：策略意图
- `defaultStyle`：默认符号、颜色、大小、位置
- `replaces`：默认替换关系
- `preserves`：默认保留关系

## 六、信号实例 ID

系统里有两个不同概念：

### `catalogId`

代表信号类型。

例如：

```text
MMF_V2_TREND_DOWN_RETURN
```

策略判断某类信号时，应该读取 `catalogId` 或 `type`。

### `signalId`

代表某一次具体发生的信号实例。

它由指标名、信号类型、入场 K 线、标记 K 线组合而成。

例如：

```text
MMF_V2|MMF_V2_TREND_DOWN_RETURN|XAUUSD|M5|entry|XAUUSD|M5|marker
```

策略下单、回测、去重、追踪某个具体信号时，应该读取 `signalId`。

## 七、API 输出

后端 marker payload 现在会输出：

- 原有坐标字段：`index`、`time`、`price`、`entryPrice`
- 原有类型字段：`type`
- 稳定实例字段：`signalId`
- 新增目录字段：`catalogId`、`label`、`category`、`direction`、`role`、`timing`、`layer`、`strategyIntent`、`defaultStyle`

因此未来策略模块不需要理解前端符号。

策略读取：

- `catalogId`
- `role`
- `direction`
- `strategyIntent`
- `price`
- `time`
- `entryPrice`
- `signalId`

## 八、前端显示层

核心文件：

- `frontend/src/workbench/chart/mmfV2SignalCatalog.ts`
- `frontend/src/workbench/chart/mmfV2MarkerSpecs.ts`
- `frontend/src/workbench/chart/mmfV2MarkerMapping.ts`

前端现在有自己的显示目录，结构对齐后端信号目录。

它的职责：

- 把后端 marker 映射成 chart row。
- 根据信号目录生成 marker specs。
- 根据信号目录生成默认替换优先级。
- 接收用户对颜色、大小、符号、开关的覆盖。

前端不再承担信号语义定义。

## 九、策略层预留

未来策略模块应该读取后端信号记录，而不是读取前端符号。

例如：

```text
catalogId = MMF_V2_TREND_DOWN_RETURN
strategyIntent = short_entry_candidate
direction = down
role = return_point
```

这比读取 `◆`、`▲`、`□` 更稳定。

符号只是视觉皮肤，信号 ID 才是交易语言。

## 当前状态

现在 MMF_V2 已经形成：

- Python 指标底座
- Python 信号状态机
- Python 信号目录
- HTTP 信号 payload
- 前端控制面板
- 前端显示目录
- 前端符号优先级
- 策略可读的信号 ID 和意图字段

这套系统已经从“指标显示”升级成“可供策略使用的信号系统”。
