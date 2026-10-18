import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase({ rateLimits: true }); });
afterAll(async () => { await h.stop(); });

describe('rate limits', () => {
  it('join is limited to 5 per minute', async () => {
    const b = await h.nuevoUsuario('beto');
    const estados: number[] = [];
    for (let i = 0; i < 6; i++) {
      await b.send('/api/invites/join', { method: 'POST', body: { code: 'nope' } }).catch((e) => estados.push(e.status));
    }
    expect(estados.slice(0, 5)).toEqual([404, 404, 404, 404, 404]);
    expect(estados[5]).toBe(429);
  });
});
