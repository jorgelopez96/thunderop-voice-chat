// Entrega tokens de LiveKit para la prueba. Credenciales de `livekit-server --dev`.
import http from 'node:http';
import { AccessToken } from 'livekit-server-sdk';

const URL_LK = 'ws://127.0.0.1:7880';

http.createServer(async (req, res) => {
  const identity = new URL(req.url, 'http://x').searchParams.get('identity');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!identity) {
    res.writeHead(400).end('falta identity');
    return;
  }
  const at = new AccessToken('devkey', 'secret', { identity });
  at.addGrant({ room: 'prueba', roomJoin: true, canPublish: true, canSubscribe: true });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ token: await at.toJwt(), url: URL_LK }));
}).listen(7890, '127.0.0.1', () => console.log('tokens en http://127.0.0.1:7890/token?identity=<nombre>'));
