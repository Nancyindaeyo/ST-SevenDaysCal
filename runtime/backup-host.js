import { createBackupController } from './backup.js';
import { createCoordinateHostPorts, readJson as readCoordinateJson, uploadJson as uploadCoordinateJson } from './coordinate-host-ports.js';

// 迁移包装配：坐标读写走 coordinate-host-ports，世界书走 getContext 上的 load/save。
// 不要反向去读坐标 runtime 或世界书宿主；失效回调和 getContext 由装配根注入。
export function createGouhuaBackupController(env = {}) {
    const getContext = env.getContext;
    const coordPorts = (env.createCoordinatePorts || createCoordinateHostPorts)({
        context: () => getContext?.(),
    });
    const readJson = env.readJson || readCoordinateJson;
    const uploadJson = env.uploadJson || uploadCoordinateJson;
    const createController = env.createController || createBackupController;
    return createController({
        pluginVersion: env.pluginVersion,
        getContext,
        getSettings: env.getSettings,
        saveSettings: env.saveSettings,
        localStorage: env.localStorage,
        storageStatus: env.storageStatus,
        getChatRoot: env.getChatRoot,
        persistExternalRoots: env.persistExternalRoots,
        fetch: env.fetch || ((...args) => globalThis.fetch(...args)),
        headers: env.headers || (() => getContext?.()?.getRequestHeaders?.() || { 'Content-Type': 'application/json' }),
        readJson: name => readJson(coordPorts, name),
        uploadJson: (name, value) => uploadJson(coordPorts, name, value),
        invalidateCoordinates: env.invalidateCoordinates,
        loadWorldInfo: env.loadWorldInfo || (name => getContext?.()?.loadWorldInfo?.(name)),
        saveWorldInfo: env.saveWorldInfo || ((name, data, immediate) => getContext?.()?.saveWorldInfo?.(name, data, immediate)),
        updateWorldInfoList: env.updateWorldInfoList || (() => getContext?.()?.updateWorldInfoList?.()),
        onProgress: env.onProgress,
    });
}
