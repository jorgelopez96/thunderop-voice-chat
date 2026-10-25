import type { ProcesadorMic } from './ruido';
import type { LocalAudioTrack, Participant, RemoteTrack, Room, Track } from 'livekit-client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { pb } from './pb';
import { mensajeError } from './sesion.svelte';
import { leerPrefs, guardarPrefs, CALIDADES, type Calidad } from './prefs';
import { iniciarAudioPantalla, detenerAudioPantalla } from './audioPantalla';
import { mensajeTransmision } from './transmision';
import { duenio, esPantallaNativa, iniciarNativo, detenerNativo, calidadNativo, cortarSimulado, SUFIJO_PANTALLA } from './transmisorNativo';

/** `silenciado`: no está mandando audio (muteado, sin permiso del dueño o sin micrófono publicado). */
/** `pantalla`: sid de la pantalla que comparte. `espectadores`: cuántos lo están mirando. */
export type Participante = { id: string; nombre: string; hablando: boolean; silenciado: boolean; local: boolean; transmite: boolean; pantalla: string | undefined; espectadores: number };

/** `sinPermiso`: el dueño nos silenció (los permisos de LiveKit no dejan publicar el micrófono). `viendo`: sids de las pantallas que miramos
 *  (en el orden en que se eligieron). */
export const voz = $state<{ salaId: string | null; salaNombre: string; grupoId: string | null; conectando: boolean; error: string; muteado: boolean; ensordecido: boolean; sinPermiso: boolean; supresion: boolean; participantes: Participante[]; senal: 'buena' | 'regular' | 'mala'; transmitiendo: boolean; viendo: string[]; vistaPrevia: boolean; calidadEnVivo: Calidad | null }>({
  salaId: null, salaNombre: '', grupoId: null, conectando: false, error: '', muteado: false, ensordecido: false, sinPermiso: false, supresion: leerPrefs().supresion, participantes: [], senal: 'buena', transmitiendo: false, viendo: [], vistaPrevia: leerPrefs().vistaPrevia, calidadEnVivo: null,
});

// LiveKit se carga recién al entrar a la voz: el arranque de la app no lo paga. Mientras haya `room`, `lk` está cargado.
let lk: typeof import('livekit-client');
let room: Room | null = null;
let ctx: AudioContext | null = null;
let intento = 0; // invalida un `entrarVoz` en curso si se sale o se entra a otra sala
const audios = new WeakMap<RemoteTrack, HTMLMediaElement>(); // <audio data-voz> creado por cada pista remota

// Ganchos para la botonera (sin lógica de ella acá): contexto/sala actuales y listeners de datos que sobreviven a los cambios de sala.
type OyenteDatos = (payload: Uint8Array, topic?: string) => void;
const oyentesDatos = new Set<OyenteDatos>();
export const contextoVoz = () => ctx;
/** Publica datos a la sala (false si no hay sala conectada). */
export async function publicarDatos(data: Uint8Array<ArrayBuffer>, topic: string) {
  if (!room || voz.conectando) return false;
  try { await room.localParticipant.publishData(data, { reliable: true, topic }); return true; } catch { return false; }
}
/** Escucha `DataReceived` de cualquier sala presente o futura. Devuelve la función para dejar de escuchar. */
export function alRecibirDatos(f: OyenteDatos) { oyentesDatos.add(f); return () => { oyentesDatos.delete(f); }; }
// Gancho para la música: sala conectada (id) o ninguna (null, en `limpiar`).
type OyenteSala = (salaId: string | null) => void;
const oyentesSala = new Set<OyenteSala>();
const avisarSala = (id: string | null) => { for (const f of oyentesSala) f(id); };
export function alCambiarSala(f: OyenteSala) { oyentesSala.add(f); return () => { oyentesSala.delete(f); }; }

const microfono = () => room?.localParticipant.getTrackPublication(lk.Track.Source.Microphone)?.track as LocalAudioTrack | undefined;

