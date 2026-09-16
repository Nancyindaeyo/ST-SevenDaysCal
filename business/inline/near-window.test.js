import test from 'node:test';
import assert from 'node:assert/strict';
import {
    collectTailMessages,
    longChatBaseline,
    neighborSet,
    planLiveProjection,
    LONG_CHAT_BASELINE_FLOORS,
    LONG_CHAT_BASELINE_DEPTH,
} from './near-window.js';

function mes(id, { user = false, system = false, prev = null, next = null } = {}) {
    const el = {
        id,
        classList: { contains: name => name === 'mes' },
        getAttribute(name) {
            if (name === 'mesid') return String(id);
            if (name === 'is_user') return user ? 'true' : 'false';
            if (name === 'is_system') return system ? 'true' : 'false';
            return null;
        },
        previousElementSibling: prev,
        nextElementSibling: next,
    };
    return el;
}

function chain(specs) {
    const nodes = specs.map((spec, index) => mes(index, spec));
    for (let i = 0; i < nodes.length; i++) {
        nodes[i].previousElementSibling = nodes[i - 1] || null;
        nodes[i].nextElementSibling = nodes[i + 1] || null;
    }
    return nodes;
}

test('tail walk stops after N AI floors and does not visit the whole chat', () => {
    const nodes = chain(Array.from({ length: 200 }, (_, i) => ({ user: i % 2 === 0 })));
    const result = collectTailMessages(nodes.at(-1), { depth: 6 });
    assert.equal(result.ai, 6);
    assert.ok(result.floors.length <= 12);
    assert.ok(result.walked <= 12);
    assert.equal(result.floors.at(-1).id, 199);
});

test('long chat baseline keeps live projections far below total floors', () => {
    const baseline = longChatBaseline({
        floors: LONG_CHAT_BASELINE_FLOORS,
        visible: 8,
        depth: LONG_CHAT_BASELINE_DEPTH,
        neighbor: 2,
    });
    assert.equal(baseline.floors, 200);
    assert.equal(baseline.windowFloors, 12);
    assert.equal(baseline.scanned, 12);
    assert.equal(baseline.liveMax, 12);
    assert.equal(baseline.skipped, 188);
    assert.ok(baseline.liveMax < baseline.floors / 10);
});

test('live projection is latest plus visible neighbors inside the depth window', () => {
    const nodes = chain(Array.from({ length: 12 }, (_, i) => ({ user: i % 2 === 0 })));
    const latest = nodes.at(-1);
    const visible = [nodes[8], nodes[9]];
    const live = planLiveProjection({
        windowEls: nodes,
        latestEl: latest,
        visibleEls: visible,
        neighbor: 1,
    });
    assert.equal(live.has(latest), true);
    assert.equal(live.has(nodes[7]), true);
    assert.equal(live.has(nodes[10]), true);
    assert.equal(live.has(nodes[0]), false);
    assert.equal(neighborSet([nodes[9]], { neighbor: 1 }).has(nodes[8]), true);
});
