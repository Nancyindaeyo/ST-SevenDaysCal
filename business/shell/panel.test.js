import test from 'node:test';
import assert from 'node:assert/strict';
import { PANEL_VIEWS, paintScheduleHome, showPanelView, tabNavigationTarget } from './panel.js';

function fakeDom() {
    const display = {};
    const title = { text: '' };
    const classes = [];
    const attrs = {};
    const node = sel => ({
        hide() { display[sel] = 'none'; return this; },
        show() { display[sel] = 'show'; return this; },
        css(prop, value) { if (prop === 'display') display[sel] = value; return this; },
        text(value) { title.text = value; return this; },
        addClass(name) { classes.push(`${sel}:+${name}`); return this; },
        removeClass(name) { classes.push(`${sel}:-${name}`); return this; },
        attr(name, value) {
            attrs[sel] ||= {};
            if (typeof name === 'string') attrs[sel][name] = value;
            else Object.assign(attrs[sel], name || {});
            return this;
        },
    });
    return { $in: node, $inAll: node, display, title, classes, attrs };
}

test('showPanelView shows one wrap and hides the rest', () => {
    const dom = fakeDom();
    showPanelView(dom.$in, 'outline');
    assert.equal(dom.display['#sp-outline-wrap'], 'flex');
    assert.equal(dom.display['#sp-body'], 'none');
    assert.equal(dom.display['#sp-lines-wrap'], 'none');
    assert.equal(dom.display['#sp-sub-toggle'], 'none');
    assert.equal(dom.title.text, '面');
});

test('schedule home can paint tabs without touching wrap visibility', () => {
    const dom = fakeDom();
    paintScheduleHome(dom.$in, dom.$inAll, { sub: 'user', wraps: false });
    assert.equal(dom.display['#sp-body'], undefined);
    assert.equal(dom.display['#sp-sub-toggle'], 'show');
    assert.equal(dom.title.text, PANEL_VIEWS.schedule.title);
    assert.ok(dom.classes.includes('.sp-side-tab.sp-view-btn[data-view="schedule"]:+sp-view-active'));
    assert.ok(dom.classes.includes('.sp-sub-btn[data-view="user"]:+sp-view-active'));
    assert.equal(dom.attrs['.sp-side-tab.sp-view-btn[data-view="schedule"]']['aria-selected'], 'true');
    assert.equal(dom.attrs['.sp-sub-btn[data-view="user"]'].tabindex, '0');
});

test('tab keyboard navigation wraps and supports Home and End', () => {
    const tabs = [{ id: 1 }, { id: 2 }, { id: 3 }];
    assert.equal(tabNavigationTarget(tabs, tabs[2], 'ArrowDown'), tabs[0]);
    assert.equal(tabNavigationTarget(tabs, tabs[0], 'ArrowLeft'), tabs[2]);
    assert.equal(tabNavigationTarget(tabs, tabs[1], 'Home'), tabs[0]);
    assert.equal(tabNavigationTarget(tabs, tabs[1], 'End'), tabs[2]);
    assert.equal(tabNavigationTarget(tabs, tabs[1], 'Enter'), null);
});
