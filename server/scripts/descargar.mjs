// Baja PocketBase y LiveKit y deja server/pocketbase.exe y server/livekit-server.exe (Windows, amd64).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(raiz, '.tmp');
mkdirSync(tmp, { recursive: true });

const PB = '0.40.5';
const LK = '1.13.10';
const bajar = [
  [`https://github.com/pocketbase/pocketbase/releases/download/v${PB}/pocketbase_${PB}_windows_amd64.zip`, 'pocketbase.exe'],
  [`https://github.com/livekit/livekit/releases/download/v${LK}/livekit_${LK}_windows_amd64.zip`, 'livekit-server.exe'],
];

for (const [url, exe] of bajar) {
  const zip = join(tmp, `${exe}.zip`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`descarga falló: ${res.status} ${url}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync(join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-xf', zip, '-C', raiz, exe]); // bsdtar de Windows (el tar de Git no lee zip)
  rmSync(zip);
  console.log(`listo: server/${exe}`);
}
