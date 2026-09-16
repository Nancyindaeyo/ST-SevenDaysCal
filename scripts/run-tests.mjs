import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['node_modules', '.git']);

async function collect(dir, acc = []) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return acc;
    }
    for (const entry of entries) {
        if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await collect(path, acc);
        else if (entry.name.endsWith('.test.js')) acc.push(path);
    }
    return acc;
}

const root = fileURLToPath(new URL('..', import.meta.url));
const files = await collect(root);
if (!files.length) {
    console.error('no *.test.js found');
    process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
});
child.on('exit', code => process.exit(code ?? 1));
child.on('error', err => {
    console.error(err);
    process.exit(1);
});
