// npm run release -- midominio.duckdns.org: arma el instalador apuntando al servidor.
// Deja en app/release/ el instalador y latest.json: se copian a /opt/thunderop/descargas del servidor.
// Para publicar una actualización, subí antes "version" en src-tauri/tauri.conf.json.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dominio = process.argv[2];
if (!dominio) {
  console.error('Uso: npm run release -- midominio.duckdns.org');
  process.exit(1);
}
const conf = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const csp = conf.app.security.csp
  .replaceAll('http://127.0.0.1:8090', `https://${dominio}`)
  .replaceAll('ws://127.0.0.1:7880', `wss://${dominio}`);
const extra = join(tmpdir(), 'thunderop-release.json');
writeFileSync(extra, JSON.stringify({
  app: { security: { csp } },
  plugins: { updater: { endpoints: [`https://${dominio}/descargas/latest.json`] } },
}));

// Transmisor nativo: se compila y se copia donde lo busca `bundle.externalBin` (el target-dir .lkt de la raíz sale de nativo/transmisor/.cargo/config.toml).
const transmisor = fileURLToPath(new URL('../../nativo/transmisor/', import.meta.url));
execFileSync('cargo', ['build', '--release', '-j', '4'], { cwd: transmisor, stdio: 'inherit' });
const binarios = fileURLToPath(new URL('../src-tauri/binaries/', import.meta.url));
mkdirSync(binarios, { recursive: true });
copyFileSync(fileURLToPath(new URL('../../.lkt/release/transmisor.exe', import.meta.url)), join(binarios, 'transmisor-x86_64-pc-windows-msvc.exe'));

const tauri = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url));
execFileSync(process.execPath, [tauri, 'build', '--bundles', 'nsis', '--config', extra], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_PB_URL: `https://${dominio}`,
    // Sin esta clave no se pueden firmar actualizaciones: guardala con backup.
    TAURI_SIGNING_PRIVATE_KEY: process.env.TAURI_SIGNING_PRIVATE_KEY ?? join(homedir(), '.tauri', 'thunderop.key'),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? '',
  },
});

const nsis = fileURLToPath(new URL('../src-tauri/target/release/bundle/nsis/', import.meta.url));
const exe = readdirSync(nsis).find((f) => f.endsWith(`_${conf.version}_x64-setup.exe`));
const salida = fileURLToPath(new URL('../release/', import.meta.url));
mkdirSync(salida, { recursive: true });
copyFileSync(join(nsis, exe), join(salida, 'thunderop-setup.exe'));
writeFileSync(join(salida, 'latest.json'), JSON.stringify({
  version: conf.version,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: readFileSync(join(nsis, `${exe}.sig`), 'utf8'),
      url: `https://${dominio}/descargas/thunderop-setup.exe`,
    },
  },
}, null, 2));
console.log(`\nListo: ${salida}\nDescarga para tus amigos: https://${dominio}/descargas/thunderop-setup.exe`);
