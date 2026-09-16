import { PLUGIN_VERSION } from '../version.js';
import { buildSafeDiagnosticPack, dayKey, mergeAssistantDiagnosticPackage } from './diagnostic-pack.js';

export function storyClockDayValue(clock) {
    return (clock?.endMeta?.valid ? clock.endMeta.date || clock.endMeta : null)
        || (clock?.startMeta?.valid ? clock.startMeta.date || clock.startMeta : null);
}

export function downloadDiagnosticPackage(data, {
    filename,
    now = Date.now(),
    documentRef = globalThis.document,
    createObjectURL = url => URL.createObjectURL(url),
    revokeObjectURL = url => URL.revokeObjectURL(url),
    setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
} = {}) {
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = createObjectURL(blob);
    const anchor = documentRef.createElement('a');
    anchor.href = url;
    anchor.download = filename || `gouhua-diagnostic-${now}.json`;
    anchor.style.display = 'none';
    documentRef.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeoutFn(() => revokeObjectURL(url), 1000);
    return text;
}

// 安全诊断包 / 给助手的诊断包：收集运行时上下文并导出。不进 payload 预览。
export function createDiagnosticPackHost(env = {}) {
    const pluginVersion = () => env.pluginVersion || PLUGIN_VERSION;

    function collect(userNote = '') {
        const ctx = env.getContext?.() || {};
        const chat = ctx.chat || [];
        const clock = env.latestStoryClock?.();
        const today = env.todayAnchor?.();
        return buildSafeDiagnosticPack({
            pluginVersion: pluginVersion(),
            settings: env.settings?.() || {},
            chat: {
                floorCount: chat.length,
                latestAiFloor: env.latestAiFloor?.(chat)?.index,
                stampDay: dayKey(storyClockDayValue(clock)),
                axisToday: dayKey(today),
                sameFloor: env.sameFloorPending?.() === true,
                linesMode: env.linesMode?.(),
            },
            queue: env.queueSnapshot?.() || null,
            activity: env.compactActivity?.(8) || [],
            safeLogs: env.readTrace?.() || [],
            userNote,
        });
    }

    async function askUserNote() {
        try {
            const note = await env.promptTextarea?.({
                title: '给助手的一句话（可空）',
                body: '你点了什么、期望什么、实际怎样。会写进诊断包，不含 Key。',
                initialValue: '',
                maxLength: 400,
                rows: 3,
                confirmText: '继续',
                cancelText: '跳过',
            });
            return String(note || '').trim();
        } catch {
            return '';
        }
    }

    async function exportSafe() {
        try {
            const text = JSON.stringify(collect(), null, 2);
            const copied = await env.copyText?.(text);
            if (copied) {
                env.toast?.('安全诊断包已复制（无剧情）');
                return { status: 'copied' };
            }
            await env.promptTextarea?.({
                title: '复制安全诊断包',
                body: '自动复制失败，请长按文本复制。这份没有正文和提示词。',
                initialValue: text,
                maxLength: Math.max(1, text.length),
                rows: 12,
                confirmText: '关闭',
                cancelText: '取消',
            });
            return { status: 'manual-copy' };
        } catch (error) {
            env.toast?.(`安全诊断包导出失败：${error?.message || '未知错误'}`, null, true);
            return { status: 'failed', error };
        }
    }

    async function exportAssistant() {
        const choice = await env.choose?.({
            title: '导出给助手',
            body: '给改构画的人看：含本聊天账本、最近两楼各模块最新一次完整输入和原始回复、【改】卡片头、本楼队列。默认不附聊天正文。不含 API Key、地址或请求头。',
            note: '有剧情和模型原文，不要公开发。这不是可再导入的备份。',
            choices: [
                { value: 'cancel', label: '取消' },
                { value: 'safe', label: '导出给助手（不附正文）', primary: true },
                { value: 'narrative', label: '导出并附最近楼正文' },
            ],
        });
        if (!choice || choice === 'cancel') return { status: 'cancelled' };
        const userNote = await askUserNote();
        try {
            const base = await env.buildCurrentChat?.({ includeNarrative: choice === 'narrative', safeTrace: env.readTrace?.() || [] });
            const runtime = collect(userNote);
            const data = mergeAssistantDiagnosticPackage(base, {
                pluginVersion: pluginVersion(),
                userNote,
                runtime,
            });
            const text = (env.downloadJson || downloadDiagnosticPackage)(data);
            env.toast?.('给助手的诊断包已导出', async () => {
                if (await env.copyText?.(text)) env.toast?.('诊断包已复制');
            });
            return { status: 'exported' };
        } catch (error) {
            env.toast?.(`诊断包导出失败：${error?.message || '未知错误'}`, null, true);
            return { status: 'failed', error };
        }
    }

    return {
        collect,
        exportSafe,
        exportAssistant,
    };
}