function actualizar() {
  if (!room) { voz.participantes = []; voz.sinPermiso = false; return; }
  const r = room;
  const mirando = [...r.remoteParticipants.values()].flatMap(mirandoDe);
  const p = (x: Participant, local: boolean): Participante => {
    const pantalla = pantallaDe(r, x);
    return { id: x.identity, nombre: x.name || x.identity, hablando: x.isSpeaking, silenciado: !x.isMicrophoneEnabled, local,
      transmite: !!pantalla || (local && voz.transmitiendo), pantalla, espectadores: mirando.filter((m) => duenio(m) === x.identity).length };
  };
  // El transmisor nativo no es una persona: su pantalla se le muestra a su dueño.
  voz.participantes = [p(r.localParticipant, true), ...[...r.remoteParticipants.values()].filter((x) => !esPantallaNativa(x.identity)).map((x) => p(x, false))];
  // Misma regla que usa LiveKit para dejar publicar (sin fuentes listadas = todas permitidas).
  const perm = room.localParticipant.permissions;
  voz.sinPermiso = !!perm && (!perm.canPublish || (perm.canPublishSources.length > 0
    && !perm.canPublishSources.map(lk.Track.sourceFromProto).includes(lk.Track.Source.Microphone)));
  previaNativa(r)?.setSubscribed(nativo && voz.transmitiendo && voz.vistaPrevia);
}

/** La pantalla del transmisor nativo propio. Para la vista previa hay que suscribirse (bajarla entera: sin simulcast
 *  el servidor no la achica), así que solo mientras se muestra. */
const previaNativa = (r: Room) => r.remoteParticipants.get(r.localParticipant.identity + SUFIJO_PANTALLA)?.getTrackPublication(lk.Track.Source.ScreenShare);

/** Publica el micrófono si el usuario no está muteado. Sin permiso del dueño (403 de LiveKit) falla en silencio: queda `silenciado`. */
async function publicarMic() {
  if (!room || voz.muteado) return;
  try {
    // Un string es "exacto, y si no está, cualquiera" en LiveKit: un micrófono guardado que ya no existe cae al predeterminado.
    // No se consulta enumerateDevices antes: sin permiso de micrófono WebView2 oculta los ids y se perdería el guardado.
    await room.localParticipant.setMicrophoneEnabled(true, { deviceId: leerPrefs().entrada ?? 'default', noiseSuppression: false, echoCancellation: true, autoGainControl: true }, { dtx: false });
  } catch (e) {
    const n = (e as Error)?.name;
    if (n === 'NotAllowedError') voz.error = 'No hay permiso para usar el micrófono.';
    else if (n === 'NotFoundError' || n === 'OverconstrainedError') voz.error = 'No se encontró un micrófono.';
    else if (!(n === 'PublishTrackError' && (e as { status?: number }).status === 403)) voz.error = 'No se pudo usar el micrófono.';
  }
  actualizar();
}

// En serie: LiveKit recién registra el procesador cuando termina su init (import + wasm), así que dos
// cambios rápidos sin cola pondrían dos procesadores. Cada paso decide al llegar su turno.
let cola = Promise.resolve();
function aplicarProcesador() {
  cola = cola.then(async () => {
    const t = microfono();
    if (!t) return;
    const op = { supresion: voz.supresion, gananciaDb: leerPrefs().gananciaDb };
    try {
      let p = t.getProcessor() as ProcesadorMic | undefined;
      if (p) await p.ajustar(op);
      else { p = (await import('./ruido')).crearProcesador(op); await t.setProcessor(p); }
      if (p.fallo) voz.error = `No se pudo activar la supresión de ruido (${p.fallo}). El micrófono anda igual.`;
    } catch (e) { console.error(e); voz.error = `No se pudo activar el procesador del micrófono (${e instanceof Error ? e.message : e}).`; }
  });
  return cola;
}

