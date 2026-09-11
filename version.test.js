import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PLUGIN_VERSION } from './version.js';

test('runtime and manifest expose the same plugin version', async () => {
    const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
    assert.equal(PLUGIN_VERSION, '3.7.5');
    assert.equal(manifest.version, PLUGIN_VERSION);
});
