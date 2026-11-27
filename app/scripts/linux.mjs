// node scripts/linux.mjs midominio.duckdns.org: arma la app de Linux (AppImage y .deb) apuntando al servidor.
// Corre en Linux (lo usa .github/workflows/linux.yml); deja los archivos en app/release/linux/.
// Por ahora sin autoactualizador: cada versión nueva se baja de nuevo.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dominio = process.argv.slice(2).find((x) => !x.startsWith('--'));
if (!dominio) {
  console.error('Uso: node scripts/linux.mjs midominio.duckdns.org');
  process.exit(1);
}
const conf = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const csp = conf.app.security.csp
  .replaceAll('http://127.0.0.1:8090', `https://${dominio}`)
  .replaceAll('ws://127.0.0.1:7880', `wss://${dominio}`);
const extra = join(tmpdir(), 'thunderop-linux.json');
writeFileSync(extra, JSON.stringify({ app: { security: { csp } } }));

const tauri = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url));
execFileSync(process.execPath, [tauri, 'build', '--config', extra], {
  stdio: 'inherit',
  env: { ...process.env, VITE_PB_URL: `https://${dominio}` },
});

const bundle = fileURLToPath(new URL('../src-tauri/target/release/bundle/', import.meta.url));
const salida = fileURLToPath(new URL('../release/linux/', import.meta.url));
mkdirSync(salida, { recursive: true });
for (const [dir, ext] of [['appimage', '.AppImage'], ['deb', '.deb']]) {
  const f = readdirSync(join(bundle, dir)).find((x) => x.endsWith(ext));
  copyFileSync(join(bundle, dir, f), join(salida, `thunderop-${conf.version}${ext}`));
}
console.log(`\nListo: ${salida}`);