/** Corta la sala actual y la olvida. El contexto se cierra después de desconectar (LiveKit desarma el procesador ahí). */
function limpiar() {
  const r = room, c = ctx;
  room = null; ctx = null; tx++;
  if (typeof document !== 'undefined') for (const el of document.querySelectorAll('audio[data-voz]')) el.remove();
  if (voz.ensordecido && !muteadoAntes) voz.muteado = false; // la sordera no deja el mic apagado para la próxima sala
  Object.assign(voz, { salaId: null, salaNombre: '', grupoId: null, conectando: false, ensordecido: false, sinPermiso: false, participantes: [], senal: 'buena', transmitiendo: false, viendo: [] });
  void detenerAudioPantalla();
  if (nativo) { nativo = false; voz.calidadEnVivo = null; void detenerNativo(); }
  avisarSala(null);
  (r?.disconnect() ?? Promise.resolve()).catch(() => {}).finally(() => c?.close().catch(() => {}));
}

export async function entrarVoz(roomId: string, salaNombre = '', grupoId: string | null = null) {
  salirVoz();
  const mio = ++intento;
  // El contexto se crea antes de cualquier await, dentro del gesto del usuario (autoplay). 48 kHz: lo exige RNNoise.
  const c = new AudioContext({ sampleRate: 48000 });
  ctx = c;
  Object.assign(voz, { salaId: roomId, salaNombre, grupoId, conectando: true, error: '' });
  const vigente = () => mio === intento;
  try { if (!lk) lk = await import('livekit-client'); }
  catch { if (vigente()) { voz.error = 'No se pudo conectar a la voz.'; salirVoz(); } return; }
  if (!vigente()) return;
  const { Room, RoomEvent, Track } = lk;
  const r = new Room({ adaptiveStream: true, dynacast: true, webAudioMix: { audioContext: c } });
  room = r;

  // Tono corto que va de `desde` a `hasta` Hz, `en` segundos desde ahora. Ensordecido no suena.
  const tono = (desde: number, hasta: number, en = 0) => {
    if (voz.ensordecido) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + en;
    o.frequency.setValueAtTime(desde, t);
    o.frequency.linearRampToValueAtTime(hasta, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.2);
  };
  // Al entrar alguien (o yo) sube; al irse baja.
  const pitido = (sube: boolean) => (sube ? tono(520, 780) : tono(700, 460));
  r.on(RoomEvent.Connected, () => pitido(true));
  // Calidad de mi conexión (la mide LiveKit): excelente o buena = verde, pobre = naranja, perdida o reconectando = rojo.
  r.on(RoomEvent.ConnectionQualityChanged, (q, part) => {
    if (part.identity === r.localParticipant.identity) voz.senal = q === 'poor' ? 'regular' : q === 'lost' ? 'mala' : 'buena';
  });
  r.on(RoomEvent.Reconnecting, () => (voz.senal = 'mala'));
  r.on(RoomEvent.Reconnected, () => (voz.senal = 'buena'));
  r.on(RoomEvent.ParticipantConnected, (x) => { if (!esPantallaNativa(x.identity)) pitido(true); });
  r.on(RoomEvent.ParticipantDisconnected, (x) => { if (!esPantallaNativa(x.identity)) pitido(false); });
  // Alguien empieza a transmitir: dos notas que suben. A quien transmite: una nota aguda cuando alguien se pone a mirarlo.
  r.on(RoomEvent.TrackPublished, (pub) => { if (pub.source === Track.Source.ScreenShare) { tono(660, 660); tono(990, 990, 0.14); } });
  const meMiran = new Set<string>();
  r.on(RoomEvent.ParticipantAttributesChanged, (cambios, part) => {
    if (part === r.localParticipant || cambios.mirando === undefined) return;
    const mira = mirandoDe(part).map(duenio).includes(r.localParticipant.identity);
    if (mira && !meMiran.has(part.identity)) tono(1100, 1320);
    if (mira) meMiran.add(part.identity); else meMiran.delete(part.identity);
  });
  r.on(RoomEvent.TrackSubscribed, (t: RemoteTrack, _pub, part) => {
    if (t.kind !== Track.Kind.Audio) return;
    const el = t.attach(); el.dataset.voz = ''; document.body.append(el); audios.set(t, el);
    part.setVolume(voz.ensordecido ? 0 : ganancia(leerPrefs().volumenes[part.identity]));
  });
  // LiveKit ya desenganchó la pista de todos sus elementos (también el <video> de la vista): se borra solo el <audio> propio.
  r.on(RoomEvent.TrackUnsubscribed, (t: RemoteTrack) => { audios.get(t)?.remove(); audios.delete(t); });
  // Suscripción manual: micrófonos siempre; pantallas solo las que se miran (`ver`), y su audio aunque llegue después.
  r.on(RoomEvent.TrackPublished, (pub, part) => {
    if (pub.source === Track.Source.Microphone || (pub.source === Track.Source.ScreenShareAudio && miroA(r, part))) pub.setSubscribed(true);
  });
  // Red de seguridad: tras una reconexión (o una suscripción que falló) algún micrófono podía quedar sin suscribir y dejaba
  // de escucharse a esa persona hasta que saliera y volviera. Se revisa al reconectar, al fallar y cada 10 s.
  r.on(RoomEvent.Reconnected, () => asegurarSuscripciones(r));
  r.on(RoomEvent.TrackSubscriptionFailed, () => setTimeout(() => asegurarSuscripciones(r), 2000));
  const revisar = setInterval(() => (room === r ? asegurarSuscripciones(r) : clearInterval(revisar)), 10_000);
  r.on(RoomEvent.TrackUnpublished, (pub) => { if (voz.viendo.includes(pub.trackSid)) aplicarVista(voz.viendo.filter((s) => s !== pub.trackSid)); });
  r.on(RoomEvent.ParticipantDisconnected, () => aplicarVista(voz.viendo.filter((s) => pubPantalla(s))));
  r.on(RoomEvent.DataReceived, (payload, part, _kind, topic) => {
    // El dueño nos movió a otra sala: el aviso lo manda el servidor (sin participante), nunca otro usuario.
    if (topic === 'mover' && !part) {
      try {
        const { sala, nombre } = JSON.parse(new TextDecoder().decode(payload));
        if (typeof sala === 'string' && sala !== voz.salaId) void entrarVoz(sala, typeof nombre === 'string' ? nombre : '', voz.grupoId);
      } catch { /* aviso roto: se ignora */ }
      return;
    }
    for (const f of oyentesDatos) f(payload, topic);
  });
  r.on(RoomEvent.LocalTrackPublished, () => { aplicarProcesador(); actualizar(); });
  r.on(RoomEvent.ParticipantPermissionsChanged, (_prev, part) => {
    // El dueño nos des-silenció: se vuelve a publicar el micrófono (LiveKit lo despublicó al silenciar).
    if (part === r.localParticipant && !r.localParticipant.isMicrophoneEnabled) publicarMic();
    actualizar();
  });
  for (const ev of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged,
    RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
    RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantNameChanged, RoomEvent.ParticipantAttributesChanged, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed]) r.on(ev, actualizar);
  // Desconexión iniciada por el servidor (echado, sala borrada) o red perdida sin recuperación. Si salimos
  // nosotros (`salirVoz`), el intento ya no está vigente y no hay aviso. `limpiar` no toca `voz.error`.
  r.on(RoomEvent.Disconnected, (motivo) => {
    if (!vigente()) return;
    const D = lk.DisconnectReason;
    if (motivo !== D.CLIENT_INITIATED) {
      voz.error = motivo === D.PARTICIPANT_REMOVED ? 'Te sacaron de la llamada.'
        : motivo === D.ROOM_DELETED ? 'La sala de voz se borró.'
        : motivo === D.DUPLICATE_IDENTITY ? 'Entraste a la voz desde otra ventana.'
        : 'Se perdió la conexión de voz.';
    }
    salirVoz();
  });

  let token: string, url: string;
  try {
    ({ token, url } = await pb.send(`/api/rooms/${roomId}/token`, { method: 'POST' }));
  } catch (e) {
    if (vigente()) { voz.error = mensajeError(e); salirVoz(); }
    return;
  }
  try {
    if (!vigente()) return;
    await r.connect(url, token, { autoSubscribe: false });
  } catch {
    if (vigente()) { voz.error = 'No se pudo conectar a la voz.'; salirVoz(); }
    return;
  }
  if (!vigente()) { r.disconnect(); return; } // por si el connect terminó pese al disconnect de limpiar()
  voz.conectando = false;
  avisarSala(roomId);
  for (const p of r.remoteParticipants.values()) for (const pub of p.trackPublications.values()) if (pub.source === Track.Source.Microphone) pub.setSubscribed(true);
  actualizar();
  await publicarMic();
  // La salida va después del micrófono: recién con el permiso concedido se ven los ids de los dispositivos.
  // Si la guardada ya no existe, se sigue con la predeterminada.
  const salida = leerPrefs().salida;
  if (!salida || !vigente()) return;
  const hay = await navigator.mediaDevices.enumerateDevices().then((d) => d.some((x) => x.kind === 'audiooutput' && x.deviceId === salida), () => false);
  if (hay && vigente()) r.switchActiveDevice('audiooutput', salida).catch(() => {});
}

