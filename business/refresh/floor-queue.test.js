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
