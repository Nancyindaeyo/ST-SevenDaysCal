// 长聊近窗：只决定哪些楼挂构画投影。聊天数据本身不裁剪。
// TT iOS 关掉虚拟化时整串 DOM 都在，扫描全部 .mes 会把楼内框成本放大到楼数。

export const INLINE_NEAR_NEIGHBOR = 2;
export const LONG_CHAT_BASELINE_FLOORS = 200;
export const LONG_CHAT_BASELINE_VISIBLE = 8;
export const LONG_CHAT_BASELINE_DEPTH = 6;

export function isMessageNode(el, { ignoreHidden = true } = {}) {
    if (!el || typeof el.getAttribute !== 'function') return false;
    if (ignoreHidden && el.getAttribute('is_system') === 'true') return false;
    return el.classList?.contains?.('mes') === true || el.getAttribute('mesid') != null;
}

export function isUserNode(el) {
    return el?.getAttribute?.('is_user') === 'true';
}

export function isAssistantNode(el, { ignoreHidden = true } = {}) {
    return isMessageNode(el, { ignoreHidden }) && !isUserNode(el);
}

export function collectTailMessages(fromEl, {
    depth = LONG_CHAT_BASELINE_DEPTH,
    ignoreHidden = true,
    previous = el => el?.previousElementSibling || null,
    maxWalk = 0,
} = {}) {
    const floors = [];
    let ai = 0;
    let walked = 0;
    const walkCap = Math.max(0, Math.floor(Number(maxWalk) || 0));
    let el = fromEl;
    const limit = Math.max(0, Math.floor(Number(depth) || 0));
    while (el) {
        walked += 1;
        if (walkCap > 0 && walked > walkCap) break;
        if (isMessageNode(el, { ignoreHidden })) {
            floors.push(el);
            if (isAssistantNode(el, { ignoreHidden })) {
                ai += 1;
                if (limit > 0 && ai >= limit) break;
            }
        }
        el = previous(el);
    }
    floors.reverse();
    return { floors, walked, ai };
}

export function neighborSet(els, { neighbor = INLINE_NEAR_NEIGHBOR, previous, next } = {}) {
    const count = Math.max(0, Math.floor(Number(neighbor) || 0));
    const set = new Set(els || []);
    const walk = (start, step) => {
        let el = start;
        for (let i = 0; i < count; i++) {
            el = step(el);
            if (!el) break;
            if (isMessageNode(el)) set.add(el);
        }
    };
    for (const el of els || []) {
        walk(el, previous || (node => node?.previousElementSibling || null));
        walk(el, next || (node => node?.nextElementSibling || null));
    }
    return set;
}

export function planLiveProjection({
    windowEls = [],
    latestEl = null,
    visibleEls = [],
    neighbor = INLINE_NEAR_NEIGHBOR,
    previous,
    next,
} = {}) {
    const winSet = new Set(windowEls);
    const live = new Set();
    if (latestEl && winSet.has(latestEl)) live.add(latestEl);
    const near = neighborSet(visibleEls, { neighbor, previous, next });
    for (const el of near) if (winSet.has(el)) live.add(el);
    return live;
}

export function longChatBaseline({
    floors = LONG_CHAT_BASELINE_FLOORS,
    visible = LONG_CHAT_BASELINE_VISIBLE,
    depth = LONG_CHAT_BASELINE_DEPTH,
    neighbor = INLINE_NEAR_NEIGHBOR,
} = {}) {
    const total = Math.max(0, Math.floor(Number(floors) || 0));
    const depthCap = Math.max(1, Math.floor(Number(depth) || LONG_CHAT_BASELINE_DEPTH));
    const visibleCount = Math.max(0, Math.floor(Number(visible) || 0));
    const neighborCount = Math.max(0, Math.floor(Number(neighbor) || 0));
    const windowFloors = Math.min(total, depthCap * 2);
    const scanned = windowFloors;
    const liveMax = Math.min(windowFloors, visibleCount + neighborCount * 2 + 1);
    return {
        floors: total,
        depth: depthCap,
        windowFloors,
        scanned,
        liveMax,
        skipped: Math.max(0, total - windowFloors),
    };
}
