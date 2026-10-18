import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import PocketBase from 'pocketbase';

export type Harness = {
  url: string;
  admin: PocketBase;
  nuevoUsuario(nombre: string): Promise<PocketBase>;
  stop(): Promise<void>;
};

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = join(raiz, 'pocketbase.exe');
const ADMIN = 'admin@test.local';
const PASS = 'admin-pass-1234';

function puertoLibre(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    }).on('error', fail);
  });
}

export async function startPocketBase(opts: { rateLimits?: boolean; port?: number } = {}): Promise<Harness> {
  mkdirSync(join(raiz, '.tmp'), { recursive: true });
  const dir = mkdtempSync(join(raiz, '.tmp', 'pb-'));
  // el dir se pasa tal cual; migrationsDir/hooksDir relativos a server/
  execFileSync(exe, ['superuser', 'upsert', ADMIN, PASS, '--dir', dir], { cwd: raiz, stdio: 'pipe' });
  const puerto = opts.port ?? await puertoLibre();
  const url = `http://127.0.0.1:${puerto}`;
  const proc: ChildProcess = spawn(
    exe,
    ['serve', `--http=127.0.0.1:${puerto}`, '--dir', dir, '--migrationsDir', 'pb_migrations', '--hooksDir', 'pb_hooks'],
    { cwd: raiz, stdio: 'ignore' },
  );
  const salida = new Promise<never>((_, fail) => proc.once('exit', (c) => fail(new Error(`pocketbase salió (${c})`))));
  const limpiar = async () => {
    if (proc.exitCode === null) {
      const muerto = new Promise((r) => proc.once('exit', r));
      proc.kill();
      await muerto;
    }
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  };

  try {
    const listo = (async () => {
      for (;;) {
        try { if ((await fetch(`${url}/api/health`)).ok) return; } catch { /* aún no */ }
        await new Promise((r) => setTimeout(r, 100));
      }
    })();
    await Promise.race([listo, salida]);

    const admin = new PocketBase(url);
    admin.autoCancellation(false);
    await admin.collection('_superusers').authWithPassword(ADMIN, PASS);
    if (!opts.rateLimits) await admin.settings.update({ rateLimits: { enabled: false } });

    return {
      url,
      admin,
      async nuevoUsuario(nombre) {
        const pb = new PocketBase(url);
        pb.autoCancellation(false);
        const email = `${nombre}-${randomBytes(4).toString('hex')}@test.local`;
        const password = randomBytes(8).toString('hex');
        await pb.collection('users').create({ email, password, passwordConfirm: password, name: nombre });
        await pb.collection('users').authWithPassword(email, password);
        return pb;
      },
      stop: limpiar,
    };
  } catch (e) {
    await limpiar();
    throw e;
  }
}
