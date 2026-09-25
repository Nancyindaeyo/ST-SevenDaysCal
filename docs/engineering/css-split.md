# 构画：`style.css` 怎么拆、现在不要拆

复核：3.15.5 / 2026-09-25。这是评估，不是开工令。现行仍是单文件 `style.css`（约 8354 行），同时服务 Shadow DOM 主窗口和 light DOM 楼内块。

## 结论

先保持单文件同源输出。不要改成 SPA，也不要在线 Phase 2 未稳定前做大规模 class 重写。若以后拆，必须仍产出**同一份** CSS，分别挂到 light DOM 和 shadow root。

文件头已经写明加载方式：全局注入一份给 `.sp-inline-box` 等楼内块，`injectModal()` 再经 `<link rel="stylesheet">` 引同一 rel 进 shadow。拆目录之后如果只进其中一处，弹窗会丢变量，楼内块会丢主题。

## 现行分段（可作目录草案）

按现有注释，而不是重新发明语义层：

| 建议文件 | 现有段落 | 注意 |
| --- | --- | --- |
| `tokens.css` | Design tokens、ST theme cascade、forced theme、去 text-shadow、基准字号 | `--sp-*` 必须在 `.sp-root` / FAB / toast 这些根上同时可见 |
| `shell.css` | Root、Sheet、Sidebar、Content、设置层、FAB、Toast、Resize、Mobile | `#sp-fab`、`#sp-toast-wrap` 挂在 shadow 外 |
| `modules.css` | 点/线/面/轴/刻度/间/棱/坐标/笺/律/日台/灯/改 面板 | 先按注释切，不要为了「干净」改 class |
| `inline.css` | 线块、刻度行、历七天条、点条、楼内仪表盘、脚注实验 | 只服务 light DOM 聊天流 |
| `motion.css` | `prefers-reduced-motion`、按压反馈、neon busy | 短，可先留在 shell |

不要按框架组件拆；没有构建步骤，最多用脚本按序拼接，或继续手维护单文件。

## 重复与风险（抽查，不是完整 lint）

- 主题变量写了两套：`.sp-root` 与 `#sp-fab, #sp-toast-wrap`。拆开后漏抄就会出现「窗口一套色、球/toast 另一套」。
- 楼内块和面板共用 `.sp-line-*`、`.sp-alm-*` 尺度。把「模块」和「楼内」按选择器硬拆，容易漏掉共用规则。
- `* { text-shadow }` 必须靠 `.sp-root *` 覆盖；这不是继承，搬家时不能只搬 host。
- 线页面有阶段条、sheet 切换、冷知识列表。Phase 2 只抽 swipe/CMR controller，不重写这些 class。

## 允许的下一步

1. 保持单文件，用本表当目录索引。
2. 若真要拆：写一个按上表顺序拼接的脚本，产物仍叫 `style.css`，`manifest.json` 和 `injectModal()` 不改入口。
3. 拼接后目视对比 Shadow 窗口和一条带楼内框的 AI 楼；差一条规则就回滚。

不要做：Vue/React 换皮、两套 CSS、只给 shadow 或只给 light 出包、借拆分改线页面 class。