export function salirVoz() {
  intento++;
  limpiar();
}

export async function alternarMute() {
  voz.muteado = !voz.muteado;
  if (!voz.muteado && voz.ensordecido) { voz.ensordecido = false; aplicarSordera(); } // prender el mic también devuelve el sonido
  if (!room) return;
  if (voz.muteado) await room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
  else await publicarMic();
  actualizar();
}

export async function cambiarSupresion(si: boolean) {
  voz.supresion = si;
  guardarPrefs({ supresion: si });
  await aplicarProcesador();
}

/** Ganancia del micrófono en dB (−20 a +20), después de la supresión. Se guarda y se aplica en vivo. */
export async function cambiarGanancia(db: number) {
  guardarPrefs({ gananciaDb: db });
  await aplicarProcesador();
}

export async function elegirEntrada(deviceId: string) {
  guardarPrefs({ entrada: deviceId });
  await room?.switchActiveDevice('audioinput', deviceId).catch(() => {}); // el procesador se reinicia solo (restart)
}

export async function elegirSalida(deviceId: string) {
  guardarPrefs({ salida: deviceId });
  await room?.switchActiveDevice('audiooutput', deviceId).catch(() => {});
}

// El 100% de la barrita es el doble de lo que llega (con todos al 200% se pidió que ese fuera el 100% nuevo).
// Con webAudioMix la ganancia puede pasar de 1.
const ganancia = (v: number | undefined) => (v ?? 1) * 2;

