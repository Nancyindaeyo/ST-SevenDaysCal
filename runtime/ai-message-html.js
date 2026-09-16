export const AI_BUBBLE_REGEX_GUARD = 'regex';

// 构画气泡没有真实楼层，messageId 只能传 null。ST 会把它当成最远深度的楼，
// 「显示域 + 按深度过滤」的用户正则会命中并清空气泡。调用期间临时把 'regex'
// 塞进 disabledExtensions，getRegexedString 开头即短路；markdown / 引号包裹 /
// 净化照跑。同步调用、finally 还原，不落盘、不触发保存。
export function runWithRegexExtensionDisabled(disabledExtensions, fn) {
    const list = Array.isArray(disabledExtensions) ? disabledExtensions : null;
    const guard = !!(list && !list.includes(AI_BUBBLE_REGEX_GUARD));
    if (guard) list.push(AI_BUBBLE_REGEX_GUARD);
    try {
        return fn();
    } finally {
        if (guard) {
            const i = list.indexOf(AI_BUBBLE_REGEX_GUARD);
            if (i !== -1) list.splice(i, 1);
        }
    }
}

export function formatAiMessageHtml(text, env = {}) {
    const ctx = env.getContext?.();
    if (typeof ctx?.messageFormatting === 'function') {
        try {
            return runWithRegexExtensionDisabled(
                env.disabledExtensions?.(),
                () => ctx.messageFormatting(String(text ?? ''), '', false, false, null, {}, false),
            );
        } catch (err) {
            env.logWarn?.(err);
        }
    }
    return env.escapeHtml(String(text ?? '')).replace(/\n/g, '<br>');
}
