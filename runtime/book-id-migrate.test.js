import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCanonicalBookIds } from './book-id-migrate.js';

test('book id migration writes only missing ids and keeps the chat guard', async () => {
    const writes = [];
    const result = await migrateCanonicalBookIds({
        chatId: () => 'c1',
        pointKey: () => ({ kind: 'schedule' }),
        linesKey: () => ({ kind: 'lines' }),
        read: key => key.kind === 'schedule'
            ? { raw: `<calendar_widget>
Day: 1
Event: main|体检|去做体检|上午|医院||false
</calendar_widget>` }
            : { raw: `<storylines_widget>
Line: 调查|延展|今天|world|false|false
Desc: 旧
Next: 下一步
Id: LINE-keep
</storylines_widget>` },
        writeConfirmed: async (key, value) => {
            writes.push({ key, raw: value.raw });
            return { ok: true };
        },
    });
    assert.equal(result.status, 'ready');
    assert.equal(result.point.status, 'migrated');
    assert.equal(result.lines.status, 'none');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key.kind, 'schedule');
    assert.match(writes[0].raw, /Id: POINT-/);
});

test('unknown write does not invent a second overwrite', async () => {
    const writes = [];
    const result = await migrateCanonicalBookIds({
        chatId: () => 'c1',
        pointKey: () => ({ kind: 'schedule' }),
        linesKey: () => ({ kind: 'lines' }),
        read: () => ({ raw: `<calendar_widget>
Day: 1
Event: main|体检|去做体检|上午|医院||false
</calendar_widget>` }),
        writeConfirmed: async (key, value) => {
            writes.push(key.kind);
            return { ok: false, commitState: 'unknown', reason: 'result-unknown' };
        },
    });
    assert.equal(result.point.status, 'unknown');
    assert.deepEqual(writes, ['schedule']);
});
