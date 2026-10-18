// Entrega tokens de LiveKit para la prueba. El secreto viene de LIVEKIT_KEYS ("clave: secreto"),
// el mismo valor con el que arranca livekit-server (ver server/README.md).
import http from 'node:http';
import { AccessToken } from 'livekit-server-sdk';

const URL_LK = 'ws://127.0.0.1:7880';
// Solo la app (Tauri) y el frontend local; cualquier otra página web recibe 403.
const ORIGENES = new Set(['http://localhost:1420', 'http://tauri.localhost', 'tauri://localhost']);

const [apiKey, apiSecret] = (process.env.LIVEKIT_KEYS ?? '').split(':').map((s) => s.trim());
if (!apiKey || !apiSecret) {
  console.error('Falta LIVEKIT_KEYS="clave: secreto" (el mismo que usa livekit-server)');
  process.exit(1);
}

http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (!ORIGENES.has(origin)) {
    res.writeHead(403).end('origen no permitido');
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  const identity = new URL(req.url, 'http://x').searchParams.get('identity');
  if (!identity) {
    res.writeHead(400).end('falta identity');
    return;
  }
  const at = new AccessToken(apiKey, apiSecret, { identity });
  at.addGrant({ room: 'prueba', roomJoin: true, canPublish: true, canSubscribe: true });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ token: await at.toJwt(), url: URL_LK }));
}).listen(7890, '127.0.0.1', () => console.log('tokens en http://127.0.0.1:7890/token?identity=<nombre>'));
