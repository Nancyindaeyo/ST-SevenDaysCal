// 面板宿主：打开壳（markup / shadow / chrome）和我/TA 视角。
// feature 的 bindX 仍留在装配根 injectModal；真正画点/线/面仍走既有 feature。

function charPickerHtml({ guessed, recents, escapeAttr, escapeHtml }) {
    const chipsHtml = recents.length
        ? `<div class="sp-char-recent">
               <span class="sp-char-recent-label">最近：</span>
               ${recents.map(n => `<button type="button" class="sp-char-recent-chip" data-name="${escapeAttr(n)}">${escapeHtml(n)}</button>`).join('')}
           </div>`
        : '';
    return `<div class="sp-char-picker">
        <p class="sp-char-picker-hint"><i class="fa-solid fa-user-pen"></i> 输入要查看点的角色名</p>
        <div class="sp-char-picker-row">
            <input id="sp-char-name-input" class="sp-input" type="text"
                   placeholder="角色 / NPC / 反派皆可" value="${escapeAttr(guessed)}">
            <button id="sp-char-name-confirm" class="sp-save-btn">确认</button>
        </div>
        ${chipsHtml}
        <p class="sp-char-picker-sub">${guessed ? '根据近期对话预填，可直接修改。' : ''}不必是主角，任何出场人物、NPC、反派都能查看其点；查看不占固定槽，想常驻再去 📌 固定</p>
    </div>`;
}

export function createPanelHost(env = {}) {
    const $in = (...args) => env.$in?.(...args);
    const $inAll = (...args) => env.$inAll?.(...args);
    const $ = env.$;
    const scheduleFocus = env.scheduleFocus || ((fn, ms) => setTimeout(fn, ms));

    function onRegenClick() {
        if (env.outlineMode?.()) {
            void env.rerollOutline?.();
            return;
        }
        if (env.syncingPoint?.()) {
            env.toast?.('点正在同步到今天，稍候再刷新', null, true);
            return;
        }
        if (env.pointGenerating?.()) return;
        // 刷新 = 对当前视角原地重排，永不弹填写框。换人走 TA▾ 抽屉。
        env.triggerGenerate?.();
    }

    function setView(view, charName) {
        env.setCurrentView?.(view);
        // 切到 char 更新名字；切回 user **不清**——否则再切回 char 只能退回填名（老 bug）。
        // user 视角泄漏无虞：store.scopeOf 用 view==='char' && charName 双重门。
        if (view === 'char' && charName) env.setCharViewName?.(charName);
        env.markViewButtons?.(view);
        env.loadCachedSchedule?.();
    }

    function confirmCharView() {
        const name = String($in('#sp-char-name-input').val() || '').trim();
        if (!name) { $in('#sp-char-name-input').focus(); return; }
        env.pushRecentCharName?.(name);
        setView('char', name);
        env.updateTaTriggerLabel?.();
        if (env.hasCachedSchedule?.()) env.setBody?.(env.cachedScheduleHtml?.());
        else env.triggerGenerate?.();
    }

    function switchToCharView() {
        env.setCurrentView?.('char');
        const guessed = env.getCharViewName?.() || env.guessCharName?.(env.getContext?.()) || '';
        const recents = (env.readRecentCharNames?.() || []).filter(n => n !== guessed);
        env.setBody?.(charPickerHtml({
            guessed,
            recents,
            escapeAttr: env.escapeAttr || (s => String(s ?? '')),
            escapeHtml: env.escapeHtml || (s => String(s ?? '')),
        }));
        env.markViewButtons?.('char');
        $in('#sp-char-name-input').off('keydown.charview').on('keydown.charview', e => { if (e.key === 'Enter') confirmCharView(); });
        $in('#sp-char-name-confirm').off('click.charview').on('click.charview', confirmCharView);
        $inAll('.sp-char-recent-chip').off('click.charview').on('click.charview', function () {
            $in('#sp-char-name-input').val($(this).attr('data-name')).focus();
        });
        scheduleFocus(() => { $in('#sp-char-name-input').focus().select(); }, 50);
    }

    function activateCharView(name) {
        const n = String(name || '').trim();
        if (!n) return;
        if (env.pointGenerating?.()) { env.toast?.('点正在生成，稍候再换人', null, true); return; }
        env.closeTaDrawer?.();
        setView('char', n);
        env.updateTaTriggerLabel?.();
        if (env.hasCachedSchedule?.()) env.setBody?.(env.cachedScheduleHtml?.());
        else env.showEmptyGenerate?.();
    }

    function refreshCharPinIcon() {
        const $btn = $in('#sp-body .sp-point-pin-char');
        const pinned = !!env.isPinnedChar?.(String($btn.attr('data-name') || env.getCharViewName?.() || '').trim());
        $btn.attr('title', pinned ? '已固定·点击取消固定' : '固定 TA 到 TA▾ 抽屉');
        $btn.toggleClass('sp-pinned', pinned);
    }

    function onCharPinToggle(name) {
        const n = String(name || env.getCharViewName?.() || '').trim();
        if (!n) return;
        if (env.isPinnedChar?.(n)) {
            env.removePinnedChar?.(n);
            env.toast?.(`已取消固定「${n}」`);
        } else {
            const r = env.addPinnedChar?.(n);
            if (r === 'full') {
                env.toast?.(`固定槽已满（最多 ${env.pinCap?.() ?? 0} 个），先在 TA▾ 里移除一个`, null, true);
                return;
            }
            env.toast?.(`已固定「${n}」到 TA▾`);
        }
        // 钉态活在 store，须用当前 raw 重渲 cachedSchedule；没有 raw 至少就地刷图标。
        if (!env.reloadPinnedSchedule?.()) refreshCharPinIcon();
        if (env.taDrawerOpen?.()) env.openTaDrawer?.();
    }

    // markup / shadow / chrome；键盘边界见 hosts.js。feature bind 仍由装配根接着做。
    function mount() {
        env.clearShadows?.();
        const built = env.buildMarkup?.() || {};
        const html = typeof built === 'string' ? built : built.html;
        const cfg = typeof built === 'string' ? undefined : built.cfg;
        const mounted = env.mountHosts?.(html);
        env.setShadows?.(mounted);
        env.afterMount?.(cfg);
        env.bindShell?.();
    }

    return {
        mount,
        onRegenClick,
        setView,
        switchToCharView,
        confirmCharView,
        activateCharView,
        onCharPinToggle,
        refreshCharPinIcon,
    };
}
