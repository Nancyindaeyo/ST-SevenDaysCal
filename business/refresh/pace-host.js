import { collectPaceRows, overlayQueueOnRows, paceStripHtml } from './pace.js';

const INTERACTIVE_PACE = ['align', 'advance', 'outline', 'dashed', 'supplement', 'ledger-capture', 'ledger-judge'];

export function readInterval(raw, fallback) {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export function almanacJudgeIntervalOf(settings) {
    return readInterval(settings?.almanacJudgeInterval, 3);
}

export function almanacSupplementIntervalOf(settings) {
    return readInterval(settings?.almanacSupplementInterval, 10);
}

export function ledgerCaptureIntervalOf(settings) {
    return readInterval(settings?.ledgerCaptureInterval, 5);
}

export function ledgerJudgeIntervalOf(settings) {
    return readInterval(settings?.ledgerJudgeInterval, 4);
}

// 节拍条宿主：读间隔、拼快照、画折叠条。DOM / 账本 / 队列都当端口注入，避免反向读装配根。
export function createPaceHost(env = {}) {
    let paintQueued = false;

    function settings() {
        return env.settings?.() || {};
    }

    function almanacJudgeInterval() {
        return almanacJudgeIntervalOf(settings());
    }

    function almanacSupplementInterval() {
        return almanacSupplementIntervalOf(settings());
    }

    function ledgerCaptureInterval() {
        return ledgerCaptureIntervalOf(settings());
    }

    function ledgerJudgeInterval() {
        return ledgerJudgeIntervalOf(settings());
    }

    function readSnapshot() {
        const s = settings();
        const gates = env.paceBook?.liveGates?.() || {};
        return {
            alignOn: s.ledgerReconcileEnabled === true,
            alignUsed: gates.align?.counter,
            alignInterval: env.alignInterval?.() ?? 3,
            alignFailed: env.latestAlignFailed?.() === true,
            linesOn: s.linesEnabled !== false,
            linesMode: env.linesMode?.(),
            pendingAdvance: gates.pendingAdvance,
            pendingDashed: gates.pendingDashed,
            missingStamp: env.missingLatestStamp?.() === true,
            advanceFailed: env.latestAdvanceFailed?.() === true,
            advanceUsed: gates.advance?.counter,
            advanceInterval: env.advanceInterval?.() ?? 2,
            outlineOn: s.outlineJudgeEnabled === true,
            outlineUsed: gates.outline?.counter,
            outlineInterval: env.outlineInterval?.() || 3,
            dateOn: s.almanacAutoDetect !== false,
            dateUsed: gates.date?.counter,
            dateInterval: almanacJudgeInterval(),
            supplementOn: true,
            supplementUsed: gates.supplement?.counter || 0,
            supplementInterval: almanacSupplementInterval(),
            dashedOn: s.dashedEnabled === true,
            dashedUsed: gates.dashed?.counter,
            dashedInterval: Math.max(1, Number(s.dashedAutoInterval) || 6),
            ledgerOn: s.ledgerCaptureEnabled === true,
            ledgerCaptureUsed: gates.ledgerCapture?.counter,
            ledgerCaptureInterval: ledgerCaptureInterval(),
            ledgerJudgeUsed: gates.ledgerJudge?.counter,
            ledgerJudgeInterval: ledgerJudgeInterval(),
        };
    }

    function persist() { env.paceBook?.persist?.(); }
    function remember() { env.paceBook?.remember?.(); }
    function hydrate() { env.paceBook?.hydrate?.(); }

    function paint() {
        const $in = env.$in;
        if (typeof $in !== 'function') return readSnapshot();
        const rows = env.pluginEnabled?.()
            ? overlayQueueOnRows(collectPaceRows(readSnapshot()), env.queueSnapshot?.() || null)
            : [];
        const empty = env.pluginEnabled?.() ? '后台节奏都关着' : '插件关着';
        const $fold = $in('#sp-pace-fold');
        if ($fold.length) $fold.html(paceStripHtml(rows, { empty }));
        const $host = $in('#sp-activity-pace-strip-host');
        if ($host.length) {
            $host.html(paceStripHtml(rows, { empty, id: 'sp-activity-pace-strip', interactive: INTERACTIVE_PACE, compact: true }));
            env.syncActivityPaceOpen?.();
        } else {
            const $activityPace = $in('#sp-activity-pace');
            if ($activityPace.length) $activityPace.html(paceStripHtml(rows, { empty, id: 'sp-activity-pace-strip', interactive: INTERACTIVE_PACE, compact: true }));
        }
        const $settings = $in('#sp-pace-settings');
        if ($settings.length) $settings.html(paceStripHtml(rows, { empty, id: 'sp-pace-settings-strip' }));
        for (const row of rows) {
            const $el = $in(`[data-pace-remain="${row.id}"]`);
            if (!$el.length) continue;
            $el.text(row.text)
                .toggleClass('is-off', !!row.off)
                .toggleClass('is-due', !row.off && (!!row.due || row.text === '下一楼' || row.text === '下一楼补' || row.live === 'running' || row.live === 'queued' || row.live === 'failed'))
                .toggleClass('is-running', row.live === 'running')
                .toggleClass('is-queued', row.live === 'queued')
                .toggleClass('is-failed', row.live === 'failed');
        }
        if (!rows.length) $in('[data-pace-remain]').text('').removeClass('is-due is-off is-running is-queued is-failed');
        return rows;
    }

    function paintSoon() {
        if (paintQueued) return false;
        paintQueued = true;
        const kick = () => { paintQueued = false; paint(); };
        if (typeof env.schedule === 'function') env.schedule(kick);
        else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(kick);
        else setTimeout(kick, 0);
        return true;
    }

    return {
        almanacJudgeInterval,
        almanacSupplementInterval,
        ledgerCaptureInterval,
        ledgerJudgeInterval,
        readSnapshot,
        persist,
        remember,
        hydrate,
        paint,
        paintSoon,
    };
}
