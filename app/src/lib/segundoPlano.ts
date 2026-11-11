// Llamada desde el celular: la pantalla no se apaga sola mientras dura, y la pantalla de bloqueo (o la notificación)
// muestra la sala con botones para el micrófono y para colgar. Si el navegador no tiene alguna de las dos cosas, no pasa nada.

/** `ponerMic(true)` prende el micrófono y `ponerMic(false)` lo apaga, esté como esté. */
type Acciones = { colgar: () => void; alternarMic: () => void; ponerMic: (prendido: boolean) => void };

let enLlamada = false;
let traba: WakeLockSentinel | null = null;
let pidiendo = false;

async function trabarPantalla() {
  if (!enLlamada || traba || pidiendo || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
  pidiendo = true;
  try {
    const t = await navigator.wakeLock.request('screen');
    if (!enLlamada) { void t.release(); return; }
    traba = t;
    // El sistema la suelta solo al ir a segundo plano; al volver se pide de nuevo.
    t.addEventListener('release', () => { if (traba === t) traba = null; });
  } catch { /* sin batería o sin permiso: la pantalla se apaga como siempre */ }
  finally { pidiendo = false; }
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => void trabarPantalla());

function accion(nombre: string, f: (() => void) | null) {
  try { navigator.mediaSession.setActionHandler(nombre as MediaSessionAction, f); } catch { /* acción que este navegador no conoce */ }
}

/** Entró a una sala. */
export function empezarLlamada(sala: string, muteado: boolean, a: Acciones) {
  enLlamada = true;
  void trabarPantalla();
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: sala || 'Llamada', artist: 'Thunderop',
      artwork: [{ src: '/icono-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icono-512.png', sizes: '512x512', type: 'image/png' }],
    });
  } catch { /* sin MediaMetadata */ }
  // Pausa y reproducir son los únicos botones que muestran todos: apagan y prenden el micrófono (sin esto, pausa
  // cortaría el sonido). Fijan el estado en vez de alternarlo: Android manda pausa solo (auriculares, otra llamada)
  // y alternar prendería un micrófono apagado sin que te enteres.
  accion('pause', () => a.ponerMic(false));
  accion('play', () => a.ponerMic(true));
  accion('togglemicrophone', a.alternarMic);
  accion('hangup', a.colgar);
  micEnPantalla(muteado);
}

/** Refleja el micrófono en la pantalla de bloqueo: "reproduciendo" = micrófono prendido. */
export function micEnPantalla(muteado: boolean) {
  if (!enLlamada || !('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = muteado ? 'paused' : 'playing';
  try { void navigator.mediaSession.setMicrophoneActive?.(!muteado); } catch { /* no lo tiene */ }
  const m = navigator.mediaSession.metadata;
  if (m) m.album = muteado ? 'Micrófono apagado' : 'Micrófono prendido';
}

/** Salió de la sala. */
export function terminarLlamada() {
  if (!enLlamada) return;
  enLlamada = false;
  void traba?.release().catch(() => {});
  traba = null;
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
  for (const n of ['pause', 'play', 'togglemicrophone', 'hangup']) accion(n, null);
}
