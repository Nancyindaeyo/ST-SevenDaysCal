import { BOOTSTRAP_LABELS, nextBootstrapIndex, planBootstrapSteps } from './queue.js';
import { bootstrapProgressHtml } from './ui.js';

export function createBootstrapFeature(env = {}) {
    let busy = false;
    let token = 0;
    let steps = [];
    let index = 0;
    let failed = false;
    let error = '';
    let ownerChatId = null;

    const chatId = () => env.chatId?.() ?? null;
    const paint = () => {
        const html = bootstrapProgressHtml({ steps, index, failed, error });
        env.setProgress?.(html);
    };
    const done = () => {
        busy = false;
        env.onDone?.();
    };
    const runStep = async (id, generation) => {
        const runner = env.runners?.[id];
        if (typeof runner !== 'function') return { status: 'skipped' };
        const result = await runner({ bootstrap: true, generation });
        if (generation !== token || chatId() !== ownerChatId) return { status: 'cancelled' };
        return result && typeof result === 'object' ? result : { status: result ? 'updated' : 'failed' };
    };

    async function continueFrom(start, generation) {
        ownerChatId = chatId();
        for (let i = start; i < steps.length; i++) {
            if (generation !== token) return { status: 'cancelled' };
            index = i;
            failed = false;
            error = '';
            paint();
            const result = await runStep(steps[i], generation);
            if (generation !== token) return { status: 'cancelled' };
            if (result?.status === 'cancelled') {
                done();
                return result;
            }
            if (result?.status === 'failed') {
                failed = true;
                error = String(result.errorMessage || result.error?.message || '生成失败');
                paint();
                env.toast?.(`${BOOTSTRAP_LABELS[steps[i]] || '这一项'}生成失败：${error}`, true);
                return result;
            }
        }
        index = steps.length;
        env.toast?.('账本已生成');
        done();
        return { status: 'updated' };
    }

    async function start() {
        if (busy) return { status: 'skipped', reason: 'busy' };
        steps = planBootstrapSteps(env.flags?.() || {});
        if (!steps.length) return { status: 'skipped', reason: 'not-empty' };
        busy = true;
        failed = false;
        error = '';
        index = 0;
        token += 1;
        const generation = token;
        paint();
        return continueFrom(0, generation);
    }

    async function retry() {
        if (!busy || !failed) return { status: 'skipped' };
        token += 1;
        const generation = token;
        failed = false;
        error = '';
        paint();
        return continueFrom(index, generation);
    }

    async function skip() {
        if (!busy || !failed) return { status: 'skipped' };
        token += 1;
        const generation = token;
        failed = false;
        error = '';
        const next = nextBootstrapIndex(steps, index + 1);
        if (next < 0) {
            done();
            return { status: 'updated' };
        }
        return continueFrom(next, generation);
    }

    function abort() {
        if (!busy) return false;
        token += 1;
        env.abortRunners?.();
        done();
        env.toast?.('已中止生成账本');
        return true;
    }

    return {
        start, retry, skip, abort,
        get busy() { return busy; },
        state: () => ({ busy, steps, index, failed, error }),
        progressHtml: () => bootstrapProgressHtml({ steps, index, failed, error }),
    };
}
