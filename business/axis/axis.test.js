import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDateDetectionController } from './date-detection.js';
import { formatAlmanacDateParts, formatAlmanacWhenLabel, formatCalendarDate } from './date-format.js';

const root = new URL('../../', import.meta.url);
const index = fs.readFileSync(new URL('index.js', root), 'utf8');
const css = fs.readFileSync(new URL('style.css', root), 'utf8');
const itemUi = fs.readFileSync(new URL('./item-ui.js', import.meta.url), 'utf8');

test('axis toolbar production contract has shared wide/narrow action dispatcher', () => {
    for (const selector of ['.sp-alm-add', '.sp-alm-gen', '.sp-alm-supplement', '.sp-alm-manage', '.sp-action-menu-toggle', '.sp-action-menu-item']) assert.match(index, new RegExp(selector.replaceAll('.', '\\.'), 'g'));
    for (const action of ['openAlmanacEditor', 'triggerGenerateAlmanac', 'triggerSupplementAnniversary', 'openCalendarManager']) assert.match(index, new RegExp(`dispatchAlmanacAction[\\s\\S]{0,1200}${action}`));
    assert.match(index, /\.sp-action-menu-list.*\.attr\('hidden', !open\)/);
    assert.match(index, /\.toggleClass\('sp-action-menu-open', open\)/);
    assert.match(index, /aria-expanded.*String\(open\)/);
});

test('upcoming weekday label includes calendar date and optional year', () => {
    assert.equal(formatAlmanacWhenLabel({ month: 4, day: 30 }, '周五'), '4月30日·周五');
    assert.equal(formatAlmanacWhenLabel({ month: 4, day: 30 }, '周五', null, undefined, { year: 2027 }), '2027年4月30日·周五');
    assert.equal(formatCalendarDate({ year: 2027, month: 4, day: 30 }), '2027年4月30日');
    assert.deepEqual(formatAlmanacDateParts({ month: 4, day: 29 }, '周四', null, undefined, { year: 2027 }), { ymd: '2027年4月29日', weekday: '周四' });
    assert.deepEqual(formatAlmanacDateParts({ month: '4', day: '29' }, '周四', null, undefined, { year: '2027' }), { ymd: '2027年4月29日', weekday: '周四' });
});

test('almanac card header keeps year-month-day in its own unshrinkable slot', () => {
    assert.match(itemUi, /formatAlmanacDateParts/);
    assert.match(itemUi, /class="sp-alm-ymd"/);
    assert.match(itemUi, /class="sp-alm-when"/);
    assert.match(css, /\.sp-alm-ymd[\s\S]*flex-shrink:\s*0/);
    assert.match(css, /\.sp-alm-when[\s\S]*margin-left:\s*auto/);
});

test('axis CSS keeps editor action and time-travel fixes scoped', () => {
    assert.match(css, /\.sp-alm-editor-actions > button[\s\S]*border-radius:\s*8px/);
    assert.match(css, /\.sp-alm-time-travel,\s*\.sp-alm-time-travel-stop\s*\{\s*white-space:\s*nowrap;/);
});

test('date chat bootstrap resets weekday signature and suppresses only the exact first-floor aftermath', () => {
    let chatId = 'A'; let floor = 0; let weekday = 1; let aftermath = 0; const writes = [];
    const controller = createDateDetectionController({
        context: () => ({ chatId }), identity: () => ({ chatId, floor, swipe: 0 }), storyEnabled: () => true,
        storyClock: () => ({ floor, endMeta: { complete: true, month: 1, day: floor + 1, weekdayIndex: weekday } }), completeStoryClock: () => true,
        storyDate: () => ({ month: 1, day: floor + 1 }), charKey: () => 'card', getAnchor: () => writes.at(-1) || null,
        setAnchor: (_key, month, day) => { writes.push({ month, day }); return { ok: true }; }, settings: () => ({ notifyMode: 'off' }), aftermath: () => { aftermath++; },
    });
    controller.reland();
    assert.equal(aftermath, 1);
    chatId = 'B'; floor = 0; weekday = 3; controller.reset();
    const bootstrap = controller.reland({ suppressAftermath: true });
    assert.equal(bootstrap.status, 'handled');
    assert.equal(aftermath, 1, '新聊天精确首楼只能落日期/星期，不能触发生成善后');
    floor = 1; weekday = 4;
    controller.reland();
    assert.equal(aftermath, 2, '下一条真实新楼仍须正常触发一次善后');
});
