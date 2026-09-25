export const UTILITY_ROUTE_STATUSES = Object.freeze(['follow-main', 'configured', 'invalid', 'paused']);

function freezeRoute({ status, reason = '', presetId = '', presetName = '', cfg = null } = {}) {
    return Object.freeze({
        status: String(status || ''),
        reason: String(reason || ''),
        presetId: String(presetId || ''),
        presetName: String(presetName || ''),
        cfg: cfg || null,
    });
}

export function inspectUtilityPreset(preset) {
    if (!preset) return 'missing-preset';
    if (!String(preset.url || '').trim()) return 'missing-url';
    if (!String(preset.key || '').trim()) return 'missing-key';
    if (!String(preset.model || '').trim()) return 'missing-model';
    return '';
}

export function resolveUtilityRoute({
    utilityPresetId = '',
    utilityPaused = false,
    utilityAllowMain = false,
    sessionAllowMain = false,
    presets = [],
    mainCfg = null,
} = {}) {
    const presetId = String(utilityPresetId || '');
    const preset = presetId ? (Array.isArray(presets) ? presets : []).find(item => item?.id === presetId) || null : null;
    const presetName = preset?.name ? String(preset.name) : '';
    const allowMain = utilityAllowMain === true || sessionAllowMain === true;
    const allowReason = utilityAllowMain === true ? 'user-allow-main' : sessionAllowMain === true ? 'session-allow-main' : '';

    if (utilityPaused === true) {
        return freezeRoute({ status: 'paused', reason: 'paused', presetId, presetName, cfg: null });
    }
    if (!presetId) {
        return freezeRoute({ status: 'follow-main', reason: 'no-utility-preset', cfg: mainCfg || null });
    }
    const defect = inspectUtilityPreset(preset);
    if (defect) {
        if (allowMain) {
            return freezeRoute({ status: 'follow-main', reason: allowReason, presetId, presetName, cfg: mainCfg || null });
        }
        return freezeRoute({ status: 'invalid', reason: defect, presetId, presetName, cfg: null });
    }
    return freezeRoute({
        status: 'configured',
        presetId,
        presetName,
        cfg: {
            url: preset.url || '',
            key: preset.key || '',
            model: preset.model || '',
            excludeParams: Array.isArray(preset.excludeParams) ? preset.excludeParams : [],
            timeoutSec: Number.isInteger(Number(preset.timeoutSec)) ? Number(preset.timeoutSec) : 180,
            stream: preset.stream === true,
        },
    });
}

export function utilitySkipReason(route) {
    if (!route) return 'config-missing';
    if (route.status === 'paused') return 'utility-route-paused';
    if (route.status === 'invalid') return 'utility-route-invalid';
    return 'config-missing';
}

export function isUtilityRoute(value) {
    return !!value && typeof value === 'object'
        && typeof value.status === 'string'
        && Object.prototype.hasOwnProperty.call(value, 'cfg');
}

export function mechanicalCallConfig(value) {
    const route = isUtilityRoute(value) ? value : null;
    const cfg = route ? route.cfg : value;
    if (cfg?.url && cfg?.key) return { ok: true, cfg, route, reason: '' };
    return {
        ok: false,
        cfg: null,
        route,
        reason: route ? utilitySkipReason(route) : 'config-missing',
    };
}

export function utilityRouteSnapshot(route) {
    if (!route) return null;
    return Object.freeze({
        status: String(route.status || ''),
        reason: String(route.reason || ''),
        presetId: String(route.presetId || ''),
        presetName: String(route.presetName || ''),
    });
}

export function utilityRouteLabel(route) {
    if (!route) return '';
    if (route.status === 'paused') return '机械任务已暂停';
    if (route.status === 'configured') return `机械任务 → ${route.presetName || route.presetId}`;
    if (route.status === 'follow-main') {
        if (route.reason === 'user-allow-main' || route.reason === 'session-allow-main') {
            return '机械任务预设已失效，已按你的允许改走主 API';
        }
        return '跟随主 API（不分流）';
    }
    const why = {
        'missing-preset': '机械任务预设已被删除',
        'missing-url': '机械任务预设未填 URL',
        'missing-key': '机械任务预设未填 Key',
        'missing-model': '机械任务预设未填模型',
    }[route.reason] || '机械任务预设已失效';
    return `${why}，已暂停调用`;
}

export function utilityPresetDeleteImpact(utilityPresetId, deletingId) {
    return !!utilityPresetId && utilityPresetId === deletingId;
}
