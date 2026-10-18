import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { startLiveKit } from './harness';

describe('livekit', () => {
  it('startLiveKit levanta y responde', async () => {
    const lk = await startLiveKit();
    const puerto = Number(new URL(lk.apiUrl).port);
    expect(puerto).not.toBe(7880);
    expect((await fetch(lk.apiUrl)).status).toBe(200);
    await lk.stop();
    await new Promise<void>((ok, fail) => {
      const s = createServer().once('error', fail).listen(puerto, '127.0.0.1', () => s.close(() => ok()));
    });
  });
});
