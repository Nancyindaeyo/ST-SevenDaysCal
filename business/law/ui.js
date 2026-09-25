function escapeAttr(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function recoveryHtml(items, currentChatId) {
    return (items || []).map(item => {
        const same = item.chatId === currentChatId;
        return `<div class="sp-author-recovery-item" data-chat="${escapeAttr(item.chatId)}">`
            + `<p class="sp-author-recovery-copy">未保存，可恢复${same ? '' : '（请先回到原聊天再写回）'}</p>`
            + `<div class="sp-author-recovery-actions">`
            + `<button type="button" class="sp-author-recovery-btn" data-act="original" data-chat="${escapeAttr(item.chatId)}"${same ? '' : ' disabled'}>写回原聊天</button>`
            + `<button type="button" class="sp-author-recovery-btn" data-act="current" data-chat="${escapeAttr(item.chatId)}">写入当前聊天</button>`
            + `<button type="button" class="sp-author-recovery-btn" data-act="discard" data-chat="${escapeAttr(item.chatId)}">丢弃</button>`
            + `</div></div>`;
    }).join('');
}

export function createLawUi({ $in } = {}) {
    const input = () => $in?.('#sp-law-input');
    const box = () => $in?.('#sp-law-inject');
    const recovery = () => $in?.('#sp-law-recovery');
    return Object.freeze({
        bind({ onInput, onBlur, onInject, onRestoreOriginal, onRestoreCurrent, onDiscard } = {}) {
            input()?.on?.('input.spLaw', function () { onInput?.(this.value); });
            input()?.on?.('blur.spLaw', function () { onBlur?.(this.value); });
            box()?.on?.('change.spLaw', function () { onInject?.(this.checked === true); });
            recovery()?.on?.('click.spLawRecovery', 'button[data-act]', function () {
                const chatId = this.getAttribute('data-chat') || '';
                const act = this.getAttribute('data-act');
                if (act === 'original') onRestoreOriginal?.(chatId);
                else if (act === 'current') onRestoreCurrent?.(chatId);
                else if (act === 'discard') onDiscard?.(chatId);
            });
        },
        paint(text, inject, { force = false } = {}) {
            const $field = input();
            if ($field?.length) {
                const el = $field[0];
                const next = String(text ?? '');
                const active = typeof document !== 'undefined' ? document.activeElement : null;
                if (force || !(el && active === el)) $field.val(next);
            }
            const $box = box();
            if ($box?.length) $box.prop?.('checked', inject === true);
        },
        paintRecovery(items, { currentChatId = '' } = {}) {
            const $box = recovery();
            if (!$box?.length) return;
            if (!items?.length) {
                $box.attr?.('hidden', true);
                $box.empty?.();
                return;
            }
            $box.removeAttr?.('hidden');
            $box.html?.(recoveryHtml(items, currentChatId));
        },
        value() {
            return String(input()?.val?.() ?? '');
        },
        inject() {
            return box()?.prop?.('checked') === true;
        },
    });
}

export function enterLawSidebar({ resetModes, show, feature } = {}) {
    resetModes?.();
    show?.();
    feature?.open?.();
}
