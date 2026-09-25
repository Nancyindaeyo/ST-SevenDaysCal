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

export function createSlipUi({ $in } = {}) {
    const input = () => $in?.('#sp-slip-input');
    const recovery = () => $in?.('#sp-slip-recovery');
    return Object.freeze({
        bind({ onInput, onBlur, onRestoreOriginal, onRestoreCurrent, onDiscard } = {}) {
            const $field = input();
            $field?.on?.('input.spSlip', function () { onInput?.(this.value); });
            $field?.on?.('blur.spSlip', function () { onBlur?.(this.value); });
            recovery()?.on?.('click.spSlipRecovery', 'button[data-act]', function () {
                const chatId = this.getAttribute('data-chat') || '';
                const act = this.getAttribute('data-act');
                if (act === 'original') onRestoreOriginal?.(chatId);
                else if (act === 'current') onRestoreCurrent?.(chatId);
                else if (act === 'discard') onDiscard?.(chatId);
            });
        },
        paint(text, { force = false } = {}) {
            const $field = input();
            if (!$field?.length) return;
            const el = $field[0];
            const next = String(text ?? '');
            const active = typeof document !== 'undefined' ? document.activeElement : null;
            if (!force && el && active === el) return;
            $field.val(next);
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
        focus() {
            input()?.trigger?.('focus');
        },
    });
}

export function enterSlipSidebar({ resetModes, show, feature } = {}) {
    resetModes?.();
    show?.();
    feature?.open?.();
}
