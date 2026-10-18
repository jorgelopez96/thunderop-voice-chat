// Entrega tokens de LiveKit para la prueba. El secreto viene de LIVEKIT_KEYS ("clave: secreto"),
// el mismo valor con el que arranca livekit-server (ver server/README.md).
import http from 'node:http';
import { AccessToken } from 'livekit-server-sdk';

// Solo la app (Tauri) y el frontend local; cualquier otra página web recibe 403.
// EXTRA_ORIGINS (separados por coma) habilita, por ejemplo, el frontend abierto desde el celular en la red local.
const ORIGENES = new Set(['http://localhost:1420', 'http://tauri.localhost', 'tauri://localhost',
  ...(process.env.EXTRA_ORIGINS ?? '').split(',').filter(Boolean)]);
const HOST = process.env.HOST ?? '127.0.0.1';

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
  // Mismo host por el que llegó el pedido: 127.0.0.1/localhost en la PC, la IP local desde el celular.
  const host = new URL(`http://${req.headers.host}`).hostname;
  const lk = `ws://${host === 'localhost' ? '127.0.0.1' : host}:7880`;
  res.end(JSON.stringify({ token: await at.toJwt(), url: lk }));
}).listen(7890, HOST, () => console.log(`tokens en http://${HOST}:7890/token?identity=<nombre>`));
