# 构画文档

本目录记录构画当前行为、维护约束与后续路线。当前基线版本为 **3.12.11**。

现行行为以代码和《运行逻辑与规则》为准；`archive/` 中的文件只保留设计背景，不代表当前实现。

## 从哪里开始

- [运行逻辑与规则](./运行逻辑与规则.md)：插件模块、自动化顺序、存储、注入和切聊天边界。
- [自动改账与诊断检查](./自动改账与诊断检查.md)：【改】、本楼队列、失败处理和诊断包。
- [token 预算与 TT-iOS 适配](./token预算与TT-iOS适配.md)：上下文预算、长聊天与 TauriTavern 适配边界。
- [路线图](./路线图.md)：当前功能优化、代码精简/拆分、待新增功能。
- [下一轮产品优化](./optimization-next.md)：对账灯工作台、日台 UI、棱导出进模板、坐标存配方、补录改 10 楼一次。
- [提示词一职一份](./prompts.md)：align / fight / regen / retry 与间意图的边界。
- [index.js 拆分](./engineering/index拆分.md)：仍在执行的装配根拆分顺序。

## 跑测试

仓内契约测试是各目录下的 `*.test.js`，走 Node 内置 test runner。Windows 上不要写 `node --test .`，会报找不到 `.`。

在仓库根目录执行：

```
node scripts/run-tests.mjs
```

## 目录约定

- `engineering/`：仍有效的工程维护方案。
- `archive/increments/`：已经落地的阶段性需求。
- `archive/handoffs/`：旧版本交接记录。
- `archive/audits/`：一次性代码审计。

诊断导出的 JSON 可能包含当前聊天剧情，不属于项目文档，不应提交到本目录。
