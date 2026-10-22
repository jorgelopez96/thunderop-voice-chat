import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

describe('vista previa de links', () => {
  it('rechaza lo que no es https público y pide sesión', async () => {
    const a = await h.nuevoUsuario('ana');
    const pedir = (url: string) => a.send('/api/vista-previa', { query: { url } });
    for (const url of ['http://example.com', 'https://127.0.0.1/', 'https://localhost/x', 'https://router.local/', 'https://[::1]/', 'javascript:alert(1)', 'https://intranet/', 'https://example.com:8443/', 'https://user@example.com/', 'https://a.example.local/']) {
      await expect(pedir(url), url).rejects.toMatchObject({ status: 400 });
    }
    await expect(new PocketBase(h.url).send('/api/vista-previa', { query: { url: 'https://example.com' } })).rejects.toMatchObject({ status: 401 });
  });
});

it('ipPrivada: redes internas, loopback, link-local, CGNAT y v6 locales', () => {
  // vista.js es CommonJS para la JSVM de PocketBase: se evalúa con un `module` propio.
  const mod = { exports: {} as { ipPrivada(ip: string): boolean } };
  new Function('module', readFileSync(new URL('../pb_hooks/vista.js', import.meta.url), 'utf8'))(mod);
  const { ipPrivada } = mod.exports;
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.100.1', '169.254.1.1', '100.124.225.226', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:192.168.0.1']) {
    expect(ipPrivada(ip), ip).toBe(true);
  }
  for (const ip of ['140.82.112.3', '186.182.74.6', '2606:4700::6810:84e5', '172.32.0.1']) expect(ipPrivada(ip), ip).toBe(false);
});
