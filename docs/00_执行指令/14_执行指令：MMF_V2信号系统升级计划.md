# MMF_V2 信号系统升级计划

## 目标

把 MMF_V2 从“后端算法 + 前端符号显示”升级成真正的信号系统。

升级后的核心原则：

- 后端信号 `type` 是稳定信号 ID，策略、回测、提醒、建仓平仓都读取这个 ID。
- 符号默认样式、显示层级、替换关系、策略意图，不再散落在前端绘制文件里。
- 前端只作为控制面板，负责开关、颜色、大小、符号覆盖和绘制，不负责定义信号语义。

## 执行步骤

### 第一步：建立后端信号目录

新增：

- `python/indicators/mmf_v2/signal_catalog.py`

目录字段：

- `id`：稳定信号 ID，例如 `MMF_V2_TREND_DOWN_RETURN`
- `label`：中文名称
- `category`：信号类别，例如 `stoch`、`level`、`trend`、`break`
- `direction`：方向，例如 `up`、`down`、`support`、`resistance`
- `role`：角色，例如 `base_high`、`return_point`、`break_event`
- `timing`：当期信号或后期确认信号
- `layer`：显示层级，例如 `base`、`replacement`、`outer`、`event`
- `strategy_intent`：策略语义，例如 `short_entry_candidate`、`trend_open`
- `default_style`：默认符号、颜色、大小、位置
- `row_keys`：前端 row 映射字段
- `replaces`：替换关系

### 第二步：后端 marker 输出信号语义

更新：

- `python/indicators/mmf_v2/models.py`
- `python/signals/signal_model.py`
- `python/signals/signal_serialization.py`

要求：

- marker payload 保留原字段，兼容现有前端。
- 新增 `catalogId`、`label`、`category`、`direction`、`role`、`timing`、`layer`、`strategyIntent`、`defaultStyle` 等字段。
- `signalId` 继续表示“某一次具体信号实例”，`catalogId/type` 表示“信号类型 ID”。

### 第三步：前端信号目录对齐

新增：

- `frontend/src/workbench/chart/mmfV2SignalCatalog.ts`

前端目录只承接后端信号目录结构，用于绘制和用户样式覆盖。

### 第四步：前端 marker spec 从信号目录生成

更新：

- `frontend/src/workbench/chart/mmfV2MarkerSpecs.ts`

要求：

- 不再手写散落的 marker spec。
- 从 `mmfV2SignalCatalog` 读取默认位置、标题、字段、默认样式。
- 用户仍然可以通过设置覆盖颜色、大小、符号和显示开关。

### 第五步：前端优先级规则从信号目录生成

更新：

- `frontend/src/workbench/chart/mmfV2MarkerMapping.ts`

要求：

- `mmfV2MarkerPriorityRules` 由信号目录的 `replaces` 生成。
- 保留当前显示逻辑：支撑/阻力等后期信号保留在外层，回归/背离/反弹回撤替换随机高低点。

### 第六步：补测试

覆盖：

- 后端 signal catalog 字段完整。
- marker payload 带信号语义。
- 前端 marker specs 由目录生成。
- 前端优先级规则由目录生成。

### 第七步：写架构文档

新增：

- `docs/02_项目架构/MMF_V2信号系统架构说明.md`

说明完整链路：

`K线数据 -> Python 特征层 -> Python 信号状态机 -> 后端信号目录 -> API marker payload -> 前端控制面板/绘制 -> 未来策略模块`

## 验收命令

```powershell
.\scripts\check_all.ps1
```

验收标准：

- Python 单测通过。
- 前端 lint、logic、e2e、build 通过。
- 现有 UI 显示行为不变。
- marker payload 和 signal record 已具备策略可读的稳定信号语义字段。
