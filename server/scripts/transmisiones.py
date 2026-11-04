#!/usr/bin/env python3
# Cómo están saliendo las transmisiones en vivo: lo que cada transmisor nativo pone en sus atributos de LiveKit
# (placa, codificador y "fps/Mbps/permite" de cada 5 s del último minuto). Correr en el servidor:
#   python3 /opt/thunderop/transmisiones.py
import base64, hashlib, hmac, json, time, urllib.request

env = dict(l.strip().split('=', 1) for l in open('/opt/thunderop/thunderop.env') if '=' in l and not l.startswith('#'))
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()

def token(sala=''):
    # roomAdmin vale solo para la sala que nombra el token
    cuerpo = {'iss': env['LIVEKIT_API_KEY'], 'exp': int(time.time()) + 60, 'video': {'roomList': True, 'roomAdmin': True, 'room': sala}}
    datos = b64(b'{"alg":"HS256","typ":"JWT"}') + '.' + b64(json.dumps(cuerpo).encode())
    return datos + '.' + b64(hmac.new(env['LIVEKIT_API_SECRET'].encode(), datos.encode(), hashlib.sha256).digest())

def api(metodo, cuerpo):
    pedido = urllib.request.Request(f'http://127.0.0.1:7880/twirp/livekit.RoomService/{metodo}', json.dumps(cuerpo).encode(),
                                    {'Authorization': f'Bearer {token(cuerpo.get("room", ""))}', 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(pedido))

hay = False
for sala in api('ListRooms', {}).get('rooms', []):
    for p in api('ListParticipants', {'room': sala['name']}).get('participants', []):
        a = p.get('attributes', {})
        if 'equipo' in a:
            hay = True
            print(f"{p.get('name') or p['identity']}  (sala {sala['name']})\n  {a['equipo']}\n  fps/Mbps/permite: {a.get('fps/Mbps/permite', '')}\n")
if not hay:
    print('No hay transmisiones nativas en vivo.')
