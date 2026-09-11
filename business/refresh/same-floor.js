export function isSameFloorGeneration(genType) {
    return genType === 'regenerate' || genType === 'swipe';
}

export function createSameFloorGate() {
    let pending = false;
    return {
        mark(genType) {
            if (isSameFloorGeneration(genType)) pending = true;
        },
        pending() { return pending; },
        consume() {
            const value = pending;
            pending = false;
            return value;
        },
        clear() { pending = false; },
    };
}
