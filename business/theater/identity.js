export function resolveTheaterRegen(piece, fallbackInput = '') {
    const input = String(piece?.request || fallbackInput || '').trim();
    return {
        input,
        templateSource: input && piece?.templateSource?.input
            ? { ...piece.templateSource, input: String(piece.templateSource.input).trim() }
            : null,
    };
}
