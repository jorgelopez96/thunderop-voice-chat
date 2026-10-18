import { startLiveKit, startPocketBase } from '../../server/tests/harness';

export default async function () {
  const lk = await startLiveKit();
  try {
    const pb = await startPocketBase({
      port: 8091,
      env: { LIVEKIT_URL: lk.wsUrl, LIVEKIT_API_URL: lk.apiUrl, LIVEKIT_API_KEY: lk.key, LIVEKIT_API_SECRET: lk.secret },
    });
    return async () => { await pb.stop(); await lk.stop(); };
  } catch (e) {
    await lk.stop();
    throw e;
  }
}
