import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
let count = 0;
for (const directory of ['src', 'scripts', 'test']) {
  for (const file of await readdir(resolve(root, directory))) {
    if (!file.endsWith('.mjs')) continue;
    const result = spawnSync(process.execPath, ['--check', resolve(root, directory, file)], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
    count++;
  }
}
console.log(`${count} arquivos JavaScript validados.`);