/** Volumen de un usuario como lo muestra la barrita (0 a 2 = 0% a 200%). Se guarda en prefs. */
export function volumen(userId: string, v: number) {
  if (!Number.isFinite(v)) return;
  v = Math.min(2, Math.max(0, v));
  guardarPrefs({ volumenes: { [userId]: v } });
  if (!voz.ensordecido) room?.remoteParticipants.get(userId)?.setVolume(ganancia(v));
}

/** Ensordecerse (auriculares): no escucho a nadie y apago el micrófono; al volver, el micrófono vuelve como estaba. */
let muteadoAntes = false;
function aplicarSordera() {
  const vols = leerPrefs().volumenes;
  for (const p of room?.remoteParticipants.values() ?? []) p.setVolume(voz.ensordecido ? 0 : ganancia(vols[p.identity]));
}
export async function ensordecer(si: boolean) {
  voz.ensordecido = si;
  aplicarSordera();
  if (si) { muteadoAntes = voz.muteado; if (!voz.muteado) await alternarMute(); }
  else if (voz.muteado && !muteadoAntes) await alternarMute();
}

/** Suscribe lo que tiene que estar suscrito y no lo está: todos los micrófonos y las pantallas que se miran (con su sonido). */
function asegurarSuscripciones(r: Room) {
  if (r.state !== lk.ConnectionState.Connected) return;
  for (const p of r.remoteParticipants.values()) {
    const miro = miroA(r, p);
    for (const pub of p.trackPublications.values()) {
      const quiero = pub.source === lk.Track.Source.Microphone || voz.viendo.includes(pub.trackSid) || (miro && pub.source === lk.Track.Source.ScreenShareAudio);
      if (quiero && !pub.isSubscribed) pub.setSubscribed(true);
    }
  }
}

