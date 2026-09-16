export function timeTravelAbortError(message) {
    return Object.assign(new Error(message), { name: 'AbortError' });
}

export function sameDateRenderKey(left, right) {
    return !!left && !!right
        && left.chatId === right.chatId
        && left.messageId === right.messageId
        && left.swipeId === right.swipeId
        && left.contentSignature === right.contentSignature;
}

// 时旅目的日：有戳用戳、关自动检测用所选日、否则复用/补跑判定。不要塞进日期宿主。
export function createTimeTravelDestinationResolver(env = {}) {
    async function applyAnchor(date, key) {
        const applied = env.applyDetectedDate?.(env.charKey?.(), date, { notify: false });
        if (applied?.status === 'failed') throw new Error('日期锚点保存失败');
        env.recordResult?.(key, { ...applied, date });
        return date;
    }

    async function resolve({ chatId, messageId, selectedTargetDate, signal } = {}) {
        const cal = env.calendar?.();
        const target = env.validMonthDay?.(selectedTargetDate, cal);
        if (!target) throw new Error('无法读取时光旅行选择的目标日期');
        if (chatId !== env.getChatId?.() || signal?.aborted) throw timeTravelAbortError('时光旅行会话已失效');
        const chat = env.getChat?.() || [];
        const floor = chat[Number(messageId)];
        const clock = env.parseClock?.(floor?.mes || '') || {};
        const clockDate = env.parseJudgedDate?.(clock.end) || env.parseJudgedDate?.(clock.start);
        const key = env.renderKey?.(messageId);
        if (clockDate) return applyAnchor(clockDate, key);
        if (env.autoDetect?.() === false) return applyAnchor(target, key);
        const result = await env.ensureResolved?.(key, {
            signal,
            // 时旅是普通日期监听的下游消费者：同一版正文只要已有一次判定终态，
            // 无论有日期、未知或失败，都直接复用；只有完全没有记录时才补跑一次。
            // 这是调用方窄策略，不改变 coordinator 其他调用方默认的“只接受有日期结果”。
            acceptPrevious: previous => previous != null && typeof previous === 'object',
            resolve: ({ signal: coordinatorSignal }) => env.runJudge?.({ messageId, signal: coordinatorSignal }),
        });
        if (signal?.aborted || result?.status === 'cancelled') throw timeTravelAbortError('日期确认已取消');
        const judged = env.validMonthDay?.(result?.date, cal);
        if (judged) return judged;
        if (!sameDateRenderKey(env.renderKey?.(messageId), key) || chatId !== env.getChatId?.() || signal?.aborted) {
            throw timeTravelAbortError('正文版本已变化');
        }
        await applyAnchor(target, key);
        env.toast?.('未能从正文确认日期，已采用你选择的时旅目标日');
        return target;
    }

    return { resolve };
}
