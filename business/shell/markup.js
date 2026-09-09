export function panelMarkup({
    themeToggleTitle,
    themeToggleIcon,
    fabEnabled,
    refreshFoldHtml,
    beatFoldHtml,
    activityFeature,
    getSettings,
    hasCustomApi,
    cfg,
    escapeAttr,
    escapeHtml,
    storyClockStatusCopy,
    storyClockController,
    THEATER_TARGET_CHARS,
    THEATER_COUNT_DEFAULT,
    THEATER_EXPORT_BOOK,
    linesFeature,
    paceStripHtml,
    collectPaceRows,
    readPaceSnapshot,
    getAlmanacJudgeInterval,
    getLedgerReconcileInterval,
    getLinesMode,
    getLinesInterval,
    outlineFeature,
} = {}) {
    return `
            <div class="sp-backdrop"></div>
            <div class="sp-sheet">
                <aside class="sp-sidebar">
                    <nav class="sp-sidebar-tabs" aria-label="主视图">
                        <button class="sp-side-tab sp-view-btn sp-view-active" data-view="schedule">
                            <span class="sp-tab-glyph" aria-hidden="true"><svg class="sp-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/></svg></span>
                            <span class="sp-tab-label">点</span>
                        </button>
                        <button class="sp-side-tab sp-view-btn" data-view="almanac">
                            <span class="sp-tab-glyph" aria-hidden="true"><svg class="sp-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="4" x2="8" y2="20"/><line x1="8" y1="8" x2="15" y2="8"/><line x1="8" y1="12" x2="15" y2="12"/><line x1="8" y1="16" x2="15" y2="16"/></svg></span>
                            <span class="sp-tab-label">轴</span>
                        </button>
                        <button class="sp-side-tab sp-view-btn" data-view="lines">
                            <span class="sp-tab-glyph" aria-hidden="true"><svg class="sp-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="20"/><circle cx="12" cy="4" r="2.2" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r="2.2" fill="currentColor" stroke="none"/></svg></span>
                            <span class="sp-tab-label">线</span>
                        </button>
                        <button class="sp-side-tab sp-view-btn" data-view="outline">
                            <span class="sp-tab-glyph" aria-hidden="true"><svg class="sp-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L16.5 12 L12 21 L7.5 12 Z"/></svg></span>
                            <span class="sp-tab-label">面</span>
                        </button>
                        <button class="sp-side-tab sp-view-btn" data-view="space">
                            <span class="sp-tab-glyph" aria-hidden="true"><svg class="sp-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/></svg></span>
                            <span class="sp-tab-label">间</span>
                        </button>
                        <button class="sp-side-tab sp-view-btn" data-view="theater">
                            <span class="sp-tab-glyph" aria-hidden="true"><svg class="sp-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5 L13 12 L9 19 L5 12 Z"/><path d="M15 5 L19 12 L15 19 L11 12 Z" stroke-dasharray="2.5 2.5"/></svg></span>
                            <span class="sp-tab-label">棱</span>
                        </button>
                        <button class="sp-side-tab sp-view-btn" data-view="anchor">
                            <span class="sp-tab-glyph" aria-hidden="true"><svg class="sp-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 L6 18 L20.5 18"/><circle cx="14" cy="9.4" r="1.9" fill="currentColor" stroke="none"/></svg></span>
                            <span class="sp-tab-label">坐标</span>
                        </button>
                    </nav>
                    <div class="sp-sidebar-spacer"></div>
                    <nav class="sp-sidebar-tabs sp-sidebar-util" aria-label="工具">
                        <button class="sp-side-tab sp-activity-btn" aria-label="最近改动">
                            <span class="sp-tab-glyph" aria-hidden="true">改</span>
                            <span class="sp-activity-badge" hidden></span>
                        </button>
                        <button class="sp-side-tab sp-settings-btn" aria-label="设置">
                            <span class="sp-tab-glyph" aria-hidden="true">⚙</span>
                        </button>
                    </nav>
                </aside>

                <div class="sp-content-col">
                    <header class="sp-content-head">
                        <h1 class="sp-content-title" id="sp-content-title">点</h1>
                        <button class="sp-module-intro-btn" id="sp-module-intro-btn" title="这个模块是干嘛的？" aria-label="模块介绍"><i class="fa-regular fa-circle-question"></i></button>
                        <div class="sp-sub-toggle-wrap" id="sp-sub-toggle-wrap">
                            <div class="sp-sub-toggle" id="sp-sub-toggle">
                                <button class="sp-view-btn sp-sub-btn sp-view-active" data-view="user">我</button>
                                <button class="sp-view-btn sp-sub-btn sp-ta-trigger" data-view="char" id="sp-ta-trigger"><span class="sp-ta-label">TA</span><i class="fa-solid fa-caret-down sp-ta-caret"></i></button>
                            </div>
                            <div class="sp-ta-drawer" id="sp-ta-drawer" style="display:none"></div>
                        </div>
                        <div class="sp-head-tools">
                            <button class="sp-icon-btn sp-theme-toggle-btn" title="${themeToggleTitle()}"><i class="fa-solid ${themeToggleIcon()}"></i></button>
                            <button class="sp-icon-btn sp-fab-toggle-btn${fabEnabled() ? ' sp-btn-active' : ''}" title="悬浮按钮"><i class="fa-regular fa-circle-dot"></i></button>
                            <button class="sp-icon-btn sp-close-btn"    title="关闭"><i class="fa-solid fa-xmark" style="font-size:var(--sp-fs-100)"></i></button>
                        </div>
                        <div class="sp-module-intro-pop" id="sp-module-intro-pop" style="display:none"></div>
                    </header>

                    <div class="sp-panel-tools" id="sp-panel-tools">
                    ${refreshFoldHtml({ selected: ['point', 'lines'], outlineMode: getSettings().outlineRegenMode || 'current' })}
                    ${beatFoldHtml()}
                    </div>

                    ${activityFeature.overlayHtml()}
                    <!-- Settings overlay: covers content-col only, sidebar stays visible -->
                    <div id="sp-settings-overlay" class="sp-settings-overlay" style="display:none">
                        <div class="sp-settings-header">
                            <span class="sp-settings-title"><i class="fa-solid fa-gear"></i> 设置</span>
                            <button class="sp-icon-btn sp-settings-close-btn" title="关闭设置"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div class="sp-settings-body">

                            <!-- ═══════════ 总开关 ═══════════ -->
                            <div class="sp-settings-total-row" id="sp-settings-total">
                                <label class="sp-mode-opt">
                                    <input type="checkbox" id="sp-plugin-enabled" ${getSettings().pluginEnabled !== false ? 'checked' : ''}>
                                    <span>启用构画</span>
                                </label>
                                <label class="sp-mode-opt" id="sp-storyclock-section">
                                    <input type="checkbox" id="sp-storyclock-enabled" ${getSettings().storyClockEnabled !== false ? 'checked' : ''}>
                                    <span>时间戳</span>
                                </label>
                                <p class="sp-cfg-hint">全局时间锚点，包含星期判定。由主楼 AI 随回复输出，构画只读取、解析和展示，不会自行生成；是否出现、格式完整与时间合理取决于模型是否遵循提示词和主楼剧情质量，缺失或不完整时无法凭空补出可靠时间，可能让时间判断失真。</p>
                            </div>

                            <!-- ═══════════ 通用设置 ═══════════ -->
                            <details class="sp-settings-layer">
                                <summary class="sp-settings-layer-title">通用设置</summary>
                                <div class="sp-settings-layer-body">

                            <!-- 全局设置 1：API（默认折叠：首次配置后基本不再动，无需默认展开） -->
                            <details class="sp-settings-section">
                                <summary class="sp-settings-section-title">API</summary>
                                <div class="sp-settings-section-body">
                                    <div class="sp-api-notice ${hasCustomApi ? 'sp-notice-ok' : 'sp-notice-warn'}">
                                        <i class="fa-solid ${hasCustomApi ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                                        ${hasCustomApi
                                            ? '已配置独立 API，后台生成不影响聊天'
                                            : '未配置独立 API：生成期间将<b>占用聊天通道</b>，无法同时聊天'}
                                    </div>
                                    <p class="sp-cfg-hint">留空则使用酒馆当前模型</p>

                                    <!-- API 存储快切：点假框→就地展开内联预设列表（非原生 select 弹窗，避开 WebView 里弹层被插件盖住）；选一项填入下方输入框即生效；＋新增按域名自动命名、🗑删除，均即时落 settings.json -->
                                    <div class="sp-preset-row">
                                        <button type="button" id="sp-preset-box" class="sp-preset-box" title="选择 API 预设">
                                            <span id="sp-preset-label" class="sp-preset-label">选择预设…</span>
                                            <i class="fa-solid fa-chevron-down sp-preset-caret"></i>
                                        </button>
                                        <button id="sp-preset-save" class="sp-fetch-btn" title="把当前这套 API 设置存为新预设"><i class="fa-solid fa-plus"></i></button>
                                        <button id="sp-preset-del" class="sp-fetch-btn" title="删除当前选中的预设"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                    <div id="sp-preset-list" class="sp-preset-list" style="display:none"></div>
                                    <p id="sp-preset-hint" class="sp-cfg-hint sp-preset-hint" style="display:none"></p>
                                    <input id="sp-cfg-url" class="sp-input" type="url"
                                           placeholder="Base URL，如 https://api.openai.com/v1"
                                           value="${escapeAttr(cfg.url || '')}">
                                    <div class="sp-key-row">
                                        <input id="sp-cfg-key" class="sp-input sp-key-input" type="password"
                                               placeholder="API Key" value="${escapeAttr(cfg.key || '')}">
                                        <button id="sp-key-toggle" class="sp-eye-btn"><i class="fa-solid fa-eye"></i></button>
                                    </div>
                                    <div class="sp-model-row">
                                        <input id="sp-cfg-model" class="sp-input sp-model-input" type="text"
                                               placeholder="模型名称，如 gpt-4o-mini"
                                               value="${escapeAttr(cfg.model || '')}">
                                        <button id="sp-fetch-models" class="sp-fetch-btn" title="拉取模型列表">
                                            <i class="fa-solid fa-list"></i>
                                        </button>
                                    </div>
                                    <details id="sp-model-list-section" class="sp-model-list-section" style="display:none">
                                        <summary class="sp-model-list-summary">
                                            <i class="fa-solid fa-chevron-right sp-model-list-chevron"></i>
                                            <span id="sp-model-list-count">已加载 0 个模型</span>
                                        </summary>
                                        <div class="sp-model-list-body">
                                            <input type="text" id="sp-model-list-search" class="sp-input sp-model-list-search" placeholder="搜索模型…" autocomplete="off">
                                            <div id="sp-model-list-items" class="sp-model-list-items"></div>
                                        </div>
                                    </details>

                                    <details class="sp-adv-api" style="margin-top:10px">
                                        <summary class="sp-adv-api-summary">接口高级选项</summary>
                                        <div class="sp-adv-api-body">
                                            <p class="sp-cfg-hint" style="margin-top:8px">
                                                <b>剔除参数</b>：发送前从请求里删掉这些字段，规避接口对某些参数报 400。多个用换行或逗号分隔，只填参数名。
                                            </p>
                                            <textarea id="sp-cfg-exclude" class="sp-input sp-exclude-input" rows="2"
                                                      placeholder="如：frequency_penalty&#10;presence_penalty">${escapeHtml((cfg.excludeParams || []).join('\n'))}</textarea>
                                            <div class="sp-mode-opt" style="margin-top:8px">
                                                <span>请求超时</span>
                                                <input id="sp-cfg-timeout" class="sp-input sp-interval-input" type="number" min="5" max="600" value="${escapeAttr(String(cfg.timeoutSec || 180))}">
                                                <span>秒</span>
                                            </div>
                                            <label class="sp-mode-opt" style="margin-top:6px">
                                                <input type="checkbox" id="sp-cfg-stream" ${cfg.stream ? 'checked' : ''}>
                                                <span>流式传输</span>
                                            </label>
                                        </div>
                                    </details>

                                    <div class="sp-preset-actions" id="sp-preset-actions">
                                        <button id="sp-preset-update" class="sp-save-btn" type="button"></button>
                                        <span id="sp-preset-sync-state" class="sp-cfg-hint" aria-live="polite"></span>
                                    </div>

                                    <hr class="sp-mem-divider">
                                    <label class="sp-cfg-group">机械任务分流</label>
                                    <!-- 机械任务分流：把「记忆摘要 / 大纲推进判定」这类机械调用可选路由到某个预设（如便宜小模型）；生成类始终走上面主 API。选项即时生效落 settings.json，无需点保存。留空=不分流 -->
                                    <div class="sp-util-preset-block">
                                        <p class="sp-cfg-hint">记忆摘要、日期 / 大纲判定这类机械调用改走此预设（如便宜小模型省钱）；正式生成始终走主 API。即时生效，无需保存。</p>
                                        <div class="sp-preset-row">
                                            <button type="button" id="sp-util-preset-box" class="sp-preset-box" title="选择机械任务预设">
                                                <span id="sp-util-preset-label" class="sp-preset-label">跟随主 API（不分流）</span>
                                                <i class="fa-solid fa-chevron-down sp-preset-caret"></i>
                                            </button>
                                        </div>
                                        <div id="sp-util-preset-list" class="sp-preset-list" style="display:none"></div>
                                    </div>
                                </div>
                            </details>

                            <!-- 全局设置 2：世界书 -->
                            <details class="sp-settings-section" id="sp-wi-section">
                                <summary class="sp-settings-section-title">世界书</summary>
                                <div class="sp-settings-section-body" id="sp-wi-body">
                                    <p class="sp-cfg-hint">这里完整显示当前聊天关联来源里的所有条目。条目首次出现时会镜像酒馆开关，之后勾选状态按当前聊天独立保存；实际注入仍须通过酒馆 🔵常驻／🟢关键词等激活规则。构画取消勾选或整本排除只会进一步收窄，不会替酒馆激活条目。</p>
                                    <div id="sp-wi-list" class="sp-wi-list">
                                        <span class="sp-cfg-hint">（打开设置时自动加载）</span>
                                    </div>
                                    <hr class="sp-mem-divider">
                                    <details class="sp-wi-exclude-drawer">
                                        <summary class="sp-wi-exclude-drawer-head">
                                            <span class="sp-wi-exclude-drawer-title">全局排除</span>
                                            <span id="sp-wi-exclude-count" class="sp-wi-exclude-drawer-count"></span>
                                        </summary>
                                        <div class="sp-wi-exclude-drawer-body">
                                            <p class="sp-cfg-hint">勾选的世界书构画<strong>一律不读</strong>——优先级高于上面的挑选，即便某角色卡关联或全局启用了它也照样跳过。适合把「只给主楼 AI 读」的大部头设定书排除在点/线/轴/刻度判定之外。<strong>全局生效，对所有角色卡通用。</strong></p>
                                            <input type="text" id="sp-wi-exclude-search" class="sp-input sp-wi-exclude-search" placeholder="查找世界书名…" autocomplete="off">
                                            <div id="sp-wi-exclude-list" class="sp-wi-exclude-list">
                                                <span class="sp-cfg-hint">（展开时自动加载）</span>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </details>

                            <!-- 全局设置 3：记忆 -->
                            <details class="sp-settings-section" id="sp-mem-section">
                                <summary class="sp-settings-section-title">记忆</summary>
                                <div class="sp-settings-section-body" id="sp-mem-body">
                                    <label class="sp-cfg-group">记忆源</label>
                                    <label class="sp-mode-opt sp-mem-source-toggle">
                                        <input type="checkbox" id="sp-mem-source-bbb">
                                        <span>使用柏宝书作为记忆源</span>
                                    </label>
                                    <div id="sp-mem-bbb-status" class="sp-cfg-hint" style="display:none"></div>

                                    <div id="sp-mem-internal">
                                    <hr class="sp-mem-divider">
                                    <label class="sp-cfg-group">自动记忆</label>
                                    <p class="sp-cfg-hint">对话时逐楼生成客观摘要，供点 / 线 / 面 / 间参考。随聊天存储（不占浏览器缓存），最新一楼不摘要防重 roll。</p>
                                    <label class="sp-mode-opt">
                                        <input type="checkbox" id="sp-mem-enabled">
                                        <span>自动记忆开启</span>
                                    </label>

                                    <div class="sp-mode-opt">
                                        <span>每</span>
                                        <input id="sp-mem-l0" class="sp-input sp-interval-input" type="number" min="1" max="30" value="5">
                                        <span>楼合成一段 L0 摘要</span>
                                    </div>

                                    <div class="sp-mode-opt">
                                        <span>每</span>
                                        <input id="sp-mem-l1" class="sp-input sp-interval-input" type="number" min="2" max="30" value="10">
                                        <span>段 L0 合成一章 L1</span>
                                    </div>

                                    <div class="sp-mode-opt">
                                        <span>跳过短楼（不足</span>
                                        <input id="sp-mem-skipshort" class="sp-input sp-interval-input" type="number" min="0" max="500" value="50">
                                        <span>字的 AI 回复）</span>
                                    </div>

                                    <hr class="sp-mem-divider">

                                    <div id="sp-mem-status" class="sp-mem-status">
                                        <span class="sp-cfg-hint">（打开设置时自动刷新）</span>
                                    </div>

                                    <div id="sp-mem-progress" class="sp-mem-progress" style="display:none">
                                        <div class="sp-mem-progress-label">正在处理: <span id="sp-mem-progress-count">0/0</span></div>
                                        <div class="sp-mem-progress-bar"><div id="sp-mem-progress-fill" class="sp-mem-progress-fill"></div></div>
                                        <button id="sp-mem-progress-abort" class="sp-abort-btn"><i class="fa-solid fa-circle-stop"></i>中止</button>
                                    </div>

                                    <div class="sp-mem-actions">
                                        <button id="sp-mem-check" class="sp-mem-btn">检查完整性</button>
                                        <button id="sp-mem-fill" class="sp-mem-btn">补齐缺失</button>
                                        <button id="sp-mem-rebuild" class="sp-mem-btn sp-mem-btn-danger">推翻重构</button>
                                    </div>
                                    </div>
                                </div>
                            </details>

                            <!-- 显示管理：两个总开关（收藏此楼入口 / 楼内渲染框），渲染框下四个子开关（点·线·轴·标注打捞）。都不注入 AI、不请求 API，纯只读展示。 -->
                            <details class="sp-settings-section" id="sp-display-section">
                                <summary class="sp-settings-section-title">显示与通知管理</summary>
                                <div class="sp-settings-section-body">
                                    <label class="sp-cfg-group">显示</label>
                                    <label class="sp-mode-opt" style="margin-top:10px">
                                        <input type="checkbox" id="sp-adult-blur-enabled" ${getSettings().adultBlurEnabled !== false ? 'checked' : ''}>
                                        <span>默认模糊成人内容</span>
                                    </label>
                                    <label class="sp-mode-opt">
                                        <input type="checkbox" id="sp-anchor-inline-btn" ${getSettings().anchorInlineBtn !== false ? 'checked' : ''}>
                                        <span>收藏此楼入口</span>
                                    </label>

                                    <label class="sp-mode-opt" style="margin-top:10px">
                                        <input type="checkbox" id="sp-inline-render-enabled" ${getSettings().inlineRenderEnabled !== false ? 'checked' : ''}>
                                        <span>楼内渲染框</span>
                                    </label>
                                    <div class="sp-inline-subtoggles">
                                        <span class="sp-subtoggle-label">AI 楼</span>
                                        <label class="sp-mode-opt sp-mode-opt-sub">
                                            <input type="checkbox" id="sp-schedule-inline-enabled" ${getSettings().scheduleInlineEnabled !== false ? 'checked' : ''}>
                                            <span>点</span>
                                        </label>
                                        <label class="sp-mode-opt sp-mode-opt-sub">
                                            <input type="checkbox" id="sp-lines-inline-enabled" ${getSettings().linesInlineEnabled !== false ? 'checked' : ''}>
                                            <span>线</span>
                                        </label>
                                        <label class="sp-mode-opt sp-mode-opt-sub">
                                            <input type="checkbox" id="sp-almanac-inline-enabled" ${getSettings().almanacInlineEnabled !== false ? 'checked' : ''}>
                                            <span>轴</span>
                                        </label>
                                        <label class="sp-mode-opt sp-mode-opt-sub">
                                            <input type="checkbox" id="sp-ledger-inline-enabled" ${getSettings().ledgerInlineEnabled !== false ? 'checked' : ''}>
                                            <span>标注池</span>
                                        </label>
                                        <span class="sp-subtoggle-label" style="margin-top:6px">用户楼</span>
                                        <label class="sp-mode-opt sp-mode-opt-sub">
                                            <input type="checkbox" id="sp-recall-inline-enabled" ${getSettings().recallInlineEnabled !== false ? 'checked' : ''}>
                                            <span>召回</span>
                                        </label>
                                    </div>

                                    <label class="sp-mode-opt" style="margin-top:12px">
                                        <span>最多往上渲染</span>
                                        <input id="sp-inline-render-depth" class="sp-input sp-interval-input" type="number" min="0" value="${escapeAttr(String(Number(getSettings().inlineRenderDepth) || 0))}">
                                        <span>层（0=跟随酒馆助手）</span>
                                    </label>

                                    <label class="sp-mode-opt" style="margin-top:12px">
                                        <span>界面字号</span>
                                        <button type="button" id="sp-uiscale-minus" class="sp-uiscale-btn">−</button>
                                        <span id="sp-uiscale-val" class="sp-uiscale-val">${Math.round((Number(getSettings().uiScale) || 1) * 100)}%</span>
                                        <button type="button" id="sp-uiscale-plus" class="sp-uiscale-btn">＋</button>
                                    </label>
                                    <p class="sp-cfg-hint" style="margin-top:2px">整套面板字号按此百分比缩放，<b>独立于酒馆「字体缩放」</b>。每档 5%，范围 80%–130%，默认 100%。</p>

                                    <hr class="sp-mem-divider sp-settings-display-divider">
                                    <label class="sp-cfg-group">界面字体</label>
                                    <p class="sp-cfg-hint">当前默认字体：有爱圆体</p>
                                    <input id="sp-cfg-font-url" class="sp-input" type="url"
                                           placeholder="字体 CSS URL，如 https://fontsapi.zeoseven.com/xxx/main/result.css"
                                           value="${escapeAttr(getSettings().uiFontUrl ?? '')}">
                                    <div class="sp-mode-opt" style="margin-top:8px; gap:8px">
                                        <button type="button" id="sp-font-apply" class="sp-fetch-btn"><i class="fa-solid fa-check"></i> 应用</button>
                                        <button type="button" id="sp-font-reset" class="sp-fetch-btn" title="恢复成构画自带的默认字体"><i class="fa-solid fa-rotate-left"></i> 恢复默认</button>
                                    </div>

                                    <hr class="sp-mem-divider sp-settings-display-divider">
                                    <label class="sp-cfg-group">通知提醒</label>
                                    <div class="sp-mode-row">
                                        <label class="sp-mode-opt">
                                            <input type="radio" name="sp-notify-mode" value="off" ${(getSettings().notifyMode || 'lite') === 'off' ? 'checked' : ''}>
                                            <span>关（全部静音）</span>
                                        </label>
                                        <label class="sp-mode-opt">
                                            <input type="radio" name="sp-notify-mode" value="lite" ${(getSettings().notifyMode || 'lite') === 'lite' ? 'checked' : ''}>
                                            <span>简约（仅手动生成 / 刷新时提示）</span>
                                        </label>
                                        <label class="sp-mode-opt">
                                            <input type="radio" name="sp-notify-mode" value="full" ${(getSettings().notifyMode || 'lite') === 'full' ? 'checked' : ''}>
                                            <span>全量（另在后台自动改动点 / 线 / 面 / 轴时提示）</span>
                                        </label>
                                    </div>
                                </div>
                            </details>

                            <!-- 通用：提示词与标签（所有用户可编辑文本集中于此） -->
                            <details class="sp-settings-section" id="sp-prompts-section">
                                <summary class="sp-settings-section-title">提示词与标签</summary>
                                <div class="sp-settings-section-body">
                                    <details class="sp-settings-subsection sp-prompt-global"><summary>创作链自定义提示词 / 写作规范</summary>
                                        <p class="sp-cfg-hint"><strong>已内置一版创作强化提示词</strong>（不显示）。此处内容<strong>只追加到构画的创作链</strong>，例如点 / 线 / 面 / 间 / 棱写作，适合放去八股、文风和叙事口吻等规范。日期判断、刻度、记忆压缩和排版等机械任务不使用它；全部链路仍自带如实处理虚构敏感内容的基础许可。支持 <code>{{char}}</code> / <code>{{user}}</code> 占位符。</p>
                                        <textarea id="sp-custom-prompt" class="sp-input sp-theater-cfg-textarea" placeholder="可留空（创作链只用内置强化词）。也可追加创作规范，如：去八股、控制文风、叙事口吻…"></textarea>
                                    </details>
                                    <details class="sp-settings-subsection sp-prompt-tags"><summary>标签清洗</summary>
                                        <p class="sp-cfg-hint">读取 AI 楼层原文时的标签过滤规则，<strong>对全部生成链路生效</strong>（记忆摘要、点 / 线 / 面生成、间 / 面讨论的对话注入），用来剔除状态栏 / 思维链等包裹、避免污染上下文。多个用英文逗号分隔；XML 包裹可写标签名或带尖括号（<code>content</code> / <code>&lt;content&gt;</code> 等效），双中括号包裹请固定填写 <code>[[...]]</code>（三个点是配置占位）。可组合填写 <code>content,[[...]]</code>，并支持中文、日文等 Unicode 标签名。</p>
                                        <div class="sp-mode-opt sp-tag-opt"><span>保留包裹符</span><input id="sp-mem-keeptags" class="sp-input sp-tag-input" type="text" placeholder="content" value=""></div>
                                        <p class="sp-cfg-hint">标签本身去掉、<strong>内部文字保留</strong>（如正文被 <code>content</code> 包裹）。</p>
                                        <div class="sp-mode-opt sp-tag-opt"><span>剔除包裹符</span><input id="sp-mem-extratags" class="sp-input sp-tag-input" type="text" placeholder="think,reasoning" value=""></div>
                                        <p class="sp-cfg-hint">包裹符<strong>连同内部内容一起删除</strong>（如 <code>think,reasoning,[[...]]</code>）；未闭合的双中括号会保留原文，不会吞掉后文。</p>
                                    </details>
                                    <details class="sp-settings-subsection sp-prompt-storyclock"><summary>时间戳提示词</summary>
                                        <p class="sp-cfg-hint" id="sp-storyclock-coordination">${storyClockStatusCopy(storyClockController.refresh())}</p>
                                        <p class="sp-cfg-hint"><strong>全部内容均可编辑</strong>；留空＝用内置完整默认（默认词随插件更新走）。删除 SDC 标签或机器合同可能导致时间戳无法识别，风险由你承担。务必让两端各带 date、weekday、time；旧无星期标记仍兼容读取，但不会从现实年份补星期。</p>
                                        <textarea id="sp-storyclock-prompt" class="sp-input sp-theater-cfg-textarea" placeholder="留空＝用内置完整默认强制词。"></textarea>
                                        <div style="display:flex; gap:8px; margin-top:6px"><button id="sp-storyclock-prompt-load" class="sp-mem-btn" type="button">载入默认再改</button><button id="sp-storyclock-prompt-reset" class="sp-mem-btn" type="button">恢复默认</button></div>
                                    </details>
                                    <details id="sp-space-section" class="sp-settings-subsection sp-prompt-space"><summary>间 · 人格 / 说话风格</summary>
                                        <p class="sp-cfg-hint">间 = 跳出扮演、和 AI 聊剧情/设定/关系的「局外」空间。这里可给它换一套<strong>说话语气与人格</strong>。</p>
                                        <label class="sp-cfg-label">间的人格 / 说话风格</label>
                                        <textarea id="sp-space-persona" class="sp-input sp-theater-cfg-textarea" placeholder="留空＝内置默认（柔和客观、含蓄内敛的中性顾问）。填了就换成你写的人格，如：深耕 ACG、熟知网络用语、爱用半个括号吐槽的重度宅女…"></textarea>
                                        <p class="sp-cfg-hint">只换<strong>语气 / 行文 / 人格色彩</strong>；「间仍是创作顾问、不推进剧情、不扮演故事角色」这条内核<strong>恒定保留</strong>（写得再放飞它也不会跑去演戏）。<b>只作用于「间」</b>，不影响面·和间聊聊。支持 <code>{{char}}</code> / <code>{{user}}</code>。</p>
                                    </details>
                                    <details id="sp-theater-section" class="sp-settings-subsection sp-prompt-theater-write"><summary>棱 · 写作与抽取世界书</summary>
                                        <p class="sp-cfg-hint">棱固定输出纯文字番外，不再做 HTML 美化。一次 1～3 条，每条约 ${THEATER_TARGET_CHARS} 字。抽取用世界书也可以在棱页顶部勾选。挂载的书只给棱抽签读，不要绑到角色卡。</p>
                                        <label class="sp-mode-opt"><span>一次数量</span><input id="sp-theater-count" class="sp-input sp-interval-input" type="number" min="1" max="3" value="${escapeAttr(String(getSettings().theaterCount || THEATER_COUNT_DEFAULT))}"><span>条（上限 3）</span></label>
                                        <label class="sp-cfg-label">写作提示词（文风 + 范文）</label>
                                        <textarea id="sp-theater-style" class="sp-input sp-theater-cfg-textarea" placeholder="指定文体基调、节奏、感官描写要求，禁套路化开头结尾；也可直接贴 1-2 段你认可的文笔让 AI 模仿其笔触…"></textarea>
                                        <label class="sp-cfg-label">抽取用世界书（多选）</label>
                                        <p class="sp-cfg-hint">把小回 / 极光 / 小兔等导入酒馆后在此勾选。棱会剥除 HTML、交互和主楼插入指令。导出喜欢的条目会写成「${THEATER_EXPORT_BOOK}」。</p>
                                        <input id="sp-theater-pool-search" class="sp-input sp-wi-exclude-search" type="search" placeholder="查找世界书…">
                                        <div id="sp-theater-pool-list" class="sp-wi-exclude-list"></div>
                                    </details>
                                </div>
                            </details>

                                </div>
                            </details>

                            <!-- ═══════════ 塞给主楼 AI ═══════════ -->
                            <details class="sp-settings-layer" id="sp-settings-content">
                                <summary class="sp-settings-layer-title">塞给主楼 AI</summary>
                                <div class="sp-settings-layer-body">
                                    <div class="sp-settings-section sp-settings-section-static" id="sp-inject-master-section">
                                        <div class="sp-settings-section-title">总闸</div>
                                        <div class="sp-settings-section-body">
                                            <label class="sp-mode-opt">
                                                <input type="checkbox" id="sp-inject-enabled" ${getSettings().injectEnabled !== false ? 'checked' : ''}>
                                                <span>允许把线 / 面 / 刻度悄悄塞给主楼 AI</span>
                                            </label>
                                            <p class="sp-cfg-hint">这会改模型怎么写下一楼，和面板里自己点的刷新、本轮拍、间引导不是一回事。总闸是允许注入；线 / 面 / 刻度还要各自勾上，那个模块才会真正塞进去。只开总闸、下面不勾＝什么都不注入。</p>
                                        </div>
                                    </div>

                                    <details class="sp-settings-section" id="sp-module-injection-section">
                                        <summary class="sp-settings-section-title">模块注入</summary>
                                        <div class="sp-settings-section-body">
                                            <div class="sp-settings-subsection-static"><div class="sp-settings-subsection-title">线 · 潜伏注入</div>
                                                <label class="sp-mode-opt"><input type="checkbox" id="sp-lines-inject" ${getSettings().linesInject === true ? 'checked' : ''}><span>把平行事件塞给主楼</span></label>
                                                <p class="sp-cfg-hint">聊天里看不见。主楼会暗暗记得还在发展的线。会改写法、略增 token，默认关。</p>
                                            </div>
                                            <div class="sp-settings-subsection-static"><div class="sp-settings-subsection-title">面 · 大纲注入</div>
                                                <label class="sp-mode-opt"><input type="checkbox" id="sp-outline-inject" ${getSettings().outlineInject === true ? 'checked' : ''}><span>把当前面节点塞给主楼</span></label>
                                                <p class="sp-cfg-hint">只告诉主楼「现在演到哪、下一步往哪」，聊天里看不见。要自动往下指，去「跟剧情走」开面判定。默认关。</p>
                                            </div>
                                            <div class="sp-settings-subsection-static"><div class="sp-settings-subsection-title">刻度 · 潜伏注入</div>
                                                <label class="sp-mode-opt"><input type="checkbox" id="sp-ledger-inject" ${getSettings().ledgerInject === true ? 'checked' : ''}><span>把刻度账塞给主楼</span></label>
                                                <p class="sp-cfg-hint">挑几条此刻最相关的伤情 / 约定 / 周期给主楼记住，聊天里看不见。默认关。开后楼内会多一个只读框，方便核对塞进去了哪几条。</p>
                                            </div>
                                        </div>
                                    </details>

                                    <details class="sp-settings-section" id="sp-content-switches-section">
                                        <summary class="sp-settings-section-title">功能与内容开关</summary>
                                        <div class="sp-settings-section-body">
                                            <label class="sp-mode-opt"><input type="checkbox" id="sp-lines-enabled" ${getSettings().linesEnabled !== false ? 'checked' : ''}><span>线</span></label>
                                            <label class="sp-mode-opt"><input type="checkbox" id="sp-dashed-enabled" ${getSettings().dashedEnabled === true ? 'checked' : ''}><span>冷知识（默认关；开了也不跟线推进绑在一起）</span></label>
                                            <div class="sp-mode-opt sp-mode-opt-sub sp-dashed-keep-row">
                                                <input type="checkbox" id="sp-dashed-cleanup-enabled" ${getSettings().dashedCleanupEnabled !== false ? 'checked' : ''}>
                                                <label for="sp-dashed-cleanup-enabled">冷知识保存数量</label>
                                                <input id="sp-dashed-keep-count" class="sp-input sp-interval-input" type="number" min="2" step="1" value="${escapeAttr(String(linesFeature.dashed.normalizeKeepCount(getSettings().dashedKeepCount)))}" ${getSettings().dashedCleanupEnabled !== false ? '' : 'disabled'} aria-label="保留最近多少条未锁冷知识">
                                            </div>
                                            <p class="sp-cfg-hint">冷知识抽间隔、刻度总开关在「跟剧情走」。</p>
                                        </div>
                                    </details>

                                    <details class="sp-settings-section" id="sp-adult-scale-section">
                                        <summary class="sp-settings-section-title">成人内容与叙事尺度</summary>
                                        <div class="sp-settings-section-body">
                                            <p class="sp-cfg-group" id="sp-scale-hint">叙事尺度（按角色保存）</p>
                                            <div class="sp-mode-row" id="sp-scale-row"><!-- populated when settings opens --></div>
                                            <hr class="sp-mem-divider">
                                            <p class="sp-cfg-group">成人剧情模式（按角色保存）</p>
                                            <div class="sp-mode-row" id="sp-adult-row"><!-- populated when settings opens --></div>
                                        </div>
                                    </details>
                                </div>
                            </details>

                            <!-- ═══════════ 跟剧情走 ═══════════ -->
                            <details class="sp-settings-layer" id="sp-settings-pace">
                                <summary class="sp-settings-layer-title">跟剧情走</summary>
                                <div class="sp-settings-layer-body">
                                    <details class="sp-settings-section" id="sp-axis-section">
                                        <summary class="sp-settings-section-title">日期与对齐</summary>
                                        <div class="sp-settings-section-body">
                                            <div id="sp-pace-settings" class="sp-pace-settings">${paceStripHtml(collectPaceRows(readPaceSnapshot()), { id: 'sp-pace-settings-strip' })}</div>
                                            <label class="sp-mode-opt"><input type="checkbox" id="sp-almanac-autodetect" ${getSettings().almanacAutoDetect !== false ? 'checked' : ''}><span>读不到时间戳时，用 API 补看今天是几号</span></label>
                                            <label class="sp-mode-opt"><span>每</span><input id="sp-almanac-judge-interval" class="sp-input sp-interval-input" type="number" min="1" value="${escapeAttr(String(getAlmanacJudgeInterval()))}"><span>条 AI 回复补看一次</span><span class="sp-pace-remain" data-pace-remain="date"></span></label>
                                            <p class="sp-cfg-hint">有完整时间戳时每楼直接读、不调 API。只有漏打戳、或只写了「谷雨」这种没月日的，才隔几楼问一次。关掉＝只认戳。倒数只在真的去补看时往前走。</p>
                                            <hr class="sp-mem-divider">
                                            <label class="sp-mode-opt"><input type="checkbox" id="sp-ledger-reconcile" ${getSettings().ledgerReconcileEnabled === true ? 'checked' : ''}><span>点/线按楼对齐正文</span></label>
                                            <label class="sp-mode-opt"><span>每</span><input id="sp-ledger-reconcile-interval" class="sp-input sp-interval-input" type="number" min="1" value="${escapeAttr(String(getLedgerReconcileInterval()))}"><span>条 AI 回复对齐一次</span><span class="sp-pace-remain" data-pace-remain="align"></span></label>
                                            <p class="sp-cfg-hint">默认关。每隔几楼用最新正文改走偏的点和线（完成/推迟/改描述，线也可以收束或暂缓），不整表重做。冷知识和面不自动改。成功记在「最近改动」，失败才弹窗。时旅那一层两边都不跑。</p>
                                        </div>
                                    </details>
                                    <details class="sp-settings-section" id="sp-pace-lines-section">
                                        <summary class="sp-settings-section-title">线</summary>
                                        <div class="sp-settings-section-body">
                                            <p class="sp-cfg-group">线怎么往前走 <span class="sp-pace-remain" data-pace-remain="advance"></span></p>
                                            <div class="sp-mode-row">
                                                <label class="sp-mode-opt"><input type="radio" name="sp-lines-mode" value="days" ${getLinesMode() === 'days' ? 'checked' : ''}><span>故事日期变了就推进（推荐）</span></label>
                                                <label class="sp-mode-opt"><input type="radio" name="sp-lines-mode" value="turns" ${getLinesMode() === 'turns' ? 'checked' : ''}><span>按楼数，每</span><input id="sp-lines-interval" class="sp-input sp-interval-input" type="number" min="1" value="${escapeAttr(String(getLinesInterval()))}"><span>条 AI 回复推进一次</span></label>
                                                <label class="sp-mode-opt"><input type="radio" name="sp-lines-mode" value="manual" ${getLinesMode() === 'manual' ? 'checked' : ''}><span>只在我点「推进」时走</span></label>
                                            </div>
                                            <label class="sp-mode-opt"><input type="checkbox" id="sp-lines-advance-latest" ${getSettings().linesAdvanceIncludeLatest !== false ? 'checked' : ''}><span>手动推进时带上本楼正文</span></label>
                                            <p class="sp-cfg-hint">推进只让还成立的未锁线往前演化，不管对错。走偏了靠上面的「按楼对齐」。对齐和推进撞上同一楼时，本楼先对齐，推进下一楼补。按楼推进不推荐和对齐叠用。</p>
                                        </div>
                                    </details>
                                    <details class="sp-settings-section" id="sp-outline-section">
                                        <summary class="sp-settings-section-title">面</summary>
                                        <div class="sp-settings-section-body">
                                            <label class="sp-mode-opt"><input type="checkbox" id="sp-outline-judge" ${getSettings().outlineJudgeEnabled === true ? 'checked' : ''}><span>自动判断故事演到面的哪一段</span></label>
                                            <label class="sp-cfg-group">判定节奏</label>
                                            <label class="sp-mode-opt"><span>每</span><input id="sp-outline-judge-interval" class="sp-input sp-interval-input" type="number" min="1" value="${escapeAttr(String(outlineFeature.judge.getInterval()))}"><span>条 AI 回复看一次</span><span class="sp-pace-remain" data-pace-remain="outline"></span></label>
                                            <p class="sp-cfg-hint">只把「现在演到哪」往后指一格，不重写整份面，也不塞给主楼。楼数越大越省。新装默认关。</p>
                                        </div>
                                    </details>
                                    <details class="sp-settings-section" id="sp-pace-dashed-section">
                                        <summary class="sp-settings-section-title">冷知识</summary>
                                        <div class="sp-settings-section-body">
                                            <label class="sp-mode-opt"><span>每</span><input id="sp-dashed-interval" class="sp-input sp-interval-input" type="number" min="1" value="${escapeAttr(String(Math.max(1, Number(getSettings().dashedAutoInterval) || 6)))}"><span>条 AI 楼最多抽一次，和点/线对齐错开</span><span class="sp-pace-remain" data-pace-remain="dashed"></span></label>
                                            <p class="sp-cfg-hint">总开关和保存数量还在「功能与内容开关」。这里只管抽的间隔。关着时倒数会显示关着。</p>
                                        </div>
                                    </details>
                                    <details class="sp-settings-section" id="sp-pace-ledger-section">
                                        <summary class="sp-settings-section-title">刻度</summary>
                                        <div class="sp-settings-section-body">
                                            <label class="sp-mode-opt"><input type="checkbox" id="sp-ledger-capture-enabled" ${getSettings().ledgerCaptureEnabled === true ? 'checked' : ''}><span>刻度</span></label>
                                            <label class="sp-mode-opt"><span>每</span><input id="sp-ledger-capture-interval" class="sp-input sp-interval-input" type="number" min="1" max="30" value="${escapeAttr(String(Math.max(1, Math.min(30, Number(getSettings().ledgerCaptureInterval) || 5))))}"><span>条 AI 回复标注一次</span><span class="sp-pace-remain" data-pace-remain="ledger-capture"></span></label>
                                            <label class="sp-mode-opt"><span>每</span><input id="sp-ledger-judge-interval" class="sp-input sp-interval-input" type="number" min="1" max="30" value="${escapeAttr(String(Math.max(1, Math.min(30, Number(getSettings().ledgerJudgeInterval) || 4))))}"><span>条 AI 回复更新一次现状</span><span class="sp-pace-remain" data-pace-remain="ledger-judge"></span></label>
                                            <p class="sp-cfg-hint">总开关在这里。关着时两项节奏都不跑。</p>
                                        </div>
                                    </details>
                                </div>
                            </details>

                            <details class="sp-settings-layer" id="sp-settings-manual">
                                <summary class="sp-settings-layer-title">我自己点</summary>
                                <div class="sp-settings-layer-body">
                                    <p class="sp-cfg-hint">刷新账本、本轮拍、间引导都在面板里，不用再开总开关。后台改账成功记在侧栏「改」，失败才弹窗。离自动对齐、推进还差几楼，写在「改」页顶上。</p>
                                </div>
                            </details>

                            <!-- ═══════════ 数据设置 ═══════════ -->
                            <details class="sp-settings-layer" id="sp-settings-data">
                                <summary class="sp-settings-layer-title">数据设置</summary>
                                <div class="sp-settings-layer-body">
                                    <details class="sp-settings-section" id="sp-theater-template-section">
                                        <summary class="sp-settings-section-title">小剧场模板库</summary>
                                        <div class="sp-settings-section-body">
                                            <p class="sp-cfg-hint">存于专用世界书 <code>构画-棱-小剧场模板</code>，全局共享、不进聊天文件、绝不注入 AI。棱输入区可点选模板起草；缓存用量与清理见“存储管理”。</p>
                                            <div id="sp-theater-tpl-mgr" class="sp-theater-tpl-mgr"><div class="sp-theater-list-empty">（打开设置时自动加载）</div></div>
                                        </div>
                                    </details>
                                    <details class="sp-settings-section" id="sp-storage-section">
                                        <summary class="sp-settings-section-title">存储管理</summary>
                                        <div class="sp-settings-section-body">
                                            <p class="sp-cfg-hint">统管构画的数据占用，按存储位置分层。</p>
                                            <div class="sp-storage-mode-card">
                                                <div class="sp-storage-group-head">当前聊天的数据存储</div>
                                                <div id="sp-storage-mode-status" class="sp-cfg-hint">检测中…</div>
                                                <div class="sp-mem-actions">
                                                    <button id="sp-storage-migrate" class="sp-save-btn" type="button" hidden>迁出到白鳥数据后端</button>
                                                    <button id="sp-storage-retry" class="sp-mem-btn" type="button" hidden>重试加载</button>
                                                </div>
                                            </div>
                                            <div class="sp-storage-mode-card">
                                                <div class="sp-storage-group-head">导出 / 导入</div>
                                                <p class="sp-cfg-hint">卸掉本体再装自己这份时，用迁移包把构画数据带走。点/线/面本来就在聊天文件里，卸插件通常不会丢；这份包另外打包设置（含 API）、本机草稿、坐标收藏、构画世界书，并备份能读到的聊天账本。不含聊天正文。包里可能有 API Key，不要发给别人。</p>
                                                <div class="sp-mem-actions">
                                                    <button id="sp-backup-export" class="sp-save-btn" type="button"><i class="fa-solid fa-file-export"></i> 导出迁移包</button>
                                                    <button id="sp-backup-import" class="sp-mem-btn" type="button"><i class="fa-solid fa-file-import"></i> 导入迁移包</button>
                                                    <input id="sp-backup-import-file" type="file" accept="application/json,.json" hidden>
                                                </div>
                                            </div>
                                            <div id="sp-storage-body"><div class="sp-cfg-hint">（打开设置时自动统计…）</div></div>
                                            <div class="sp-mem-actions"><button id="sp-storage-refresh" class="sp-mem-btn">刷新用量</button></div>
                                        </div>
                                    </details>
                                    <details class="sp-settings-section" id="sp-diagnostics-section">
                                        <summary class="sp-settings-section-title">诊断管理</summary>
                                        <div class="sp-settings-section-body">
                                            <div class="sp-diagnostics-block">
                                                <label class="sp-cfg-group">AI 输入</label>
                                                <p class="sp-cfg-hint"><strong>仅供本人排查。</strong>这里是最近一次实际发给 AI 的完整输入，可能包含最近聊天、上下文、世界书和提示词等敏感内容，不建议公开分享。</p>
                                                <details class="sp-diagnostics-preview sp-diagnostics-preview-empty" id="sp-diagnostics-ai-input-preview">
                                                    <summary class="sp-diagnostics-preview-title">查看最近 AI 输入</summary>
                                                    <pre class="sp-diagnostics-pre" id="sp-diagnostics-ai-input-pre" aria-live="polite">（尚未发送请求）</pre>
                                                    <div class="sp-diagnostics-actions" id="sp-diagnostics-ai-input-actions" hidden>
                                                        <button class="sp-diagnostics-copy-btn" id="sp-diagnostics-ai-input-copy" type="button" disabled><i class="fa-regular fa-copy"></i> 复制 AI 输入</button>
                                                    </div>
                                                </details>
                                            </div>
                                            <hr class="sp-mem-divider">
                                            <div class="sp-diagnostics-block">
                                                <label class="sp-cfg-group">请求诊断</label>
                                                <p class="sp-cfg-hint"><strong>适合发给开发者。</strong>复制最近 30 条安全诊断日志；不含正文、提示词、API Key 或 URL。</p>
                                                <button id="sp-diagnostic-export" class="sp-save-btn" type="button"><i class="fa-regular fa-copy"></i> 复制最近诊断日志</button>
                                            </div>
                                            <div class="sp-diagnostics-block">
                                                <div class="sp-diagnostics-label">当前聊天诊断包</div>
                                                <p class="sp-cfg-hint">包含两楼 AI 输入与原始回复，可能含剧情。它不是完整可导入备份，也不会包含 API 密钥、地址或请求头。</p>
                                                <button id="sp-current-diagnostic-export" class="sp-save-btn" type="button"><i class="fa-solid fa-file-export"></i> 导出当前聊天诊断包</button>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </details>

                        </div><!-- /sp-settings-body -->
                        <div class="sp-settings-footer">
                            <button id="sp-cfg-save" class="sp-save-btn"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
                            <span id="sp-cfg-msg" class="sp-cfg-msg"></span>
                        </div>
                    </div><!-- /sp-settings-overlay -->

                    <div class="sp-main">
                        <div class="sp-body" id="sp-body">
                            <div class="sp-empty"><i class="fa-regular fa-calendar"></i><p>还没有点</p><button class="sp-gen-btn" id="sp-gen-schedule-now">生成点</button></div>
                        </div>

                        <div class="sp-outline-wrap" id="sp-outline-wrap" style="display:none">
                            <div class="sp-schedule-header sp-outline-header">
                                <span class="sp-outline-title">故事面</span>
                                <span class="sp-schedule-label" id="sp-outline-node-count">0 个节点</span>
                                <button class="sp-panel-refresh sp-refresh-outline" title="重新生成面" aria-label="重新生成面"><i class="fa-solid fa-rotate-right"></i></button>
                            </div>
                            <div class="sp-outline-beats" id="sp-outline-beats">
                                <div class="sp-empty"><i class="fa-solid fa-scroll"></i><p>当前还没有面，可以先直接聊天讨论，也可以生成一版面作为起点</p><button class="sp-gen-btn sp-outline-gen-btn" id="sp-gen-outline-now">生成面</button></div>
                            </div>
                            <div class="sp-outline-divider" id="sp-outline-divider">
                                <i class="fa-solid fa-grip-lines"></i>
                            </div>
                            <div class="sp-outline-chat" id="sp-outline-chat">
                                <div class="sp-chat-msgs" id="sp-chat-msgs"></div>
                                <div class="sp-chat-input-row">
                                    <button id="sp-chat-clear" class="sp-icon-btn" title="清空对话"><i class="fa-solid fa-broom"></i></button>
                                    <textarea id="sp-chat-input" class="sp-input sp-chat-input-ta" rows="1" placeholder="和 AI 讨论面…"></textarea>
                                    <button id="sp-chat-send" class="sp-icon-btn" title="发送"><i class="fa-solid fa-paper-plane"></i></button>
                                </div>
                            </div>
                        </div>

                        <div class="sp-lines-wrap" id="sp-lines-wrap" style="display:none">
                            <div class="sp-lines-toolbar" id="sp-lines-toolbar"></div>
                            <div class="sp-lines-list" id="sp-lines-list">
                                <div class="sp-empty"><i class="fa-solid fa-diagram-project"></i><p>还没有追踪的线，可以生成一版</p><button class="sp-gen-btn" id="sp-gen-lines-now">生成线</button></div>
                            </div>
                        </div>

                        <div class="sp-space-wrap sp-outline-chat" id="sp-space-wrap" style="display:none;flex-direction:column;flex:1;min-height:0">
                            <div class="sp-chat-msgs" id="sp-space-msgs"></div>
                            <div class="sp-space-composer">
                                <div id="sp-space-quote" class="sp-space-quote" hidden></div>
                                <div class="sp-chat-input-row">
                                    <button id="sp-space-guide" class="sp-icon-btn" title="引导设计"><i class="fa-solid fa-compass"></i></button>
                                    <button id="sp-space-clear" class="sp-icon-btn" title="清空对话"><i class="fa-solid fa-broom"></i></button>
                                    <textarea id="sp-space-input" class="sp-input sp-chat-input-ta" rows="1" placeholder="局外聊聊：剧情、设定、关系、知识…"></textarea>
                                    <button id="sp-space-send" class="sp-icon-btn" title="发送"><i class="fa-solid fa-paper-plane"></i></button>
                                </div>
                            </div>
                        </div>

                        <div class="sp-theater-wrap" id="sp-theater-wrap" style="display:none;flex-direction:column;flex:1;min-height:0">
                            <div class="sp-theater-body" id="sp-theater-body"></div>
                        </div>

                        <div class="sp-anchor-wrap" id="sp-anchor-wrap" style="display:none;flex-direction:column;flex:1;min-height:0">
                            <div class="sp-anchor-body" id="sp-anchor-body"></div>
                        </div>

                        <div class="sp-almanac-wrap" id="sp-almanac-wrap" style="display:none;flex-direction:column;flex:1;min-height:0"></div>
                    </div><!-- /sp-main -->

                </div><!-- /sp-content-col -->

                <div class="sp-resize-handle" id="sp-resize-handle">
                    <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
                </div>
            </div>`;
}
