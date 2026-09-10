import { shiftPointCalendar } from '../point/shift.js';
import { pointScheduleNeedsDateSync } from '../point/controller.js';

function shiftItems(result) {
    return [
        ...result.completed.map(event => ({ module: 'point', title: String(event.title || '').slice(0, 40), action: 'complete', ref: event.id })),
        ...result.lockedMoved.map(event => ({ module: 'point', title: String(event.title || '').slice(0, 40), action: 'postpone', ref: event.id })),
    ];
}

// 锚点善后：任何一处改「今天」后统一走这里。
// 1) 格子前移（不调 API；往回拨不猜格子）2) 刷楼内框/点面板/轴 3) 日期制线在这里看换日。
export function createAnchorAftermath(env = {}) {
    function shiftPointsToToday() {
        try {
            const today = env.today?.();
            if (!today || !Number.isInteger(Number(today.month)) || !Number.isInteger(Number(today.day))) return false;
            const calendar = env.calendar?.();
            const shiftOne = (view, charName) => {
                const key = env.cacheKey?.(view, charName);
                if (!key) return false;
                const saved = env.readStore?.(key);
                const raw = saved?.raw || '';
                if (!raw) return false;
                const result = shiftPointCalendar(raw, today, calendar);
                if (!result.changed) return false;
                env.writeStore?.(key, { ...saved, raw: result.raw, ts: Date.now() });
                if (view === 'user') {
                    env.recordActivity?.({
                        source: 'shift',
                        snapshot: { point: raw },
                        after: { point: result.raw },
                        items: shiftItems(result),
                        note: `格子前移 ${result.delta} 天`,
                    });
                }
                return true;
            };
            shiftOne('user', '');
            const charName = String(env.charViewName?.() || '').trim();
            if (env.currentView?.() === 'char' && charName) shiftOne('char', charName);
            return true;
        } catch (error) {
            env.warn?.(error);
            return false;
        }
    }

    function run() {
        shiftPointsToToday();
        env.syncAlmanacBlock?.();
        env.syncScheduleBlock?.();
        // 星期锚是纯显示：用现有 raw 重画点面板，不写 store、不请求 API。生成中不抢画。
        if (!env.pointGenerating?.()) env.refreshPointPanel?.();
        env.notifyLinesDate?.();
        if (env.almanacVisible?.()) env.renderAlmanac?.();
        env.paintPace?.();
    }

    function pointNeedsSync(target = { view: 'user', charName: '' }, targetDate = null) {
        const view = target?.view === 'char' ? 'char' : 'user';
        const charName = view === 'char' ? String(target?.charName || '').trim() : '';
        const cacheKey = env.cacheKey?.(view, charName);
        if (!cacheKey) return false;
        const raw = env.readStore?.(cacheKey)?.raw || '';
        return pointScheduleNeedsDateSync(raw, targetDate || env.today?.());
    }

    return { run, pointNeedsSync, shiftPointsToToday };
}