/** Sid de la pantalla que comparte `x`: la suya o la de su transmisor nativo. La propia nativa no (no nos miramos). */
function pantallaDe(r: Room, x: Participant) {
  const suya = x.getTrackPublication(lk.Track.Source.ScreenShare)?.trackSid;
  if (suya || x === r.localParticipant) return suya;
  return r.remoteParticipants.get(x.identity + SUFIJO_PANTALLA)?.getTrackPublication(lk.Track.Source.ScreenShare)?.trackSid;
}
/** ¿Miramos alguna pantalla de `x` (la suya o la de su transmisor nativo)? Su sonido va con ella. */
function miroA(r: Room, x: Participant) {
  const nat = r.remoteParticipants.get(x.identity + SUFIJO_PANTALLA);
  return voz.viendo.some((s) => x.trackPublications.has(s) || !!nat?.trackPublications.has(s));
}

// El atributo `mirando` lleva las identidades de quienes miro, separadas por coma.
// Quien tiene la 0.4.0 pone la identidad del transmisor nativo (`<id>.pantalla`) y no la del dueño: se cuenta igual.
const mirandoDe = (x: Participant) => (x.attributes.mirando ?? '').split(',').filter(Boolean);

async function despublicarAudio(r: Room) {
  const t = r.localParticipant.getTrackPublication(lk.Track.Source.ScreenShareAudio)?.track;
  if (t) await r.localParticipant.unpublishTrack(t).catch(() => {});
}

// En la bandeja y sin llamada, WebView2 libera memoria; al abrir la ventana vuelve a lo normal (lib.rs).
if ('__TAURI_INTERNALS__' in globalThis) {
  void getCurrentWindow().listen('a-la-bandeja', () => {
    if (!voz.salaId) import('@tauri-apps/api/core').then(({ invoke }) => invoke('memoria_baja')).catch(() => {});
  });
}

// `tx` invalida un `transmitir` en curso (cortar, salir de la sala o que el transmisor termine).
// `arrancando` rechaza un segundo `transmitir` (doble clic) hasta que termine el primero:
// el audio nativo es uno solo y una llamada vieja no puede publicar otra pista ni frenar la captura de una nueva.
let tx = 0;
let arrancando = false;
let nativo = false; // hay una transmisión andando

/** `fuente`: un monitor o una ventana (ids de `fuentes_transmisor`); `id: 'pantalla'` es el monitor principal.
 *  `pid`: el programa de la ventana, para mandar solo su sonido. */
export async function transmitir(calidad: Calidad, fuente: { tipo: 'monitor' | 'ventana'; id: string; pid: number }) {
  const r = room, c = ctx;
  if (!r || !c || voz.transmitiendo || arrancando) return;
  arrancando = true;
  try { await arrancarNativo(r, c, ++tx, calidad, fuente); }
  finally { arrancando = false; }
}

async function arrancarNativo(r: Room, c: AudioContext, mio: number, calidad: Calidad, fuente: { tipo: 'monitor' | 'ventana'; id: string; pid: number }) {
  const vigente = () => room === r && mio === tx;
  const { alto, fps, mbps } = CALIDADES[calidad];
  const que = fuente.id === 'pantalla' ? 'pantalla' : `${fuente.tipo}:${fuente.id}`;
  voz.error = '';
  let url: string, token: string;
  try { ({ token, url } = await pb.send(`/api/rooms/${voz.salaId}/token-pantalla`, { method: 'POST' })); }
  catch { if (vigente()) voz.error = mensajeTransmision(5); return; }
  if (!vigente()) return;
  const res = await iniciarNativo({ url, token, que, fps, mbps, alto }, (codigo) => {
    // Terminó después de arrancar: se cerró la ventana (0), se rindió (4) o se cayó.
    if (!vigente() || !nativo) return;
    tx++;
    nativo = false;
    voz.calidadEnVivo = null;
    voz.transmitiendo = false;
    void detenerAudioPantalla();
    void despublicarAudio(r);
    actualizar();
    voz.error = mensajeTransmision(codigo);
  });
  if (res !== 'ok') { if (vigente()) voz.error = mensajeTransmision(res); return; }
  if (!vigente()) { void detenerNativo(); return; }
  nativo = true;
  voz.calidadEnVivo = calidad;
  voz.transmitiendo = true;
  guardarPrefs({ calidad });
  actualizar();
  await compartirSonido(r, c, vigente, fuente.tipo === 'ventana' ? fuente.pid : undefined);
}

