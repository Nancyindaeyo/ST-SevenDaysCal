# 空 catch 分级

复核：3.15.5 / 2026-09-25。这是现行审查，不是把每个 `catch {}` 都改成 toast。

| 级别 | 含义 | 现行处理 |
| --- | --- | --- |
| critical | 写账、确认提交、撤回、迁移最终发布 | 必须传播 `{ ok, stale, commitState, reason }`，禁止空 catch |
| best-effort | 注入重绘、楼内框、toast、observer 拆卸、诊断落盘 | 后续监听器继续；连续失败进诊断管理，不逐楼 toast |
| ignore | 已经中止的 Abort、重复 disconnect、可选 UI 回调 | 保持空 catch，避免把清理变成新故障 |

## 本轮改动

`runtime/st-listeners.js` 的刻度注入重评分从空 catch 改为 `noteBestEffortFailure()`。连续相同失败在诊断概览合并成一条。

## 仍保持空 catch 的典型位置

- `abort()` / `disconnect()` / `releasePointerCapture`：清理路径
- toast / notify / `onChange` 回调：调用方失败不能反向打断业务
- 诊断 trace 自身落盘失败：诊断不得影响主链
- 外置迁移回滚删除副本：best-effort 清理，失败保留已校验副本直到刷新确认

不要把上述 ignore/best-effort 改成 critical；缺诊断的 best-effort 再补脱敏 trace。
