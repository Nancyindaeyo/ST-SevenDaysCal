# 构画：`index.js` 还可以怎么拆

更新：2026-09-16。装配根还要保留酒馆事件、feature 接线和跨模块 env。下面按「能整段搬走、少改行为」排序。

原则：新功能继续放 `business/` / `runtime/`；`index.js` 只留 `createX({...})` 和必要的薄封装。不要为拆而拆。

---

## 已经不在装配根里的

点 codec/渲染、线 schema/生成、面、轴叶子（data/anchor/panel/editor）、刻度控制器、刷新条/节拍、活动「改」、开局排队、换日 `shift`、间、棱、坐标、笺、设置绑定、外置存储、楼内框 feature、时旅宿主、锚点善后、楼内宿主、面板宿主、生成消息宿主、插件生命周期（开关 / 后台中止 / 注入清理）。

其中 `runtime/generation-messages.js` 已承接点/线/历观察者消息和面聊天拼装，装配根只负责 `createGenerationMessagesHost({...})` 接线。

## 下一刀最值

- **块**：最近请求 payload 的复制和展示
- **当前范围**：调试面板里的 payload 文本
- **目标文件**：`runtime/debug-payload.js`
- **价值与风险**：风险最低，可单独完成。

## 可以后移的中块

- 身份 / 边界：把 `captureParticipantIdentity`、`chatBoundaryEpoch` 迁入 `runtime/generation-context.js`。该文件目前只有 reroll/标签清洗，身份逻辑尚未迁入。
- 日期检测接线：把 `createDateDetectionController({...})` 迁入 `business/axis/date-detection-host.js`，避免与时旅、锚点善后形成循环依赖。
- 世界书读取、排除和面板端口：迁入 `runtime/world-info-host.js`。底层已有 `world-info-context.js` / `world-info-panel.js`，宿主解析仍在根。
- 节拍条：把 `paintPace` / `readPaceSnapshot` 迁入 `business/refresh/pace-host.js`，DOM 端口仍由装配根注入。
- 引导落地：继续压薄已有 space feature 的 `applyGuideDraft` 封装，不新增万能层。

机械清理（空节标题、相同 `syncLatest` 实现、纯转发 `parseLines` / `buildLinesPrompt`、仅测试使用的 `recall.js` 抽块）已做完。仓内测试入口是 `node scripts/run-tests.mjs`。不要把为声明提升 / TDZ 留下的 deferred 包装误删成死代码。

## 建议永远留在装配根

- 顶层 import 与 `bindX(env)` 一次接线。
- `jQuery(async () => { ... })` 启动顺序。
- 酒馆 `eventSource` 订阅；具体 handler 可委托给 `runtime/st-listeners.js`，注册表仍留在根。
- `getSettings`、`showToast`、`$in` 等宿主端口的最终实现。

## 不要做的拆法

- 再做一个 `index2.js` 对半切，循环依赖会立刻回来。
- 把 `store.js` 和酒馆 `chatMetadata` 藏进业务模块。
- 为了看起来干净，把二十行胶水拆成多个无独立语义的文件。

## 执行节奏

一次只搬一块，先补或确认目标块的契约测试，再跑 `node scripts/run-tests.mjs`。插件开关 / 后台中止已迁出；每次迁移都要重点检查切聊天、关插件、热重载和在途请求。
