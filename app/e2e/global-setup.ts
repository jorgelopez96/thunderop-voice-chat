import { createServer } from 'node:http';
import { startLiveKit, startPocketBase } from '../../server/tests/harness';

// Stub de oEmbed: los E2E nunca le preguntan a YouTube. El título es "Tema <id>".
function stubOembed(): Promise<{ url: string; stop(): Promise<void> }> {
  const srv = createServer((req, res) => {
    const watch = new URL(req.url ?? '/', 'http://x').searchParams.get('url') ?? '';
    const id = new URL(watch, 'http://x').searchParams.get('v') ?? '?';
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ title: `Tema ${id}` }));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address() as { port: number };
    ok({ url: `http://127.0.0.1:${port}/oembed`, stop: () => new Promise((r) => srv.close(() => r())) });
  }));
}

export default async function () {
  const oembed = await stubOembed();
  const lk = await startLiveKit().catch(async (e) => { await oembed.stop(); throw e; });
  try {
    const pb = await startPocketBase({
      port: 8091,
      env: { LIVEKIT_URL: lk.wsUrl, LIVEKIT_API_URL: lk.apiUrl, LIVEKIT_API_KEY: lk.key, LIVEKIT_API_SECRET: lk.secret, YOUTUBE_OEMBED: oembed.url },
    });
    return async () => { await pb.stop(); await lk.stop(); await oembed.stop(); };
  } catch (e) {
    await lk.stop();
    await oembed.stop();
    throw e;
  }
}
