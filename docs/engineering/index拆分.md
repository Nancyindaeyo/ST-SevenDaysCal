# 构画：`index.js` 还可以怎么拆

更新：2026-09-16。装配根大约 **4545** 行，还要保留酒馆事件、feature 接线和跨模块 env。下面按「能整段搬走、少改行为」排序。

原则：新功能继续放 `business/` / `runtime/`；`index.js` 只留 `createX({...})` 和必要的薄封装。不要为拆而拆。灯工作台这一轮已经证明：产品可以进 `business/lamp/`，但 collect / extras / 手改如果顺手写在根上，根会立刻再胖一圈。

`createLinesFeature` / `createActivityFeature` / `createPanelHost` / `createRefreshController` 这些大 options 看起来肥，那是装配根该留的接线，不是下一刀。下一刀只搬「根上还在跑算法或分发」的函数。

---

## 已经不在装配根里的

点 codec/渲染、线 schema/生成、面、轴叶子（data/anchor/panel/editor）、刻度控制器、刷新条/节拍算法、活动「改」、开局排队、换日 `shift`、间聊天/引导状态机、棱、坐标、笺、律、日台快照/取数、对账灯检测/UI/打架提示词、灯宿主（读账/extras/手改/间↔灯）、设置绑定、外置存储、楼内框 feature、时旅宿主、锚点善后、楼内宿主、面板宿主、生成消息宿主、插件生命周期（开关 / 后台中止 / 注入清理）、侧栏模块介绍文案、调试 payload 预览、节拍条宿主、身份 / 聊天边界闸、世界书解析/排除/面板端口、诊断包收集/导出、日期检测接线、账本历史恢复、有效日期锚策略。

其中 `runtime/generation-messages.js` 已承接点/线/历观察者消息和面聊天拼装，装配根只负责 `createGenerationMessagesHost({...})` 接线。节拍间隔 / `paintPace` / `readPaceSnapshot` 已在 `business/refresh/pace-host.js`；根上只留声明提升的薄转发，避免 `bindLedgerRender` / `paceBook` 踩 TDZ。灯 `fight()` 仍在 refresh controller；根上 `runKind` 只转发。

`runtime/generation-context.js` 已承接 participant identity、chat boundary epoch 与 `scheduleForChatBoundary`。装配根只留 `createChatBoundaryGate({...})` 和声明提升的薄转发。切聊天走 `chatBoundary.beginBoundary()`。

`runtime/world-info-host.js` 已承接角色/聊天/全局解析、排除、筛选桶和设置页面板端口。底层仍是 `world-info-context.js` / `world-info-panel.js` / `world-info-selection.js`。装配根只留 `createWorldInfoHost({...})` 和 `buildWorldInfoContext` / `renderWiList` 薄转发。`charStableKey` 仍留在根上：刻度/成人向/日期锚也要用。

`runtime/diagnostic-pack-host.js` 已承接安全包收集、助手包合并导出和诊断 JSON 下载。底层仍是 `diagnostic-pack.js` 的纯打包函数。装配根只留 `createDiagnosticPackHost({...})` 和 `collect` / `exportSafe` / `exportAssistant` 薄转发。`debug-payload.js` 的预览复制仍独立，不要绑进诊断宿主。

`business/axis/date-detection-host.js` 已承接日期判定 controller 的端口映射、`applyDetectedDate` 的 notify 包装、日历注入提示词和 `story` 善后源。底层仍是 `date-detection.js`。装配根只留 `createDateDetectionHost({...})` 和薄转发。时旅的 `resolveDestinationDate` 仍留在根上：那是时旅消费日期，不要塞进日期宿主，否则和时旅/锚点善后循环。

`business/stage/host.js` 已承接日台取数（证据日标签、点/历/刻度/线、parse 失败变空）。快照算法仍在 `snapshot.js`。装配根只留 `createStageHost({...})`，`stageFeature` 从宿主取出。

