// Entrega tokens de LiveKit para la prueba. El secreto viene de LIVEKIT_KEYS ("clave: secreto"),
// el mismo valor con el que arranca livekit-server (ver server/README.md).
//
// Desde la propia PC (loopback) alcanza con un Origin permitido. Desde la red local (HOST=0.0.0.0)
// además hace falta LAN_PIN, porque un dispositivo de la red puede falsificar el Origin.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';

const ORIGENES = new Set(['http://localhost:1420', 'http://tauri.localhost', 'tauri://localhost',
  ...(process.env.EXTRA_ORIGINS ?? '').split(',').filter(Boolean)]);
const HOST = process.env.HOST ?? '127.0.0.1';
const LAN_IP = process.env.LAN_IP;   // IP de la PC en la red local; LiveKit para el celular
const LAN_PIN = process.env.LAN_PIN; // obligatorio si HOST no es loopback

const [apiKey, apiSecret] = (process.env.LIVEKIT_KEYS ?? '').split(':').map((s) => s.trim());
if (!apiKey || !apiSecret) {
  console.error('Falta LIVEKIT_KEYS="clave: secreto" (el mismo que usa livekit-server)');
  process.exit(1);
}
if (HOST !== '127.0.0.1' && (!LAN_IP || !LAN_PIN || LAN_PIN.length < 12)) {
  console.error('Escuchando en la red: faltan LAN_IP y LAN_PIN (12+ caracteres)');
  process.exit(1);
}

const esLoopback = (addr = '') => addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
const pinOk = (pin) =>
  typeof pin === 'string' && pin.length === LAN_PIN.length && timingSafeEqual(Buffer.from(pin), Buffer.from(LAN_PIN));

http.createServer(async (req, res) => {
  try {
    const origin = req.headers.origin;
    if (!ORIGENES.has(origin)) {
      res.writeHead(403).end('origen no permitido');
      return;
    }
    const local = esLoopback(req.socket.remoteAddress);
    const params = new URL(req.url, 'http://x').searchParams;
    if (!local && !pinOk(params.get('pin'))) {
      res.writeHead(403).end('pin inválido');
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    const identity = params.get('identity')?.slice(0, 40);
    if (!identity) {
      res.writeHead(400).end('falta identity');
      return;
    }
    const at = new AccessToken(apiKey, apiSecret, { identity });
    at.addGrant({ room: 'prueba', roomJoin: true, canPublish: true, canSubscribe: true });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ token: await at.toJwt(), url: `ws://${local ? '127.0.0.1' : LAN_IP}:7880` }));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(7890, HOST, () => console.log(`tokens en http://${HOST}:7890/token?identity=<nombre>`));
