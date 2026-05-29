# MMF_V2 工程整理收口计划

## 目标

MMF_V2 的信号规则已经基本收口，后续优化重点不再新增算法，而是提高代码工整度、可维护性和可验证性。

本计划只做工程整理，不改变现有算法语义。

## 执行顺序

### 第一步：拆分前端 MMF_V2 指标大文件

目标文件：

- `frontend/src/workbench/chart/tradingViewMmfV2Indicator.ts`

当前问题：

- 文件接近千行。
- 类型定义、marker 样式、后端 marker 映射、覆盖规则、远程请求、绘制、tooltip 都在一个文件里。
- 后续调整符号叠加顺序时，容易误动请求或绘制逻辑。

拆分目标：

- `mmfV2Types.ts`：MMF_V2 前端 row/context/spec 类型。
- `mmfV2MarkerSpecs.ts`：所有 marker 的颜色、大小、符号、上下方向、tooltip 标题。
- `mmfV2MarkerMapping.ts`：后端 marker 转前端 row，以及符号替换/叠加规则。
- `tradingViewMmfV2Indicator.ts`：只保留指标注册、远程计算、绘制和 tooltip 入口。

验收标准：

- 不改变任何显示结果。
- `createMmfV2RowsFromMarkers` 的测试全部通过。
- `npm run lint` 和 `npm run build` 通过。

### 第二步：后端 state machine 按信号域拆模块

目标文件：

- `python/indicators/mmf_v2/state_machine.py`

建议拆分：

- `support_resistance.py`
- `expected_levels.py`
- `trend_retrace.py`
- `trend_return.py`
- `trend_divergence.py`
- `vdo_breaks.py`

验收标准：

- `calculate_mmf_v2_state_machine_markers` 仍是唯一聚合入口。
- 不改变 marker 类型、reason、坐标。
- `tests/test_mmf_v2_regression.py` 全部通过。

### 第三步：拆分指标设置 schema

目标文件：

- `frontend/src/workbench/rightDrawer/indicatorSettingsSchema.ts`

当前问题：

- 文件超过两千行。
- 所有指标设置混在一起。
- MMF / MMF_V2 字段数量多，后续维护成本高。

建议拆分：

- `settings/maSettings.ts`
- `settings/vdoSettings.ts`
- `settings/mmfSettings.ts`
- `settings/mmfV2Settings.ts`

验收标准：

- 对外导出的类型和默认值保持兼容。
- 设置持久化不丢字段。
- 前端 lint/build 通过。

### 第四步：拆分 HTTP bridge 的 MMF_V2 服务逻辑

目标文件：

- `scripts/http_bridge/indicator_service.py`

建议拆出：

- `scripts/http_bridge/mmf_v2_indicator_service.py`

迁移内容：

- `_normalize_mmf_v2_settings`
- `_mmf_v2_settings_cache_signature`
- `calculate_mmf_v2_indicator_from_rows`

验收标准：

- API 路径不变。
- 缓存签名不丢字段。
- Python 单测通过。

### 第五步：建立统一 marker 优先级表

当前问题：

- 前端替换规则分散在多个 override 函数里。
- 规则能跑，但读代码时需要来回跳。

建议目标：

- 用一张表表达层级：
  - 普通随机高/低点。
  - 当期替换层：反弹/回撤、回归、背离。
  - 后期确认外层：支撑/阻力、预期支撑/阻力。
  - 突破事件层。

验收标准：

- 支撑/阻力仍保留在外层。
- 背离/回归/反弹等只替换普通高低点或同层点。
- 前端 marker 映射测试覆盖所有关键叠加关系。

## 总体验收

每一步完成后至少运行：

```powershell
npm run lint
npm run build
```

涉及后端时运行：

```powershell
.\.venv\Scripts\python.exe -m pytest tests\test_mmf_v2_regression.py
```

阶段性大改完成后运行：

```powershell
.\scripts\check_all.ps1
```
