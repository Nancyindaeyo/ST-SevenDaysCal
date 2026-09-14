import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSafeDiagnosticPack, compactActivityEntries, dayKey, jobsFromQueue, mergeAssistantDiagnosticPackage, settingsSnapshot } from './diagnostic-pack.js';

test('safe pack keeps flags, queue jobs and activity heads without snapshots', () => {
    const pack = buildSafeDiagnosticPack({
        pluginVersion: '3.7.9',
        settings: { pluginEnabled: true, linesMode: 'days', apiKey: 'secret', apiUrl: 'https://x' },
        chat: { floorCount: 4, latestAiFloor: 3, stampDay: '5-4', axisToday: '5-4', sameFloor: false },
        queue: {
            running: null,
            queued: [],
            failed: [{ id: 'outline', label: '面判定', error: '格式不对', reason: 'outline-judge-format' }],
            skipped: [{ id: 'advance', label: '推进', reason: 'no-stamp' }],
        },
        activity: [{
            source: 'advance',
            outcome: 'skipped',
            note: '缺戳',
            reasonCode: 'no-stamp',
            floorId: 3,
            snapshot: { lines: 'secret-raw' },
            items: [{ module: 'lines', title: '线' }],
            ts: 1,
        }],
        userNote: '重 roll 后没推进',
    });
    assert.equal(pack.format, 'st-sevendayscal-safe-pack');
    assert.equal(pack.settings.linesMode, 'days');
    assert.equal(pack.settings.apiKey, undefined);
    assert.deepEqual(pack.jobs.map(job => job.status), ['failed', 'skipped']);
    assert.equal(pack.activity[0].snapshot, undefined);
    assert.equal(pack.userNote, '重 roll 后没推进');
});

test('assistant pack v2 wraps the existing chat dump with runtime', () => {
    const merged = mergeAssistantDiagnosticPackage({ business: { x: 1 }, diagnostics: [] }, {
        pluginVersion: '3.7.9',
        userNote: '解析挂了',
        runtime: { jobs: [] },
    });
    assert.equal(merged.version, 2);
    assert.equal(merged.pluginVersion, '3.7.9');
    assert.equal(merged.runtime.jobs.length, 0);
    assert.equal(merged.business.x, 1);
});

test('helpers keep day keys and compact entries', () => {
    assert.equal(dayKey({ month: 5, day: 4, year: 2027 }), '2027-5-4');
    assert.equal(settingsSnapshot({ linesMode: 'manual', apiKey: 'x' }).apiKey, undefined);
    assert.equal(compactActivityEntries([{ source: 'a' }, { source: 'b' }, { source: 'c' }], 2).length, 2);
    assert.deepEqual(jobsFromQueue({ running: { id: 'align', label: '对齐' } })[0], { id: 'align', label: '对齐', status: 'running', reason: '' });
});
