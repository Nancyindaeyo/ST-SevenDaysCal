import test from 'node:test';
import assert from 'node:assert/strict';
import { clampBeatShots, formatBeatForInput, parseBeatShots, serializeBeatShots } from './schema.js';
import { buildBeatPrompt } from './prompt.js';

test('parse beat shots keeps 4-5 angled outlines', () => {
    const shots = parseBeatShots(`<beat_shots>
Shot: 1|today|晚饭收口
今晚把体检收成一句闲聊，落到谁请假。
Shot: 2|line|柳的侧写
柳的调查从走廊经过，只露一句，不爆发。
Shot: 3|date|体检报告日
报告日倒计时压在晚饭桌上。
Shot: 4|daily|洗碗
洗碗时确认明天谁先出门。
Shot: 5|space|换路径
不跟间里的硬冲突，改走留面节点的软收。
</beat_shots>`);
    assert.equal(shots.length, 5);
    assert.equal(shots[0].angle, 'today');
    assert.equal(shots[1].title, '柳的侧写');
    assert.match(formatBeatForInput(shots[0]), /晚饭收口/);
});

test('serialize then parse round-trips titles', () => {
    const raw = serializeBeatShots([
        { angle: 'today', title: 'A', body: '甲' },
        { angle: 'line', title: 'B', body: '乙' },
        { angle: 'date', title: 'C', body: '丙' },
        { angle: 'daily', title: 'D', body: '丁' },
    ]);
    assert.equal(parseBeatShots(raw).map(shot => shot.title).join(','), 'A,B,C,D');
    assert.equal(clampBeatShots(parseBeatShots(raw)).length, 4);
});

test('beat prompt asks for 4-5 shots and never fills theater', () => {
    const prompt = buildBeatPrompt({ userName: '春', charName: '柳', spaceRecent: '' });
    assert.match(prompt, /4～5/);
    assert.match(prompt, /不要填棱/);
    assert.match(prompt, /换路径/);
});

test('beat prompt keeps the latest floor story in full', () => {
    const latestStory = `${'这段正文要完整进本轮拍。'.repeat(80)}收口句。`;
    const prompt = buildBeatPrompt({ latestStory, pointRaw: '日程全文', spaceRecent: '间里刚说完' });
    assert.match(prompt, /【刚落地的正文】/);
    assert.ok(prompt.includes(latestStory));
    assert.ok(prompt.includes('日程全文'));
});

test('removeShot drops one outline and keeps the rest', async () => {
    const { createBeatController } = await import('./controller.js');
    let latest = [];
    const controller = createBeatController({ onChange: shots => { latest = shots; } });
    controller.replace([
        { angle: 'today', title: 'A', body: '甲' },
        { angle: 'line', title: 'B', body: '乙' },
        { angle: 'date', title: 'C', body: '丙' },
        { angle: 'daily', title: 'D', body: '丁' },
    ]);
    controller.removeShot(1);
    assert.deepEqual(latest.map(shot => shot.title), ['A', 'C', 'D']);
    assert.equal(controller.shots.length, 3);
});

test('beat shots stay on the current floor and clear on the next AI floor', async () => {
    const { createBeatController } = await import('./controller.js');
    let stored = null;
    let floor = 10;
    const controller = createBeatController({
        floorId: () => floor,
        read: () => stored,
        write: value => { stored = value; },
    });
    controller.replace([{ angle: 'today', title: 'A', body: '甲' }]);
    assert.equal(stored.floorId, 10);
    assert.equal(controller.onAiFloor(10), 'kept');
    assert.equal(controller.shots.map(shot => shot.title).join(), 'A');
    floor = 12;
    assert.equal(controller.onAiFloor(12), 'cleared');
    assert.equal(controller.shots.length, 0);
    assert.equal(stored, null);
});

test('beat shots survive a plugin reload on the same floor', async () => {
    const { createBeatController } = await import('./controller.js');
    let stored = null;
    const env = {
        floorId: () => 7,
        read: () => stored,
        write: value => { stored = value; },
    };
    createBeatController(env).replace([{ angle: 'today', title: 'A', body: '甲' }]);
    const reloaded = createBeatController(env);
    assert.equal(reloaded.syncFloor(), 'kept');
    assert.equal(reloaded.shots[0].title, 'A');
});
