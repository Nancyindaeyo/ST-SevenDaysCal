function displayMonthName(calendar, month, monthName) {
    const label = monthName?.(calendar, month);
    return String(label || `${month}月`);
}

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function classicalNumber(value) {
    const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > 9999) return String(value ?? '');
    if (n < 10) return CN_DIGITS[n];
    const units = ['', '十', '百', '千']; const digits = String(n).split('').map(Number); let out = '';
    digits.forEach((digit, index) => {
        const pos = digits.length - index - 1;
        if (!digit) { if (out && digits.slice(index + 1).some(Boolean) && !out.endsWith('零')) out += '零'; return; }
        if (digit === 1 && pos === 1 && !out) out += '十';
        else out += `${CN_DIGITS[digit]}${units[pos]}`;
    });
    return out.replace(/零+/g, '零').replace(/零$/g, '');
}
function classicalDay(day) {
    const n = Number(day);
    if (n >= 1 && n <= 10) return `初${classicalNumber(n)}`;
    if (n >= 21 && n <= 29) return `廿${classicalNumber(n - 20)}`;
    return classicalNumber(n);
}

export function formatCalendarDate({ year = null, eraLabel = '', month, day } = {}, calendar = null, monthName = (_cal, m) => `${m}月`, part = 'full') {
    const classical = calendar?.displayStyle === 'classical';
    const era = String(eraLabel || (classical ? calendar?.era || '' : '')).trim();
    const y = year == null ? '' : `${classical ? classicalNumber(year) : year}年`;
    const m = displayMonthName(calendar, month, monthName);
    const d = classical ? classicalDay(day) : `${day}`;
    if (part === 'year') return `${era}${y}`;
    if (part === 'monthDay') return `${m}${d}日`;
    return `${era}${y}${m}${d}日`;
}

function parseAlmanacInt(value, min, max) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return n;
}

export function formatAlmanacDateParts(item, weekday, calendar = null, monthName = (_cal, month) => `${month}月`, { year = null, eraLabel = '' } = {}) {
    const month = parseAlmanacInt(item?.month, 1, 99);
    const day = parseAlmanacInt(item?.day, 1, 99);
    const resolvedYear = parseAlmanacInt(item?.year ?? year, 1, 9999);
    const week = String(weekday || '').trim();
    if (month == null || day == null) return { ymd: '', weekday: week || '星期未记录' };
    return {
        ymd: formatCalendarDate({ year: resolvedYear, eraLabel: eraLabel || item?.eraLabel || '', month, day }, calendar, monthName),
        weekday: week,
    };
}

export function formatAlmanacWhenLabel(item, weekday, calendar = null, monthName = (_cal, month) => `${month}月`, ctx = {}) {
    const { ymd, weekday: week } = formatAlmanacDateParts(item, weekday, calendar, monthName, ctx);
    if (!ymd) return week;
    return week ? `${ymd}·${week}` : ymd;
}
