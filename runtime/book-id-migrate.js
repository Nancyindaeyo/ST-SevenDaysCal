import { migrateLinesRaw, migratePointRaw } from '../business/identity-migrate.js';

async function writeIfChanged(env, { key, stored, plan }) {
    if (!plan.changed) return { status: 'none' };
    if (!key || typeof env.writeConfirmed !== 'function') return { status: 'skipped', reason: 'missing-writer' };
    const next = { ...(stored && typeof stored === 'object' ? stored : {}), raw: plan.raw, ts: Date.now() };
    const saved = await env.writeConfirmed(key, next, { ownerGuard: env.ownerGuard });
    if (saved === true || saved?.ok === true) return { status: 'migrated' };
    if (saved?.commitState === 'unknown' || saved?.reason === 'result-unknown') return { status: 'unknown', saveResult: saved };
    return { status: 'failed', saveResult: saved };
}

export async function migrateCanonicalBookIds(env = {}) {
    const chatId = env.chatId?.() ?? null;
    const ownerGuard = () => env.chatId?.() === chatId && env.ownerGuard?.() !== false;
    const writeConfirmed = env.writeConfirmed;
    const pointKey = env.pointKey?.();
    const linesKey = env.linesKey?.();
    const pointStored = pointKey ? env.read?.(pointKey) : null;
    const linesStored = linesKey ? env.read?.(linesKey) : null;
    const point = await writeIfChanged({ writeConfirmed, ownerGuard }, {
        key: pointKey,
        stored: pointStored,
        plan: migratePointRaw(pointStored?.raw),
    });
    if (env.chatId?.() !== chatId) return { status: 'superseded', point, lines: { status: 'skipped' } };
    const lines = await writeIfChanged({ writeConfirmed, ownerGuard }, {
        key: linesKey,
        stored: linesStored,
        plan: migrateLinesRaw(linesStored?.raw),
    });
    return { status: 'ready', point, lines };
}
