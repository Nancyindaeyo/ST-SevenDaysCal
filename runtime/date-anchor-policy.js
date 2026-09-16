// 有效日期锚：pending/unresolved 不是锚；半残 SDC 不能提前停校准。
// 仓库仍是 chat-date-anchor；角色稳定键留在装配根，这里只收 charKey。

export function effectiveDateAnchor(local, {
    charKey,
    calendar,
    storyClock,
    completeStoryClock,
    monthCount,
    monthDays,
} = {}) {
    if (!charKey) return null;
    if (local && (local.status === 'unresolved' || local.status === 'pending')) return null;
    if (!local) return null;
    const cal = calendar || {};
    if (local.calibration) {
        if (!local.calibration || !Number.isInteger(local.calibration.weekday)) return null;
        const current = storyClock;
        // 半残 SDC 只能作为人工校准的日期相位，不能提前停用校准；
        // 只有当前 AI 楼的 start/end 两侧都完整且无重复歧义时才允许接管。
        if (completeStoryClock?.(current)) {
            const calibrationFloor = local.calibration?.floor;
            if (!Number.isInteger(calibrationFloor) || current.floor !== calibrationFloor) return null;
        }
    }
    return local.month >= 1 && local.month <= monthCount?.(cal) && local.day >= 1 && local.day <= monthDays?.(cal, local.month)
        ? { month: local.month, day: local.day, ...(local.year != null ? { year: local.year } : {}), ...(local.eraLabel ? { eraLabel: local.eraLabel } : {}), ...(local.time ? { time: local.time } : {}) }
        : null;
}

export function effectiveStoryCalibration(local, {
    charKey,
    calendar,
    monthCount,
    monthDays,
} = {}) {
    if (!charKey) return null;
    if (!local?.calibration) return null;
    const cal = calendar || {};
    if (local.month < 1 || local.month > monthCount?.(cal) || local.day < 1 || local.day > monthDays?.(cal, local.month)) return null;
    if (!Number.isInteger(local.calibration.weekday) || local.calibration.weekday < 0 || local.calibration.weekday > 6) return null;
    return {
        month: local.month,
        day: local.day,
        refMonth: local.calibration.refMonth ?? local.month,
        refDay: local.calibration.refDay ?? local.day,
        weekday: local.calibration.weekday,
        floor: local.calibration.floor,
        sourceFloor: local.calibration.sourceFloor,
        swipe: local.calibration.swipe,
    };
}

export function createDateAnchorPolicy(env = {}) {
    const localOf = () => env.repository?.get?.() || null;
    const calendarOf = () => env.calendar?.() || {};
    return {
        getDateAnchor(charKey) {
            return effectiveDateAnchor(localOf(), {
                charKey,
                calendar: calendarOf(),
                storyClock: env.storyClock?.(),
                completeStoryClock: env.completeStoryClock,
                monthCount: env.monthCount,
                monthDays: env.monthDays,
            });
        },
        getStoryCalibration(charKey) {
            return effectiveStoryCalibration(localOf(), {
                charKey,
                calendar: calendarOf(),
                monthCount: env.monthCount,
                monthDays: env.monthDays,
            });
        },
        setDateAnchor(charKey, month, day, source = 'explicit', options = {}) {
            return env.saveAnchor?.(charKey, month, day, source, options);
        },
    };
}