`business/history/host.js` 已承接 `openBookHistory` 按 kind 的 read/write/preview/afterRestore。对话框算法仍在 `dialog.js`。装配根只留 `createHistoryHost({...})` 和薄转发。轴恢复仍不改「今天」锚点。

`runtime/date-anchor-policy.js` 已承接有效日期锚（pending/unresolved 不是锚、半残 SDC 不能提前停校准）和 `getStoryCalibration`。仓库仍是 `chat-date-anchor.js`。装配根只留 `createDateAnchorPolicy({...})` 和薄转发。`charStableKey` 仍留在根上，策略只收 `charKey`。

## 这一轮还堆在根上的（优先消化）

这些不是新功能该在的位置，只是接线或分发还没搬走：

- `fillLatestStoryClock`：补这楼隐藏时间戳的读表单/写回。
- `storeClearHost`：清存储后的 abort / 空账刷新端口。
- `collectBeatLedgerContext`：本轮拍取数（面游标、间近文、点/线 raw）。和日台 collect 同类。
- `memoryPreCheckConfirm` + `_getMemTextRaw`：生成前记忆健康闸，以及柏宝书/内置记忆原文。

引导旧写入路径 `applyGuideDraft` 已删。生产走意图交灯，不要再接回 commit。

## 下一刀最值

- **块**：补这楼时间戳
- **当前范围**：`fillLatestStoryClock` 读表单/写回隐藏注释
- **目标文件**：`business/axis/story-clock-fill.js`
- **价值与风险**：写回仍走酒馆 `saveChatDebounced` + `MESSAGE_EDITED` 端口。不要顺手把清存储善后塞进来。

灯宿主已迁到 `business/lamp/host.js`。身份闸已迁到 `runtime/generation-context.js`。世界书已迁到 `runtime/world-info-host.js`。诊断包已迁到 `runtime/diagnostic-pack-host.js`。日期检测已迁到 `business/axis/date-detection-host.js`。日台取数已迁到 `business/stage/host.js`。账本历史已迁到 `business/history/host.js`。有效日期锚已迁到 `runtime/date-anchor-policy.js`。

## 可以后移的中块

按依赖，不要跳刀：

1. **补这楼时间戳** → `business/axis/story-clock-fill.js`  
   `fillLatestStoryClock`。写回仍走酒馆 `saveChatDebounced` + `MESSAGE_EDITED` 端口。
2. **清存储善后** → `runtime/store-clear-host.js`  
   `storeClearHost`。只搬 abort/空账刷新端口，不要把 `dispatchStoreClear*` 再包一层空壳。
3. **本轮拍取数** → `business/beat/context.js`  
   `collectBeatLedgerContext`。不要和日台宿主合并。
4. **记忆闸 / 记忆原文** → `business/memory/inject-host.js`  
   `memoryPreCheckConfirm`、`_getMemTextRaw`。柏宝书覆盖检查已在 `baibaoshu.js`。
5. **时旅目的日** → 仍留在 `createTimeTravelHost({ resolveDestinationDate })`  
   日期检测搬走之后，这一段还是时旅自己的消费策略（有戳用戳、关自动检测用所选日、否则 `ensureResolved`）。不要迁回日期宿主。
6. **界面字体 CSS 解析** → `business/shell/font.js`  
   `parseFontFamilyFromCss` 是纯函数，却还 export 在装配根。`applyUiFont` 可一并走。不是最肥，可后移。
7. **拉模型列表** → `runtime/api-fields-bind.js` 或 `api/models.js`  
   `fetchModels`。设置页 UI 仍由根上 `bindApiFields` 接线。
8. **棱运行时 options** → `createTheaterHostFeature` 仍是一长串端口  
    `business/theater/runtime.js` 已在。再拆要小心坐标 `saveFromTheater` 和世界书列表回调。
9. **迁移包 controller 胶水** → `createGouhuaBackupController`  
    `runtime/backup.js` 已在。根上只是坐标端口 + 世界书 load/save。
10. **AI 气泡 HTML** → `renderAiMessageHtml`  
    临时把 `regex` 塞进 `disabledExtensions` 的约定必须写进目标文件，不能静默丢掉。

