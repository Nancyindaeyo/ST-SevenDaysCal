import { clampPaceToLatest, snapshotPaceState } from './pace-persist.js';
import { createFloorTicker } from './floor-tick.js';

function gateOf(state = {}, lastFloorKeys = ['lastFloor'], counterKeys = ['counter']) {
    const lastFloor = lastFloorKeys.map(key => state[key]).find(value => Number.isInteger(Number(value)));
    const counter = counterKeys.map(key => state[key]).find(value => value != null);
    return {
        lastFloor: Number.isInteger(Number(lastFloor)) ? Number(lastFloor) : -1,
        counter: Math.max(0, Math.floor(Number(counter) || 0)),
        lastDueFloor: Number.isInteger(Number(state.lastDueFloor)) ? Number(state.lastDueFloor) : -1,
    };
}

export function createPaceBook(env = {}) {
    const date = createFloorTicker();
    const ledgerCapture = createFloorTicker();
    const ledgerJudge = createFloorTicker();

    const liveGates = () => {
        const align = env.refresh?.state?.() || {};
        const outline = env.outline?.state?.() || {};
        const dashed = env.dashed?.state?.() || {};
        const lines = env.linesLifecycle || {};
        return {
            align: gateOf(align),
            advance: { ...gateOf(lines, ['lastSeenMaxMesId', 'lastFloor'], ['counter']), lastDueFloor: Number.isInteger(Number(lines.lastAdvanceFloor)) ? Number(lines.lastAdvanceFloor) : -1 },
            outline: gateOf(outline, ['lastFloor', 'lastJudgedMessageId'], ['counter', 'messageCounter']),
            dashed: gateOf(dashed, ['lastFloor', 'autoFloor'], ['counter', 'autoCount']),
            date: date.state(),
            ledgerCapture: ledgerCapture.state(),
            ledgerJudge: ledgerJudge.state(),
            pendingAdvance: env.refresh?.stagger?.hasPendingAdvance?.() === true,
            pendingDashed: env.refresh?.stagger?.pendingDashed === true,
            lastReconcileFloor: align.lastReconcileFloor,
        };
    };

    const persist = () => {
        if (!env.chatId?.()) return;
        env.write?.(snapshotPaceState(liveGates()));
    };
    const remember = () => {
        persist();
        env.paintSoon?.();
    };
    const hydrate = () => {
        const saved = clampPaceToLatest(env.read?.(), env.latestFloor?.() ?? -1);
        env.refresh?.hydrate?.({
            counter: saved.align.counter,
            lastFloor: saved.align.lastFloor,
            lastReconcileFloor: saved.lastReconcileFloor,
            pendingAdvance: saved.pendingAdvance,
            pendingDashed: saved.pendingDashed,
        });
        if (env.linesLifecycle) {
            env.linesLifecycle.counter = saved.advance.counter;
            env.linesLifecycle.lastSeenMaxMesId = saved.advance.lastFloor;
            env.linesLifecycle.lastAdvanceFloor = saved.advance.lastDueFloor;
        }
        env.outline?.hydrate?.(saved.outline);
        env.dashed?.hydrate?.(saved.dashed);
        date.hydrate(saved.date);
        ledgerCapture.hydrate(saved.ledgerCapture);
        ledgerJudge.hydrate(saved.ledgerJudge);
    };
    const resetChat = ({ lastSeen = -1 } = {}) => {
        date.reset({ lastFloor: lastSeen });
        ledgerCapture.reset({ lastFloor: lastSeen });
        ledgerJudge.reset({ lastFloor: lastSeen });
    };
    const consumeFloor = (name, messageId, opts = {}) => {
        const ticker = name === 'date' ? date : name === 'ledgerCapture' ? ledgerCapture : ledgerJudge;
        const tick = ticker.tick(messageId, { ...opts, sameFloor: opts.sameFloor === true || env.sameFloor?.() === true });
        if (tick.reason === 'interval') remember();
        return tick.status === 'due';
    };

    return {
        date, ledgerCapture, ledgerJudge,
        liveGates, persist, remember, hydrate, resetChat, consumeFloor,
    };
}
