import test from 'node:test';
import assert from 'node:assert/strict';
import {
    inspectUtilityPreset,
    mechanicalCallConfig,
    resolveUtilityRoute,
    utilityPresetDeleteImpact,
    utilityRouteSnapshot,
    utilitySkipReason,
} from './utility-route.js';

const main = { url: 'https://main.example/v1', key: 'main-key', model: 'main' };
const cheap = { id: 'p1', name: '便宜', url: 'https://cheap.example/v1', key: 'cheap-key', model: 'lite' };

test('follow-main and configured return usable cfg', () => {
    assert.equal(resolveUtilityRoute({ mainCfg: main }).status, 'follow-main');
    assert.equal(resolveUtilityRoute({ mainCfg: main }).cfg.url, main.url);
    const configured = resolveUtilityRoute({ utilityPresetId: 'p1', presets: [cheap], mainCfg: main });
    assert.equal(configured.status, 'configured');
    assert.equal(configured.cfg.model, 'lite');
    assert.equal(configured.cfg.key, 'cheap-key');
});

test('deleted or incomplete presets fail closed instead of folding to main', () => {
    assert.equal(inspectUtilityPreset(null), 'missing-preset');
    assert.equal(inspectUtilityPreset({ url: '', key: 'k', model: 'm' }), 'missing-url');
    assert.equal(inspectUtilityPreset({ url: 'u', key: '', model: 'm' }), 'missing-key');
    assert.equal(inspectUtilityPreset({ url: 'u', key: 'k', model: '' }), 'missing-model');
    const missing = resolveUtilityRoute({ utilityPresetId: 'gone', presets: [cheap], mainCfg: main });
    assert.equal(missing.status, 'invalid');
    assert.equal(missing.reason, 'missing-preset');
    assert.equal(missing.cfg, null);
    const noModel = resolveUtilityRoute({
        utilityPresetId: 'p1',
        presets: [{ ...cheap, model: '' }],
        mainCfg: main,
    });
    assert.equal(noModel.status, 'invalid');
    assert.equal(noModel.reason, 'missing-model');
    assert.equal(noModel.cfg, null);
});

test('paused wins over allow-main; allow-main is an explicit follow-main', () => {
    const paused = resolveUtilityRoute({
        utilityPresetId: 'gone',
        utilityPaused: true,
        utilityAllowMain: true,
        presets: [],
        mainCfg: main,
    });
    assert.equal(paused.status, 'paused');
    assert.equal(paused.cfg, null);
    const allowed = resolveUtilityRoute({
        utilityPresetId: 'gone',
        sessionAllowMain: true,
        presets: [],
        mainCfg: main,
    });
    assert.equal(allowed.status, 'follow-main');
    assert.equal(allowed.reason, 'session-allow-main');
    assert.equal(allowed.cfg.url, main.url);
    const persist = resolveUtilityRoute({
        utilityPresetId: 'gone',
        utilityAllowMain: true,
        presets: [],
        mainCfg: main,
    });
    assert.equal(persist.reason, 'user-allow-main');
});

test('callers can keep passing raw cfg objects or a route', () => {
    assert.equal(mechanicalCallConfig({ url: 'u', key: 'k' }).ok, true);
    assert.equal(mechanicalCallConfig({ url: '', key: '' }).reason, 'config-missing');
    const invalid = resolveUtilityRoute({ utilityPresetId: 'gone', presets: [], mainCfg: main });
    assert.equal(mechanicalCallConfig(invalid).ok, false);
    assert.equal(mechanicalCallConfig(invalid).reason, 'utility-route-invalid');
    assert.equal(utilitySkipReason({ status: 'paused' }), 'utility-route-paused');
    const snap = utilityRouteSnapshot(invalid);
    assert.equal(snap.presetId, 'gone');
    assert.equal(JSON.stringify(snap).includes('main-key'), false);
    assert.equal(JSON.stringify(snap).includes('https://'), false);
    assert.equal(utilityPresetDeleteImpact('p1', 'p1'), true);
    assert.equal(utilityPresetDeleteImpact('p1', 'p2'), false);
});
