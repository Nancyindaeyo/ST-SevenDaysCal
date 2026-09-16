import { baiBaiBookCoverage, readBaiBaiBookHistory, usesBaiBaiBook } from './baibaoshu.js';

export function builtinMemoryHasPending(report = {}) {
    return !!(report.pending > 0 || report.permaFailed > 0 || report.strippedEmpty > 0 || report.paused);
}

export function formatBuiltinMemoryHealthLines(report = {}) {
    const lines = [];
    if (report.paused) lines.push('• 记忆系统已暂停（连续失败或单楼超过 3 次）');
    if (report.pending > 0) lines.push(`• 有 ${report.pending} 楼待摘要`);
    if (report.permaFailed > 0) lines.push(`• 有 ${report.permaFailed} 楼摘要永久失败（需手动补齐）`);
    if (report.strippedEmpty > 0) lines.push(`• 有 ${report.strippedEmpty} 组净化后正文几乎为空（请重查「保留标签」设置）`);
    if (report.busy) lines.push('• 记忆系统正在后台生成');
    return lines;
}

// 生成前记忆闸 / 记忆原文。覆盖检查仍走 baibaoshu.js，不要再做第二套。
export function createMemoryInjectHost(env = {}) {
    const usesBook = settings => (env.usesBaiBaiBook || usesBaiBaiBook)(settings);
    const coverageOf = api => (env.baiBaiBookCoverage || baiBaiBookCoverage)(api);
    const readHistory = (api, opts) => (env.readBaiBaiBookHistory || readBaiBaiBookHistory)(api, opts);

    async function precheck() {
        if (usesBook(env.settings?.() || {})) {
            const coverage = coverageOf(env.getApi?.());
            if (!coverage.ready) {
                return env.confirm?.({
                    title: '柏宝书未就绪',
                    body: '当前选的是柏宝书记忆源，但检测不到柏宝书 API。\n继续生成会没有历史记忆注入。',
                    note: '请把柏宝书更新到最新版（旧版没有读取接口），或临时关掉本插件的"使用柏宝书作为记忆源"。',
                    confirmText: '仍然继续',
                    cancelText: '取消',
                });
            }
            if (coverage.complete === false) {
                return env.confirm?.({
                    title: '柏宝书记忆未覆盖完整',
                    body: `柏宝书报告缺 ${coverage.missing} 楼摘要（missingAiFloors）。`,
                    note: '继续生成会使用当前柏宝书的历史（可能不完整）。你也可以先去柏宝书补齐。',
                    confirmText: '继续生成',
                    cancelText: '取消',
                });
            }
            return true;
        }
        const report = env.healthReport?.() || {};
        if (!builtinMemoryHasPending(report)) return true;
        return env.confirm?.({
            title: '记忆库不完整',
            body: formatBuiltinMemoryHealthLines(report).join('\n'),
            note: '继续生成会使用当前记忆库（可能不完整）。你也可以先去修复。',
            confirmText: '继续生成',
            cancelText: '取消',
        });
    }

    async function getTextRaw(opts = {}) {
        if (usesBook(env.settings?.() || {})) {
            const api = env.getApi?.();
            if (!api || typeof api.getInjectedHistory !== 'function') {
                env.warnMissingApi?.();
                return '';
            }
            try {
                // opts.full：通读全故事的分析任务（如「历」编排全年纪念日）要完整时间线——
                // 用 getHistory（柏宝书「全部压缩历史」，含滑动窗口楼层）；而非 getInjectedHistory
                // （后者是按当前剧情向量召回、跳过滑动窗口的注入版，会漏掉与"此刻"无关的旧里程碑）。
                // 点/线/面贴当前剧情，保持 getInjectedHistory（聚焦近景、省额度）。
                return readHistory(api, { full: !!opts.full });
            } catch (err) {
                env.warnReadError?.(err);
                return '';
            }
        }
        return env.builtinContext?.();
    }

    return { precheck, getTextRaw };
}
