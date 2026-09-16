import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticPackHost, downloadDiagnosticPackage, storyClockDayValue } from './diagnostic-pack-host.js';

test('story clock day prefers a valid end stamp then start', () => {
    assert.deepEqual(storyClockDayValue({
        endMeta: { valid: true, date: { month: 5, day: 4 } },
        startMeta: { valid: true, date: { month: 5, day: 1 } },
    }), { month: 5, day: 4 });
    assert.deepEqual(storyClockDayValue({
        endMeta: { valid: false },
        startMeta: { valid: true, month: 3, day: 2 },
    }), { valid: true, month: 3, day: 2 });
    assert.equal(storyClockDayValue(null), null);
});

test('downloadDiagnosticPackage writes json and revokes the object url', () => {
    const removed = [];
    const clicks = [];
    const created = [];
    const documentRef = {
        createElement: () => {
            const node = {
                href: '',
                download: '',
                style: { display: '' },
                click: () => clicks.push('click'),
                remove: () => removed.push('a'),
            };
            created.push(node);
            return node;
        },
        body: { appendChild: node => created.push(['body', node]) },
    };
    const text = downloadDiagnosticPackage({ a: 1 }, {
        filename: 'x.json',
        documentRef,
        createObjectURL: () => 'blob:1',
        revokeObjectURL: url => removed.push(url),
        setTimeoutFn: fn => fn(),
    });
    assert.match(text, /"a": 1/);
    assert.equal(created[0].download, 'x.json');
    assert.deepEqual(clicks, ['click']);
    assert.equal(removed.includes('blob:1'), true);
});

function makeHost(overrides = {}) {
    const copies = [];
    const toasts = [];
    const downloads = [];
    const prompts = [];
    let copyOk = overrides.copyOk !== false;
    let choice = overrides.choice === undefined ? 'safe' : overrides.choice;
    let note = overrides.note === undefined ? '重 roll 后没推进' : overrides.note;
    const host = createDiagnosticPackHost({
        pluginVersion: '3.12.5',
        getContext: () => ({ chat: [{}, {}, { is_user: false }] }),
        settings: () => ({ pluginEnabled: true, linesMode: 'days', apiKey: 'secret' }),
        latestStoryClock: () => ({ endMeta: { valid: true, date: { month: 5, day: 4 } } }),
        todayAnchor: () => ({ month: 5, day: 4 }),
        latestAiFloor: () => ({ index: 2 }),
        sameFloorPending: () => false,
        linesMode: () => 'days',
        queueSnapshot: () => ({ failed: [{ id: 'outline', label: '面判定', error: '格式不对' }] }),
        compactActivity: () => [{ source: 'advance', outcome: 'skipped', snapshot: 'no' }],
        readTrace: () => [{ event: 'skip' }],
        buildCurrentChat: async opts => ({ includeNarrative: opts.includeNarrative === true, diagnostics: [1] }),
        copyText: async text => { copies.push(text); return copyOk; },
        promptTextarea: async options => { prompts.push(options.title); if (options.title.startsWith('给助手')) return note; return undefined; },
        choose: async () => choice,
        downloadJson: data => { downloads.push(data); return JSON.stringify(data); },
        toast: (message, onClick, isError) => toasts.push([message, typeof onClick, isError === true]),
        ...overrides.env,
    });
    return {
        host,
        copies,
        toasts,
        downloads,
        prompts,
        setCopyOk(value) { copyOk = value; },
        setChoice(value) { choice = value; },
    };
}

test('collect keeps runtime flags and drops secrets', () => {
    const { host } = makeHost();
    const pack = host.collect('解析挂了');
    assert.equal(pack.format, 'st-sevendayscal-safe-pack');
    assert.equal(pack.pluginVersion, '3.12.5');
    assert.equal(pack.chat.stampDay, '5-4');
    assert.equal(pack.chat.latestAiFloor, 2);
    assert.equal(pack.chat.linesMode, 'days');
    assert.equal(pack.settings.apiKey, undefined);
    assert.equal(pack.userNote, '解析挂了');
    assert.equal(pack.activity[0].snapshot, undefined);
});

test('exportSafe copies when clipboard works and falls back to a dialog', async () => {
    const ok = makeHost({ copyOk: true });
    assert.equal((await ok.host.exportSafe()).status, 'copied');
    assert.match(ok.copies[0], /st-sevendayscal-safe-pack/);
    assert.equal(ok.toasts[0][0], '安全诊断包已复制（无剧情）');

    const fallback = makeHost({ copyOk: false });
    assert.equal((await fallback.host.exportSafe()).status, 'manual-copy');
    assert.equal(fallback.prompts[0], '复制安全诊断包');
});

test('exportAssistant merges runtime and skips cancel', async () => {
    const cancelled = makeHost({ choice: 'cancel' });
    assert.equal((await cancelled.host.exportAssistant()).status, 'cancelled');
    assert.equal(cancelled.downloads.length, 0);

    const exported = makeHost({ choice: 'narrative', note: '看原文' });
    assert.equal((await exported.host.exportAssistant()).status, 'exported');
    assert.equal(exported.downloads[0].includeNarrative, true);
    assert.equal(exported.downloads[0].runtime.userNote, '看原文');
    assert.equal(exported.downloads[0].format, 'st-sevendayscal-diagnostic-package');
    assert.equal(exported.toasts[0][0], '给助手的诊断包已导出');
});
