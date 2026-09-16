# 构画提示词一职一份

日期：2026-09-16。和《下一轮产品需求》一起看。灯跑改账时只允许这些 kind；间不发明第五套跑法。

意图只填进模板里的「为什么 / 写错了什么 / 要动哪几条」，**不替换**骨架。间同意后交给灯的是意图，不是顾问 system prompt。

【改】重试：当初那条的 kind + 意图，一字不换套。

---

## kind

| kind | 谁点 | 函数 | 动什么 |
|---|---|---|---|
| `align` | 冲突页「按正文对齐」 | `business/refresh/prompt.js` `buildReconcilePrompt` | 未锁点/线，跟最新正文 |
| `fight` | 冲突页「按打架一起改」 | `business/lamp/fight-prompt.js` `buildFightPrompt` | 只动待改篮点名的条目 |
| `regen` | 冲突页「重新生成勾选项」 | 各本生成 prompt + `buildRefreshAddon` | 勾中模块整段重做 |
| `retry` | 【改】重试 | 失败那次的 kind | 与失败那次相同 |
| `hand` | 编辑键 | 无 API | 手改字段 |
| `intent` | 间「交给灯」 | 不是模型 prompt | 人话清单，灯选上面某一种再跑 |

间两套聊天 / 草案用：

| 用途 | 函数 |
|---|---|
| 纯聊天 | `business/space/prompts.js` `buildSpaceChatSystemPrompt` |
| 引导灵感 | `buildGuideInspirePrompt` |
| 引导草案 | `buildGuideDraftPrompt` |
| 收成意图 | `business/lamp/intent.js` `formatLampIntent` |

打架约束（写进 fight 模板，不要写进 align）：

- 只改列出的条目；锁定默认不动
- 一天多地行程不要收成同一个地点
- 面默认当前节点；轴禁止整年重铺
- 柏宝书只对照，不改对方
- 间没写清跑法：从冲突篮去的默认 `fight`；从搜索勾去、又不是冲突的，灯上让用户选。用户可回间再出一版写清楚的意图。
