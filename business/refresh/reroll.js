export function createFloorAutomationRerunner(env = {}) {
    let lastKey = '';

    const run = async messageId => {
        const mid = Number(messageId);
        if (!Number.isInteger(mid) || mid !== Number(env.latestFloor?.())) return { status: 'skipped', reason: 'not-latest' };
        const key = `${env.chatId?.() || ''}:${mid}:${env.floorSignature?.(mid) || ''}`;
        if (key === lastKey) return { status: 'skipped', reason: 'duplicate' };
        lastKey = key;
        const plans = (env.plans?.(mid) || []).filter(Boolean);
        if (!plans.length) return { status: 'skipped', reason: 'nothing-due' };

        const blocked = new Set();
        for (const plan of [...plans].reverse()) {
            const restored = await plan.restore?.();
            if (restored?.status !== 'diverged' && restored?.status !== 'failed') continue;
            blocked.add(plan.source);
            env.toast?.(`${plan.label || plan.source}在这楼之后又被改过，无法安全撤回；本项没有自动重跑。`, true);
        }
        for (const plan of plans) {
            if (!blocked.has(plan.source)) await plan.run?.();
        }
        env.remember?.();
        return { status: 'updated', rerun: plans.filter(plan => !blocked.has(plan.source)).map(plan => plan.source), blocked: [...blocked] };
    };

    return {
        run,
        reset: () => { lastKey = ''; },
    };
}
