import { createCoordinateRepository } from './repository.js';
import { createExcerptRepository } from './excerpt-repository.js';
import { createCoordinateFeature } from './feature.js';
import { createCoordinateHostPorts } from '../../runtime/coordinate-host-ports.js';

let singleton = null;
export function createCoordinateRuntime(options = {}) {
    if (singleton && !options.forceNew) return singleton;
    if (singleton && options.forceNew) singleton.destroy();
    const ports = options.ports || createCoordinateHostPorts(options.hostPorts);
    const repository = options.repository || createCoordinateRepository({ ports, warnBytes: options.warnBytes });
    const excerpts = options.excerpts || createExcerptRepository({ ports });
    const feature = createCoordinateFeature({ repository, excerpts, root: options.root, ports, host: options.host || {} });
    const migration = options.migration || (() => import('./legacy.js').then(({ migrateFromIndexedDB }) => migrateFromIndexedDB({ repository })));
    const migrationPromise = Promise.resolve().then(() => migration()).catch(error => { options.host?.warn?.('[SP anchor] legacy migration failed', error); return { failed: true, error }; });
    singleton = { ports, repository, excerpts, feature, migrationPromise, destroy() { feature.destroy(); if (singleton?.feature === feature) singleton = null; } };
    return singleton;
}
export function getCoordinateRuntime() { return singleton; }
