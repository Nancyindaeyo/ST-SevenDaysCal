import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloorJobQueue, FLOOR_JOB_ORDER } from './floor-queue.js';

test('jobs run in fixed order and a failure does not stop the rest', async () => {
    const ran = [];
    const failed = [];
    const queue = createFloorJobQueue({
        identityCurrent: () => true,
        onJobFailed: job => failed.push(job.id),
    });
    queue.beginFloor({ chatId: 'c', floorId: 3 });
    queue.enqueue({ id: 'dashed', run: async () => { ran.push('dashed'); return { status: 'updated' }; } });
    queue.enqueue({ id: 'align', run: async () => { ran.push('align'); return { status: 'failed', error: 'boom' }; } });
    queue.enqueue({ id: 'advance', run: async () => { ran.push('advance'); return { status: 'updated' }; } });
    const snap = await queue.drain();
    assert.deepEqual(ran, ['align', 'advance', 'dashed']);
    assert.deepEqual(failed, ['align']);
    assert.equal(snap.failed[0].id, 'align');
    assert.equal(snap.busy, false);
    assert.deepEqual(FLOOR_JOB_ORDER.slice(0, 3), ['align', 'advance', 'supplement']);
});

test('stale identity stops remaining jobs without burning them as failures', async () => {
    let live = true;
    const ran = [];
    const queue = createFloorJobQueue({ identityCurrent: () => live });
    queue.beginFloor({ chatId: 'c', floorId: 1 });
    queue.enqueue({ id: 'align', run: async () => { ran.push('align'); live = false; return { status: 'updated' }; } });
    queue.enqueue({ id: 'advance', run: async () => { ran.push('advance'); return { status: 'updated' }; } });
    await queue.drain();
    assert.deepEqual(ran, ['align']);
    assert.equal(queue.snapshot().failed.length, 0);
    assert.equal(queue.snapshot().rejected[0].id, 'advance');
    assert.equal(queue.snapshot().rejected[0].reason, 'identity-changed');
});

test('a new idle floor drops leftover failures so the red glow can go out', async () => {
    const queue = createFloorJobQueue({ identityCurrent: () => true });
    queue.beginFloor({ chatId: 'c', floorId: 1 });
    queue.enqueue({ id: 'align', run: async () => ({ status: 'failed', error: 'x' }) });
    await queue.drain();
    assert.equal(queue.snapshot().failed.length, 1);
    queue.beginFloor({ chatId: 'c', floorId: 2 });
    assert.equal(queue.snapshot().failed.length, 0);
});

test('visible skips stay on the queue without counting as failures', async () => {
    const queue = createFloorJobQueue({ identityCurrent: () => true });
    queue.beginFloor({ chatId: 'c', floorId: 4 });
    queue.enqueue({ id: 'advance', run: async () => ({ status: 'skipped', reason: 'no-stamp' }) });
    queue.enqueue({ id: 'outline', run: async () => ({ status: 'skipped', reason: 'same-day' }) });
    const snap = await queue.drain();
    assert.equal(snap.failed.length, 0);
    assert.equal(snap.skipped[0].id, 'advance');
    assert.equal(snap.skipped[0].reason, 'no-stamp');
});

test('retry runs only the failed job', async () => {
    let alignTries = 0;
    const queue = createFloorJobQueue({ identityCurrent: () => true });
    queue.beginFloor({ chatId: 'c', floorId: 2 });
    queue.enqueue({
        id: 'align',
        run: async () => {
            alignTries += 1;
            return alignTries === 1 ? { status: 'failed', error: 'x' } : { status: 'updated' };
        },
    });
    await queue.drain();
    const retried = await queue.retry('align');
    assert.equal(retried.status, 'updated');
    assert.equal(queue.snapshot().failed.length, 0);
    assert.equal(alignTries, 2);
});

test('a same-floor job enqueued while draining is retained and runs once', async () => {
    let releaseAlign;
    const gate = new Promise(resolve => { releaseAlign = resolve; });
    const ran = [];
    const queue = createFloorJobQueue({ identityCurrent: () => true });
    queue.beginFloor({ chatId: 'c', floorId: 2 });
    queue.enqueue({
        id: 'align',
        run: async () => {
            ran.push('align');
            await gate;
            return { status: 'updated' };
        },
    });
    const draining = queue.drain();
    await Promise.resolve();
    assert.equal(queue.enqueue({
        id: 'advance',
        run: async () => { ran.push('advance'); return { status: 'updated' }; },
    }), true);
    assert.equal(queue.enqueue({
        id: 'advance',
        run: async () => { ran.push('duplicate'); return { status: 'updated' }; },
    }), false);
    assert.deepEqual(queue.snapshot().queued.map(job => job.id), ['advance']);
    releaseAlign();
    const result = await draining;
    assert.deepEqual(ran, ['align', 'advance']);
    assert.equal(result.busy, false);
});

test('pending jobs expose timestamps and can be cancelled before they run', async () => {
    let tick = 100;
    const queue = createFloorJobQueue({
        identityCurrent: () => true,
        now: () => tick++,
    });
    queue.beginFloor({ chatId: 'c', floorId: 4 });
    queue.enqueue({ id: 'advance', run: async () => ({ status: 'updated' }) });
    assert.equal(queue.snapshot().queued[0].enqueuedAt, 100);
    assert.deepEqual(queue.cancelPending('advance'), { status: 'cancelled', id: 'advance' });
    assert.equal(queue.snapshot().queued.length, 0);
    assert.equal(queue.snapshot().cancelled[0].reason, 'manual-cancel');
    await queue.drain();
});

test('duplicate enqueue records a visible rejection reason', () => {
    const queue = createFloorJobQueue({ identityCurrent: () => true, now: () => 200 });
    queue.beginFloor({ chatId: 'c', floorId: 4 });
    queue.enqueue({ id: 'align', run: async () => ({ status: 'updated' }) });
    assert.equal(queue.enqueue({ id: 'align', run: async () => ({ status: 'updated' }) }), false);
    assert.equal(queue.snapshot().rejected[0].id, 'align');
    assert.equal(queue.snapshot().rejected[0].reason, 'duplicate');
});

test('external automation gates can record a typed rejection', () => {
    const queue = createFloorJobQueue({ identityCurrent: () => true, now: () => 300 });
    queue.beginFloor({ chatId: 'c', floorId: 5 });
    assert.equal(queue.recordRejected({ id: 'outline' }, 'automation-disabled'), false);
    assert.deepEqual(queue.snapshot().rejected[0], {
        id: 'outline',
        label: '面判定',
        error: '',
        reason: 'automation-disabled',
        enqueuedAt: 300,
        startedAt: 0,
    });
});
