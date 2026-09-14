import { formatGeneratedAt, historyEntries, historyCount, restoreHistoryVersion } from './versions.js';

export function historyButtonHtml({ disabled = true, title = '暂无可恢复的历史版本', extraClass = '', module = '' } = {}) {
    const moduleAttr = module ? ` data-history="${escapeAttr(module)}"` : '';
    return `<button type="button" class="sp-panel-refresh sp-book-history${extraClass ? ` ${extraClass}` : ''}" title="${escapeAttr(title)}" aria-label="查看历史版本"${moduleAttr}${disabled ? ' disabled' : ''}><i class="fa-solid fa-clock-rotate-left"></i></button>`;
}

function escapeAttr(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function historyToolbarState({ hasChat, busy, store, adapter, emptyHint = '暂无历史版本。内容更新且变化后，会自动保留上一版。' } = {}) {
    const count = historyCount(store || {}, adapter);
    return {
        historyDisabled: !hasChat || !!busy,
        historyTitle: !hasChat ? '当前没有聊天' : busy ? '正在处理中，暂不能查看历史' : count ? `查看 ${count} 个历史版本` : '暂无可恢复的历史版本',
        historyCount: count,
        emptyHint,
    };
}

export async function openModuleHistory({
    title,
    dialog,
    toast,
    chatId,
    isCurrent,
    readStore,
    writeStore,
    adapter,
    preview,
    summary,
    restoreNote = '',
    confirmRestore = false,
    confirmTitle = '',
    confirmBody = '',
    afterRestore,
} = {}) {
    const baseline = readStore?.() || {};
    const choices = historyEntries(baseline, adapter).map(entry => ({
        ...entry,
        label: `${formatGeneratedAt(entry.generatedAt)} · ${entry.current ? '当前' : '旧版'}${summary ? ` · ${summary(entry.payload)}` : ''}`,
        preview: preview ? preview(entry.payload) : String(entry.payload ?? ''),
    }));
    const archived = choices.filter(entry => !entry.current);
    if (!archived.length) {
        toast?.('暂无历史版本。内容更新且变化后，会自动保留上一版。');
        return false;
    }
    for (;;) {
        if (isCurrent && !isCurrent(baseline)) { toast?.('内容已变化，请重新打开历史版本', true); return false; }
        const selectedValue = await dialog?.selectOneAsync?.({
            title,
            body: '按现实生成时间从新到旧排列。',
            loadChoices: async () => choices.map(({ value, label }) => ({ value, label })),
            confirmText: '预览', cancelText: '关闭', emptyText: '暂无可恢复的历史版本',
        });
        if (!selectedValue) return false;
        const selected = choices.find(choice => choice.value === selectedValue);
        if (!selected) return false;
        if (isCurrent && !isCurrent(baseline)) { toast?.('内容已变化，请重新打开历史版本', true); return false; }
        const decision = await dialog?.choose?.({
            title: `${selected.current ? '当前版本' : '历史版本'} · ${formatGeneratedAt(selected.generatedAt)}`,
            body: selected.preview || '此版本没有内容',
            note: restoreNote || (selected.current ? '' : '恢复后会成为当前内容；现在这份会留在历史里，可以再选回来。'),
            scrollable: true,
            choices: selected.current
                ? [{ value: 'back', label: '返回列表' }, { value: 'close', label: '关闭', primary: true }]
                : [{ value: 'back', label: '返回列表' }, { value: 'restore', label: '恢复此版', primary: true }],
        });
        if (decision === 'back') continue;
        if (decision !== 'restore' || selected.current) return false;
        if (confirmRestore) {
            const ok = await dialog?.confirm?.({
                title: confirmTitle || '确认恢复刻度历史版本',
                body: confirmBody || '会整表回到这一版，之后标注进去的条目也会一起消失。确定恢复？',
                confirmText: '确认恢复',
                cancelText: '取消',
            });
            if (!ok) continue;
        }
        if (isCurrent && !isCurrent(baseline)) { toast?.('内容已变化，请重新打开历史版本', true); return false; }
        const restored = restoreHistoryVersion(baseline, selected.historyIndex, adapter);
        if (!restored.ok) { toast?.('这个历史版本已不可用，请重新打开', true); return false; }
        const saved = await writeStore?.(restored.value);
        if (!(saved === true || saved?.ok === true) || saved?.stale) {
            toast?.('历史版本保存失败，当前内容没有改变', true);
            return false;
        }
        afterRestore?.(restored.value);
        toast?.('已恢复历史版本');
        return true;
    }
}