/** Cambia la calidad de la transmisión nativa sin cortarla (`voz.calidadEnVivo` dice si se puede). */
export async function cambiarCalidad(calidad: Calidad) {
  if (!nativo || calidad === voz.calidadEnVivo) return;
  const { alto, fps, mbps } = CALIDADES[calidad];
  if (!await calidadNativo(fps, mbps, alto)) { voz.error = 'No se pudo cambiar la calidad.'; return; }
  // ponytail: por software el transmisor topea en 720p30 y el rótulo puede decir más; el frontend recién ve el registro al terminar (Estado 'fin'), no en vivo. Si molesta, que el transmisor emita un evento con el codificador.
  voz.calidadEnVivo = calidad;
  guardarPrefs({ calidad });
}

/** Sonido de la PC (captura nativa de audio.rs), publicado desde la identidad del usuario. */
async function compartirSonido(r: Room, c: AudioContext, vigente: () => boolean, pid?: number) {
  const t = await iniciarAudioPantalla(c, pid);
  // Mientras arrancaba el audio se pudo salir de la sala o cortar la transmisión: no queda captura huérfana.
  if (!vigente()) { await detenerAudioPantalla(); return; }
  if (!t) { if ('__TAURI_INTERNALS__' in globalThis) voz.error = 'No se pudo compartir el sonido de la PC.'; return; }
  try {
    await r.localParticipant.publishTrack(t, { source: lk.Track.Source.ScreenShareAudio, dtx: false, red: false, audioPreset: lk.AudioPresets.musicHighQualityStereo, forceStereo: true });
  } catch {
    await detenerAudioPantalla();
    if (vigente()) voz.error = 'No se pudo compartir el sonido de la PC.';
    return;
  }
  if (!vigente()) { await despublicarAudio(r); await detenerAudioPantalla(); }
}

export async function dejarDeTransmitir() {
  const r = room;
  if (!r) return;
  tx++;
  if (!nativo) return;
  nativo = false;
  voz.calidadEnVivo = null;
  voz.transmitiendo = false;
  void detenerNativo();
  void detenerAudioPantalla();
  await despublicarAudio(r);
  actualizar();
}

const pubPantalla = (sid: string) => {
  for (const p of room?.remoteParticipants.values() ?? []) { const pub = p.trackPublications.get(sid); if (pub) return { p, pub }; }
};

/** Suma (`si`) o saca la pantalla `sid` (de cualquiera de la sala) de las que se miran. */
export function ver(sid: string, si: boolean) {
  const lista = voz.viendo.filter((s) => s !== sid);
  if (si) lista.push(sid);
  aplicarVista(lista);
}

// Solo se suscribe a las pantallas que se miran, y al sonido de quienes las comparten. El atributo `mirando`
// (identidades) le sirve al resto para contar espectadores (necesita canUpdateOwnMetadata en el token).
function aplicarVista(lista: string[]) {
  for (const s of voz.viendo) if (!lista.includes(s)) pubPantalla(s)?.pub.setSubscribed(false);
  voz.viendo = lista;
  const r = room;
  if (!r) return;
  for (const s of lista) pubPantalla(s)?.pub.setSubscribed(true);
  const personas = [...new Set(lista.map((s) => pubPantalla(s)?.p.identity).filter((x): x is string => !!x).map(duenio))];
  for (const p of r.remoteParticipants.values()) p.getTrackPublication(lk.Track.Source.ScreenShareAudio)?.setSubscribed(personas.includes(p.identity));
  r.localParticipant.setAttributes({ mirando: personas.join(',') }).catch(() => {});
}

/** Pista de video de la pantalla `sid` (si ya está suscrita, para hacerle `attach`) y de quién es. */
export function pistaPantalla(sid: string): { pista: RemoteTrack | undefined; identidad: string } | undefined {
  const x = pubPantalla(sid);
  return x && { pista: x.pub.track as RemoteTrack | undefined, identidad: duenio(x.p.identity) };
}

