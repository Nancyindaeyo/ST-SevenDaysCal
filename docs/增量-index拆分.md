# 构画：`index.js` 还可以怎么拆

更新：2026-09-11。现在大约 5200 行，已经从约 9000 行拆过一轮。装配根还要留着：酒馆事件、feature 接线、跨模块 env。下面按「能整段搬走、少改行为」排序。**这一轮不拆**，以后某一刀必须动那一块时再抽。

原则：新功能继续放 `business/` / `runtime/`；`index.js` 只留 `createX({...})` 和薄封装。不要为拆而拆。

---

## 已经不在装配根里的

点 codec/渲染、线 schema/生成、面、轴叶子（data/anchor/panel/editor）、刻度控制器、刷新条/节拍、活动「改」、开局排队、换日 `shift`、间、棱、坐标、设置绑定、外置存储、楼内框 feature。

## 下一刀最值（仍占装配根大段）

| 块 | 大约位置 | 抽到哪 | 为什么值 |
|---|---|---|---|
| 时旅会话 | `startTimeTravel` / `cancelTimeTravel` / `clearTimeTravelSession`（约 1194–1325） | `business/axis/time-travel-host.js` | 独占通道，和普通对齐抢楼；已经有 `time-travel-session.js`，宿主胶水还堆在这 |
| 锚点善后 | `runAnchorAftermath`、`schedulePointNeedsSync`（约 2897–2934） | `business/axis/aftermath.js` | 换日滚点已经挂在这，再加逻辑会继续胀 |
| 聊天观察 / 楼内刷新 | `initChatObserver`、`syncLatest*Block`、`backfillLinesInlineBlocks` | `runtime/inline-host.js` | 和 `st-listeners` 对称，都是酒馆事件后的 DOM |
| 打开面板 / 视角 | `injectModal`、`setView`、`switchToCharView`、`onRegenClick`（约 2989–3480） | `business/shell/panel-host.js` | 纯 UI 编排，业务已在 shell/* |
| 生成消息组装调用点 | `buildMessages` 一类仍在 index 里拼参 | 继续往 `runtime/generation-messages.js` 收参数表 | 点/线/面/间/轴共用，改一处怕漏 |

## 可以后移的中块

| 块 | 抽到哪 |
|---|---|
| `applyPluginEnabled` / `_abortAllBackground` | `runtime/plugin-lifecycle.js` |
| 身份 / 边界：`captureParticipantIdentity`、`chatBoundaryEpoch` | `runtime/generation-context.js`（已有一部分） |
| 日期检测接线（`createDateDetectionController({...})` 那一大包 options） | `business/axis/date-detection-host.js` |
| 记忆 / 世界书排除：`getWiExcludeSet`、`setWiExcluded` | `runtime/world-info-host.js` |
| 调试 payload 复制 | `runtime/debug-payload.js` |
| 节拍条 paint（`paintPace` / `readPaceSnapshot`） | `business/refresh/pace-host.js` |
| 引导落地 `applyGuideDraft` | 已有 space feature，把 index 里的薄封装再压薄 |

## 建议永远留在装配根

- 顶层 import 与 `bindX(env)` 一次接线
- `jQuery(async () => { ... })` 启动序
- 酒馆 `eventSource` 订阅（可委托 `st-listeners.js`，但注册表仍在这）
- `getSettings` / `showToast` / `$in` 这类宿主端口的最终实现

## 不要做的拆法

- 再做一个 `index2.js` 对半切：循环依赖会立刻回来
- 把 `store.js` 和酒馆 `chatMetadata` 藏进业务模块
- 为「看起来干净」把 20 行胶水抽成 5 个文件

## 建议节奏

一次只搬走上表「最值」里的一块，配上现有 node:test，提交后再动下一块。时旅宿主是最值得的第一刀。
