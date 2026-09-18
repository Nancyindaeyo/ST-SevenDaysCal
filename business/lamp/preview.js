export const PATCH_ACTION_LABEL = Object.freeze({
    complete: '从今天拿掉 / 收束',
    postpone: '推迟',
    edit: '改描述',
    stall: '暂缓',
    add: '补上',
});

export function itemsFromAlignPreview(result = {}) {
    return Object.freeze((result.items || []).map(item => Object.freeze({
        module: item.module,
        title: String(item.title || '').trim(),
        ref: String(item.ref || '').trim(),
        action: item.action,
        id: `preview:${item.module}:${item.ref || item.title}`,
        detail: PATCH_ACTION_LABEL[item.action] || String(item.action || '改'),
        source: 'preview',
    })).filter(item => item.module && item.title));
}