/** Pista de video de nuestra propia transmisión, para la vista previa. */
export function pistaPantallaPropia(): RemoteTrack | undefined {
  return room && nativo ? previaNativa(room)?.track as RemoteTrack | undefined : undefined;
}

/** Muestra u oculta la vista previa de nuestra transmisión (se guarda). */
export function vistaPrevia(v: boolean) { voz.vistaPrevia = v; guardarPrefs({ vistaPrevia: v }); actualizar(); }

/** Volumen del sonido de la pantalla de `identidad` (0 a 2). No se guarda. */
export function volumenPantalla(identidad: string, v: number) {
  if (!Number.isFinite(v)) return;
  room?.remoteParticipants.get(identidad)?.setVolume(Math.min(2, Math.max(0, v)), lk.Track.Source.ScreenShareAudio);
}

export async function dispositivos(): Promise<{ entradas: MediaDeviceInfo[]; salidas: MediaDeviceInfo[] }> {
  try {
    const d = await navigator.mediaDevices.enumerateDevices();
    return { entradas: d.filter((x) => x.kind === 'audioinput'), salidas: d.filter((x) => x.kind === 'audiooutput') };
  } catch { return { entradas: [], salidas: [] }; }
}

// Solo para los E2E (en el build de producción no existe): micrófono local y, por nombre de cada
// remoto, si publica micrófono y los bytes de audio recibidos de él; frames de cada pantalla y si transmitimos.
if (import.meta.env.DEV) {
  (globalThis as unknown as { __voz: unknown }).__voz = {
    terminarCaptura: cortarSimulado,
    async stats() {
      const remotos: Record<string, { mic: boolean; bytes: number }> = {};
      for (const p of room?.remoteParticipants.values() ?? []) {
        const pub = p.getTrackPublication(lk.Track.Source.Microphone);
        let bytes = 0;
        (await pub?.track?.getRTCStatsReport())?.forEach((s) => { if (s.type === 'inbound-rtp') bytes += s.bytesReceived ?? 0; });
        remotos[p.name || p.identity] = { mic: !!pub && !pub.isMuted, bytes };
      }
      const pantallas: Record<string, { frames: number }> = {};
      for (const p of room?.remoteParticipants.values() ?? []) {
        const pub = p.getTrackPublication(lk.Track.Source.ScreenShare);
        if (!pub) continue;
        let frames = 0;
        (await pub.track?.getRTCStatsReport())?.forEach((s) => { if (s.type === 'inbound-rtp' && s.kind === 'video') frames += s.framesDecoded ?? 0; });
        pantallas[p.name || p.identity] = { frames };
      }
      return { mic: room?.localParticipant.isMicrophoneEnabled ?? false, remotos, pantallas, transmitiendo: voz.transmitiendo };
    },
  };
}

/** Solo el dueño: lleva a un miembro que está en la llamada a otra sala de voz del grupo. */
export async function moverA(groupId: string, userId: string, sala: string) {
  await pb.send(`/api/groups/${groupId}/mover`, { method: 'POST', body: { user: userId, sala } });
}

/** Solo el dueño: saca a un miembro de la voz y no lo deja volver (`bloqueado`), o lo vuelve a dejar. */
export async function bloquearVoz(groupId: string, userId: string, bloqueado: boolean) {
  await pb.send(`/api/groups/${groupId}/bloquear-voz`, { method: 'POST', body: { user: userId, bloqueado } });
}

/** Solo el dueño: saca a un miembro de la llamada (puede volver a entrar). */
export async function desconectar(groupId: string, userId: string) {
  await pb.send(`/api/groups/${groupId}/desconectar`, { method: 'POST', body: { user: userId } });
}

/** Solo el dueño: silencia o des-silencia a un miembro en todas las salas de voz del grupo. */
export async function silenciar(groupId: string, userId: string, silenciado: boolean) {
  await pb.send(`/api/groups/${groupId}/silenciar`, { method: 'POST', body: { user: userId, silenciado } });
}
