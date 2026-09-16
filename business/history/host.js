import { openModuleHistory } from './dialog.js';
import { axisAdapter, itemsAdapter, ledgerAdapter, rawAdapter } from './versions.js';

export function sameHistorySnapshot(left, right) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function previewRaw(payload) {
    return String(payload || '').trim() || '此版本没有内容';
}
function summaryRaw(payload) {
    return String(payload || '').trim() ? '有内容' : '空';
}
function previewDashed(payload) {
    const items = Array.isArray(payload) ? payload : [];
    return items.length ? items.map((item, index) => `${index + 1}. ${item?.text || ''}`).join('\n') : '此版本没有冷知识';
}
function previewAxis(payload) {
    const cal = payload?.caldesc;
    const calLine = cal?.era || cal?.id ? `历法：${cal.era || cal.id}` : '历法：默认';
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const list = items.length ? items.map(item => `• ${item?.name || ''} ${item?.month || ''}/${item?.day || ''}`).join('\n') : '没有节日条目';
    return `${calLine}\n${list}`;
}
function previewLedger(payload) {
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    return entries.length ? entries.map(entry => `• ${entry?.事由 || entry?.id || ''}（${entry?.状态 || ''}）`).join('\n') : '此版本没有刻度条目';
}

// 账本历史恢复：按 kind 组装 read/write/afterRestore。对话框算法仍在 dialog.js。
export function createHistoryHost(env = {}) {
    const openHistory = env.openHistory || openModuleHistory;
    const toast = env.toast;
    const read = key => env.readStore?.(key) || {};

    function open(kind) {
        const chatId = env.getContext?.()?.chatId;
        if (!chatId) {
            toast?.('请先打开一个聊天', null, true);
            return Promise.resolve(false);
        }
        const stillHere = () => env.getContext?.()?.chatId === chatId;
        const shared = {
            dialog: env.dialog,
            toast: (message, error) => toast?.(message, null, error),
            chatId,
        };
        const bindStore = (key, extra = {}) => {
            const current = extra.readStore || (() => read(key));
            return {
                ...shared,
                title: extra.title,
                restoreNote: extra.restoreNote,
                adapter: extra.adapter,
                preview: extra.preview,
                summary: extra.summary,
                afterRestore: extra.afterRestore,
                readStore: current,
                isCurrent: extra.isCurrent || (baseline => stillHere() && sameHistorySnapshot(current(), baseline)),
                writeStore: extra.writeStore || (value => env.writeStoreConfirmed?.(key, value, { ownerGuard: stillHere })),
            };
        };

        if (kind === 'point') {
            const key = env.pointKey?.();
            if (!key) { toast?.('当前没有可恢复的点', null, true); return Promise.resolve(false); }
            return openHistory(bindStore(key, {
                title: '点 · 历史版本',
                adapter: rawAdapter,
                preview: previewRaw,
                summary: summaryRaw,
                afterRestore: env.afterRestore?.point,
            }));
        }
        if (kind === 'lines') {
            return openHistory(bindStore(env.linesKey?.(), {
                title: '线 · 历史版本',
                adapter: rawAdapter,
                preview: previewRaw,
                summary: summaryRaw,
                afterRestore: env.afterRestore?.lines,
            }));
        }
        if (kind === 'dashed') {
            return openHistory(bindStore(env.dashedKey?.(), {
                title: '冷知识 · 历史版本',
                adapter: itemsAdapter,
                preview: previewDashed,
                summary: payload => `${Array.isArray(payload) ? payload.length : 0} 条`,
                afterRestore: env.afterRestore?.dashed,
            }));
        }
        if (kind === 'outline') {
            return openHistory(bindStore(env.outlineKey?.(), {
                title: '面 · 历史版本',
                adapter: rawAdapter,
                preview: previewRaw,
                summary: summaryRaw,
                afterRestore: env.afterRestore?.outline,
            }));
        }
        if (kind === 'axis') {
            return openHistory(bindStore(env.almanacKey?.(), {
                title: '轴 · 历史版本',
                restoreNote: '会恢复节日表和历法描述，不会改「今天」的日期锚点。',
                adapter: axisAdapter,
                preview: previewAxis,
                summary: payload => `${Array.isArray(payload?.items) ? payload.items.length : 0} 条`,
                readStore: () => env.readAxis?.(),
                isCurrent: baseline => stillHere() && sameHistorySnapshot(env.readAxis?.(), baseline),
                writeStore: async value => {
                    const saved = await env.writeStoreConfirmed?.(env.almanacKey?.(), value, { ownerGuard: stillHere });
                    if (!(saved === true || saved?.ok === true) || saved?.stale) return saved;
                    if (value?.caldesc) env.saveCalDesc?.(value.caldesc, { archive: false });
                    return saved;
                },
                afterRestore: env.afterRestore?.axis,
            }));
        }
        if (kind === 'ledger') {
            return openHistory({
                ...shared,
                title: '刻度 · 历史版本',
                confirmRestore: true,
                confirmTitle: '确认恢复刻度历史版本',
                confirmBody: '会整表回到这一版，之后标注进去的条目也会一起消失。确定恢复？',
                readStore: () => env.snapshotLedger?.(),
                isCurrent: baseline => stillHere() && sameHistorySnapshot(env.snapshotLedger?.(), baseline),
                writeStore: value => env.replaceLedger?.(value, { guard: stillHere }),
                adapter: ledgerAdapter,
                preview: previewLedger,
                summary: payload => `${Array.isArray(payload?.entries) ? payload.entries.length : 0} 条`,
                afterRestore: env.afterRestore?.ledger,
            });
        }
        return Promise.resolve(false);
    }

    return { open };
}
