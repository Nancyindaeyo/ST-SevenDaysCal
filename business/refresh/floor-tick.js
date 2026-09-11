export function tickFloorGate({ lastFloor = -1, counter = 0, messageId, interval = 1, blocked = false, sameFloor = false } = {}) {
    const mid = Number(messageId);
    if (!Number.isInteger(mid) || mid <= lastFloor) {
        return { status: 'skipped', reason: 'seen', lastFloor, counter };
    }
    if (sameFloor) {
        return { status: 'skipped', reason: 'seen', lastFloor: mid, counter };
    }
    if (blocked) {
        return { status: 'skipped', reason: 'blocked', lastFloor: mid, counter };
    }
    const step = Math.max(1, Math.floor(Number(interval) || 1));
    const next = counter + 1;
    if (next < step) {
        return { status: 'skipped', reason: 'interval', lastFloor: mid, counter: next };
    }
    return { status: 'due', lastFloor: mid, counter: 0 };
}

export function createFloorTicker() {
    let lastFloor = -1;
    let counter = 0;
    return {
        state: () => ({ lastFloor, counter }),
        reset({ lastFloor: floor = -1 } = {}) {
            lastFloor = Number.isInteger(Number(floor)) ? Number(floor) : -1;
            counter = 0;
        },
        resetCounter() { counter = 0; },
        hydrate(state = {}) {
            lastFloor = Number.isInteger(Number(state.lastFloor)) ? Number(state.lastFloor) : -1;
            counter = Math.max(0, Math.floor(Number(state.counter) || 0));
        },
        tick(messageId, { interval = 1, blocked = false, sameFloor = false } = {}) {
            const result = tickFloorGate({ lastFloor, counter, messageId, interval, blocked, sameFloor });
            lastFloor = result.lastFloor;
            counter = result.counter;
            return result;
        },
    };
}