机械清理（空节标题、相同 `syncLatest` 实现、纯转发 `parseLines` / `buildLinesPrompt`、仅测试使用的 `recall.js` 抽块、已停用的引导直接写账）已做完。仓内测试入口是 `node scripts/run-tests.mjs`。不要把为声明提升 / TDZ 留下的 deferred 包装误删成死代码。灯宿主尤其容易踩 TDZ：`lampFeature` 现在建在 `refreshController` 前面，靠闭包晚调用。身份闸同样：`charStableKey` / `_floorSig` 用回调晚调用，避免顶层解引用。世界书宿主在 `$in` 之后建，避免 shadow 未就绪。诊断宿主在 `sameFloorGate` 之后建，避免队列 / 活动 / 对话框未就绪。日期宿主在 `latestStoryClock` 之后建，善后走回调；日台宿主在 slip/law 之后建，`onOpen` 闭包晚读 `beatFeature`。有效日期锚策略在 `axisDateActions` 之后建，避免 saveAnchor 未就绪。账本历史宿主在面板/feature 之后建，afterRestore 闭包晚调用。

## 建议永远留在装配根

- 顶层 import 与 `bindX(env)` 一次接线。
- `jQuery(async () => { ... })` 启动顺序；`injectModal()` 里那串 `bindLinesPanel` / `bindAlmanacPanel` / `bindSettingsPanel` 是注册表，不是业务。
- 酒馆 `eventSource` 订阅；具体 handler 可委托给 `runtime/st-listeners.js`，注册表仍留在根。
- `getSettings`、`showToast`、`$in` 等宿主端口的最终实现。
- `runKind` 对 `refreshController.align/regenerate/fight` 的转发。
- `charStableKey`：世界书、刻度、成人向共用的角色卡稳定键。
- `createTimeTravelHost` / `createLinesFeature` / `createActivityFeature` / `createPanelHost` 的 options 对象本身。

## 不要做的拆法

- 再做一个 `index2.js` 对半切，循环依赖会立刻回来。
- 把 `store.js` 和酒馆 `chatMetadata` 藏进业务模块。
- 为了看起来干净，把二十行胶水拆成多个无独立语义的文件。
- 把打架提示词、搜索、意图解析再搬回装配根；它们已经在 `business/lamp/`。
- 把间引导改回直接写账。
- 把世界书解析塞进 `generation-context.js`。
- 把 `charStableKey` 藏进世界书宿主、日期检测宿主或有效日期锚策略，让刻度/成人向反向去读。
- 把诊断导出绑进 `debug-payload.js` 预览。
- 把时旅 `resolveDestinationDate` 塞进 `date-detection-host.js`。
- 把日台 collect 和灯 collect 合成一个万能读账宿主。
- 把账本历史恢复和有效日期锚绑成一个文件。

## 执行节奏

一次只搬一块，先补或确认目标块的契约测试，再跑 `node scripts/run-tests.mjs`。插件开关 / 后台中止已迁出；每次迁移都要重点检查切聊天、关插件、热重载和在途请求。灯/节拍迁移额外看：刷新条是否还在 `#sp-lamp-refresh-host`，paint 会不会把折叠条冲掉。身份闸额外看：切聊天后延迟回调是否作废、日期 bootstrap 是否只消费一次。世界书额外看：切聊天筛选桶不串、排除书不再进点/线生成、设置页列表与排除清单仍能画。诊断包额外看：安全包不含剧情/Key；助手包走独立导出；payload 预览仍能单独复制。日期检测额外看：切聊天后首楼 `suppressAftermath` 只落日期、时旅仍能复用判定终态。日台额外看：没证据日时标签为空、点/线 parse 失败变空列表、侧栏跳转仍走 `openActivityItem`。账本历史额外看：切聊天后 isCurrent 作废、轴恢复不改日期锚、刻度恢复仍要二次确认。有效日期锚额外看：pending 不是锚、半残 SDC 不提前停校准、完整 SDC 换楼后校准让位。搬完后git commit push，版本号+0.0.1。
