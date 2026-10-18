// npm run dev: LiveKit + PocketBase locales. Ctrl+C mata los dos.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(raiz, '.env.local');
if (!existsSync(envFile)) {
  writeFileSync(envFile, `LIVEKIT_API_KEY=dm${randomBytes(4).toString('hex')}\nLIVEKIT_API_SECRET=${randomBytes(32).toString('hex')}\n`);
  console.log('creado server/.env.local');
}
const cfg = Object.fromEntries(readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const { LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret } = cfg;

const hijos = [
  spawn(join(raiz, 'livekit-server.exe'), ['--config', 'livekit.yaml', '--bind', '127.0.0.1'],
    { cwd: raiz, stdio: 'inherit', env: { ...process.env, LIVEKIT_KEYS: `${key}: ${secret}` } }),
  spawn(join(raiz, 'pocketbase.exe'), ['serve', '--http=127.0.0.1:8090', '--migrationsDir', 'pb_migrations', '--hooksDir', 'pb_hooks'], {
    cwd: raiz, stdio: 'inherit',
    env: {
      ...process.env,
      LIVEKIT_URL: 'ws://127.0.0.1:7880',
      LIVEKIT_API_URL: 'http://127.0.0.1:7880',
      LIVEKIT_API_KEY: key,
      LIVEKIT_API_SECRET: secret,
    },
  }),
];

const matar = () => hijos.forEach((h) => h.exitCode === null && h.kill());
hijos.forEach((h) => h.once('exit', () => { matar(); process.exit(); })); // si uno cae, cae todo
process.on('SIGINT', matar);
process.on('SIGTERM', matar);
