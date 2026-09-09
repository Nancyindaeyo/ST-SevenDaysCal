export function createStaggerGate() {
    let pendingAdvance = false;
    let pendingDashed = false;

    const reset = () => {
        pendingAdvance = false;
        pendingDashed = false;
    };

    const plan = ({ reconcileDue = false, advanceDue = false, dashedDue = false, timeTravel = false } = {}) => {
        if (timeTravel) {
            return { run: null, pendingAdvance, pendingDashed };
        }
        const queue = [];
        if (reconcileDue) queue.push('reconcile');
        if (advanceDue || pendingAdvance) queue.push('advance');
        if (dashedDue || pendingDashed) queue.push('dashed');
        const run = queue[0] || null;
        pendingAdvance = queue.slice(1).includes('advance');
        pendingDashed = queue.slice(1).includes('dashed');
        return { run, pendingAdvance, pendingDashed };
    };

    return {
        plan,
        reset,
        deferAdvance: () => { pendingAdvance = true; },
        consumeAdvance: () => {
            if (!pendingAdvance) return false;
            pendingAdvance = false;
            return true;
        },
        hydrate({ pendingAdvance: nextAdvance = false, pendingDashed: nextDashed = false } = {}) {
            pendingAdvance = nextAdvance === true;
            pendingDashed = nextDashed === true;
        },
        hasPendingAdvance: () => pendingAdvance,
        get pendingAdvance() { return pendingAdvance; },
        get pendingDashed() { return pendingDashed; },
    };
}

export function shouldDeferAdvance({ reconcileRan, wouldAdvance, pending = false } = {}) {
    if (reconcileRan && (wouldAdvance || pending)) return { advance: false, pending: true };
    if (pending && !reconcileRan) return { advance: true, pending: false };
    return { advance: wouldAdvance === true, pending: false };
}
