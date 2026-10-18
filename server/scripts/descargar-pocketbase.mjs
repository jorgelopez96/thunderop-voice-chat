// Baja PocketBase y deja server/pocketbase.exe (Windows, amd64).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const VERSION = '0.40.5';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(raiz, '.tmp');
const zip = join(tmp, `pocketbase_${VERSION}.zip`);
mkdirSync(tmp, { recursive: true });

const url = `https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_windows_amd64.zip`;
const res = await fetch(url);
if (!res.ok) throw new Error(`descarga falló: ${res.status} ${url}`);
writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
execFileSync(join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-xf', zip, '-C', raiz, 'pocketbase.exe']); // bsdtar de Windows (el tar de Git no lee zip)
rmSync(zip);
console.log('listo: server/pocketbase.exe');
