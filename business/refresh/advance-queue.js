export function createAdvanceQueue(env = {}) {
    let busy = false;
    let pendingDate = null;

    async function run(options = {}) {
        if (busy) {
            if (options.trigger === 'date') pendingDate = options;
            return { status: 'skipped', reason: 'busy' };
        }
        const steps = env.plan?.(options) || [];
        if (!steps.length) return { status: 'skipped', reason: 'empty' };
        busy = true;
        const results = [];
        try {
            for (const step of steps) {
                if (step === 'shift') {
                    const shifted = env.shift?.(options);
                    results.push({ step, status: shifted === false ? 'unchanged' : 'updated' });
                    continue;
                }
                if (step === 'fill') {
                    results.push({ step, ...(await env.fill?.(options) || { status: 'skipped' }) });
                    continue;
                }
                if (step === 'lines') {
                    results.push({ step, ...(await env.lines?.(options) || { status: 'skipped' }) });
                }
            }
            return { status: 'updated', results };
        } finally {
            busy = false;
            if (pendingDate) {
                const next = pendingDate;
                pendingDate = null;
                void run(next);
            }
        }
    }

    return {
        run,
        get busy() { return busy; },
    };
}
