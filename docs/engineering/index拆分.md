# 构画：`index.js` 还可以怎么拆

更新：2026-09-16。装配根大约 **4980** 行，还要保留酒馆事件、feature 接线和跨模块 env。下面按「能整段搬走、少改行为」排序。

原则：新功能继续放 `business/` / `runtime/`；`index.js` 只留 `createX({...})` 和必要的薄封装。不要为拆而拆。灯工作台这一轮已经证明：产品可以进 `business/lamp/`，但 collect / extras / 手改如果顺手写在根上，根会立刻再胖一圈。

---

## 已经不在装配根里的

点 codec/渲染、线 schema/生成、面、轴叶子（data/anchor/panel/editor）、刻度控制器、刷新条/节拍算法、活动「改」、开局排队、换日 `shift`、间聊天/引导状态机、棱、坐标、笺、律、日台快照、对账灯检测/UI/打架提示词、灯宿主（读账/extras/手改/间↔灯）、设置绑定、外置存储、楼内框 feature、时旅宿主、锚点善后、楼内宿主、面板宿主、生成消息宿主、插件生命周期（开关 / 后台中止 / 注入清理）、侧栏模块介绍文案、调试 payload 预览、节拍条宿主、身份 / 聊天边界闸。

其中 `runtime/generation-messages.js` 已承接点/线/历观察者消息和面聊天拼装，装配根只负责 `createGenerationMessagesHost({...})` 接线。节拍间隔 / `paintPace` / `readPaceSnapshot` 已在 `business/refresh/pace-host.js`；根上只留声明提升的薄转发，避免 `bindLedgerRender` / `paceBook` 踩 TDZ。灯 `fight()` 仍在 refresh controller；根上 `runKind` 只转发。

`runtime/generation-context.js` 已承接 participant identity、chat boundary epoch 与 `scheduleForChatBoundary`。装配根只留 `createChatBoundaryGate({...})` 和声明提升的薄转发。切聊天走 `chatBoundary.beginBoundary()`。

## 这一轮又堆回去的（优先消化）

这些不是新功能该在的位置，只是接线还没搬走：

- `collectStageSnapshotHost`：日台取数（快照算法已在 `business/stage/snapshot.js`）。

引导旧写入路径 `applyGuideDraft` 已删。生产走意图交灯，不要再接回 commit。

## 下一刀最值

- **块**：世界书
- **当前范围**：角色/聊天/全局世界书解析、排除设置、面板端口
- **目标文件**：`runtime/world-info-host.js`
- **价值与风险**：底层已有 `world-info-context.js` / `world-info-panel.js`；不要顺手把日期检测接线塞进来。

灯宿主已迁到 `business/lamp/host.js`。身份闸已迁到 `runtime/generation-context.js`。

## 可以后移的中块

按依赖，不要跳刀：

1. **世界书** → `runtime/world-info-host.js`  
   角色/聊天/全局解析、排除、面板端口。底层已有 `world-info-context.js` / `world-info-panel.js`。
2. **诊断包** → `runtime/diagnostics-pack.js`（可与 debug-payload 分文件）  
   `collectDiagnosticRuntime`、安全包/当前聊天包导出。不要和 payload 预览绑死。
3. **日期检测接线** → `business/axis/date-detection-host.js`  
   最后迁，避免与时旅、锚点善后形成循环依赖。
4. **日台取数** → 可跟 `collectStageSnapshotHost` 一起收进 `business/stage/` 薄宿主。不是最肥，可后移。

机械清理（空节标题、相同 `syncLatest` 实现、纯转发 `parseLines` / `buildLinesPrompt`、仅测试使用的 `recall.js` 抽块、已停用的引导直接写账）已做完。仓内测试入口是 `node scripts/run-tests.mjs`。不要把为声明提升 / TDZ 留下的 deferred 包装误删成死代码。灯宿主尤其容易踩 TDZ：`lampFeature` 现在建在 `refreshController` 前面，靠闭包晚调用。身份闸同样：`charStableKey` / `_floorSig` 用回调晚调用，避免顶层解引用。

## 建议永远留在装配根

- 顶层 import 与 `bindX(env)` 一次接线。
- `jQuery(async () => { ... })` 启动顺序。
- 酒馆 `eventSource` 订阅；具体 handler 可委托给 `runtime/st-listeners.js`，注册表仍留在根。
- `getSettings`、`showToast`、`$in` 等宿主端口的最终实现。
- `runKind` 对 `refreshController.align/regenerate/fight` 的转发。

## 不要做的拆法

- 再做一个 `index2.js` 对半切，循环依赖会立刻回来。
- 把 `store.js` 和酒馆 `chatMetadata` 藏进业务模块。
- 为了看起来干净，把二十行胶水拆成多个无独立语义的文件。
- 把打架提示词、搜索、意图解析再搬回装配根；它们已经在 `business/lamp/`。
- 把间引导改回直接写账。
- 把世界书解析塞进 `generation-context.js`。

## 执行节奏

一次只搬一块，先补或确认目标块的契约测试，再跑 `node scripts/run-tests.mjs`。插件开关 / 后台中止已迁出；每次迁移都要重点检查切聊天、关插件、热重载和在途请求。灯/节拍迁移额外看：刷新条是否还在 `#sp-lamp-refresh-host`，paint 会不会把折叠条冲掉。身份闸额外看：切聊天后延迟回调是否作废、日期 bootstrap 是否只消费一次。搬完后git commit push，版本号+0.0.1。
