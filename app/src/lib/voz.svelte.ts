import { Room, RoomEvent, Track, type LocalAudioTrack, type Participant, type RemoteTrack } from 'livekit-client';
import { pb } from './pb';
import { mensajeError } from './sesion.svelte';
import { leerPrefs, guardarPrefs } from './prefs';
import { crearSupresor } from './ruido';

/** `silenciado`: no está mandando audio (muteado, sin permiso del dueño o sin micrófono publicado). */
export type Participante = { id: string; nombre: string; hablando: boolean; silenciado: boolean; local: boolean };

export const voz = $state<{ salaId: string | null; conectando: boolean; error: string; muteado: boolean; supresion: boolean; participantes: Participante[] }>({
  salaId: null, conectando: false, error: '', muteado: false, supresion: leerPrefs().supresion, participantes: [],
});

let room: Room | null = null;
let ctx: AudioContext | null = null;
let intento = 0; // invalida un `entrarVoz` en curso si se sale o se entra a otra sala
let entrada = 'default'; // micrófono en uso (el guardado si sigue conectado)

const microfono = () => room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;

function actualizar() {
  if (!room) { voz.participantes = []; return; }
  const p = (x: Participant, local: boolean): Participante => ({ id: x.identity, nombre: x.name || x.identity, hablando: x.isSpeaking, silenciado: !x.isMicrophoneEnabled, local });
  voz.participantes = [p(room.localParticipant, true), ...[...room.remoteParticipants.values()].map((x) => p(x, false))];
}

/** Publica el micrófono si el usuario no está muteado. Sin permiso del dueño (403 de LiveKit) falla en silencio: queda `silenciado`. */
async function publicarMic() {
  if (!room || voz.muteado) return;
  try {
    await room.localParticipant.setMicrophoneEnabled(true, { deviceId: entrada, noiseSuppression: false, echoCancellation: true, autoGainControl: true }, { dtx: false });
  } catch (e) {
    const n = (e as Error)?.name;
    if (n === 'NotAllowedError') voz.error = 'No hay permiso para usar el micrófono.';
    else if (n === 'NotFoundError' || n === 'OverconstrainedError') voz.error = 'No se encontró un micrófono.';
    else if (!(n === 'PublishTrackError' && (e as { status?: number }).status === 403)) voz.error = 'No se pudo usar el micrófono.';
  }
  actualizar();
}

// En serie: LiveKit recién registra el procesador cuando termina su init (import + wasm), así que un
// on→off rápido sin cola vería "sin procesador" y dejaría RNNoise puesto. Cada paso decide al llegar su turno.
let cola = Promise.resolve();
function aplicarSupresion() {
  cola = cola.then(async () => {
    const t = microfono();
    if (!t) return;
    try {
      if (voz.supresion && !t.getProcessor()) await t.setProcessor(crearSupresor());
      else if (!voz.supresion && t.getProcessor()) await t.stopProcessor();
    } catch { voz.error = 'No se pudo activar la supresión de ruido.'; }
  });
  return cola;
}

async function existe(kind: MediaDeviceKind, id?: string) {
  if (!id) return false;
  try { return (await navigator.mediaDevices.enumerateDevices()).some((d) => d.kind === kind && d.deviceId === id); }
  catch { return false; }
}

/** Corta la sala actual y la olvida. El contexto se cierra después de desconectar (LiveKit desarma el procesador ahí). */
function limpiar() {
  if (!room) return;
  const r = room, c = ctx;
  for (const el of document.querySelectorAll('audio[data-voz]')) el.remove();
  room = null; ctx = null;
  Object.assign(voz, { salaId: null, conectando: false, participantes: [] });
  r.disconnect().catch(() => {}).finally(() => c?.close().catch(() => {}));
}

export async function entrarVoz(roomId: string) {
  salirVoz();
  const mio = ++intento;
  // El contexto se crea antes de cualquier await, dentro del gesto del usuario (autoplay). 48 kHz: lo exige RNNoise.
  const c = new AudioContext({ sampleRate: 48000 });
  const r = new Room({ adaptiveStream: true, dynacast: true, webAudioMix: { audioContext: c } });
  ctx = c; room = r;
  Object.assign(voz, { salaId: roomId, conectando: true, error: '' });
  const vigente = () => mio === intento;

  r.on(RoomEvent.TrackSubscribed, (t: RemoteTrack, _pub, part) => {
    if (t.kind !== Track.Kind.Audio) return;
    const el = t.attach(); el.dataset.voz = ''; document.body.append(el);
    part.setVolume(leerPrefs().volumenes[part.identity] ?? 1);
  });
  r.on(RoomEvent.TrackUnsubscribed, (t: RemoteTrack) => { for (const el of t.detach()) el.remove(); });
  r.on(RoomEvent.LocalTrackPublished, () => { aplicarSupresion(); actualizar(); });
  r.on(RoomEvent.ParticipantPermissionsChanged, (_prev, part) => {
    // El dueño nos des-silenció: se vuelve a publicar el micrófono (LiveKit lo despublicó al silenciar).
    if (part === r.localParticipant && !r.localParticipant.isMicrophoneEnabled) publicarMic();
    actualizar();
  });
  for (const ev of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged,
    RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
    RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantNameChanged]) r.on(ev, actualizar);
  // Desconexión iniciada por el servidor (echado, sala borrada) o red perdida sin recuperación.
  r.on(RoomEvent.Disconnected, () => { if (vigente()) salirVoz(); });

  let token: string, url: string;
  try {
    ({ token, url } = await pb.send(`/api/rooms/${roomId}/token`, { method: 'POST' }));
  } catch (e) {
    if (vigente()) { voz.error = mensajeError(e); salirVoz(); }
    return;
  }
  try {
    if (!vigente()) return;
    await r.connect(url, token);
  } catch {
    if (vigente()) { voz.error = 'No se pudo conectar a la voz.'; salirVoz(); }
    return;
  }
  if (!vigente()) { r.disconnect(); return; } // por si el connect terminó pese al disconnect de limpiar()
  voz.conectando = false;
  actualizar();
  const salida = leerPrefs().salida;
  if (await existe('audiooutput', salida) && vigente()) r.switchActiveDevice('audiooutput', salida!).catch(() => {});
  const guardada = leerPrefs().entrada;
  const hay = await existe('audioinput', guardada);
  if (!vigente()) return;
  if (leerPrefs().entrada === guardada) entrada = hay ? guardada! : 'default'; // si eligió otro mientras tanto, gana ese
  await publicarMic();
}

export function salirVoz() {
  intento++;
  limpiar();
}

export async function alternarMute() {
  voz.muteado = !voz.muteado;
  if (!room) return;
  if (voz.muteado) await room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
  else await publicarMic();
  actualizar();
}

export async function alternarSupresion() {
  voz.supresion = !voz.supresion;
  guardarPrefs({ supresion: voz.supresion });
  await aplicarSupresion();
}

export async function elegirEntrada(deviceId: string) {
  guardarPrefs({ entrada: deviceId });
  entrada = deviceId;
  await room?.switchActiveDevice('audioinput', deviceId).catch(() => {}); // el procesador se reinicia solo (restart)
}

export async function elegirSalida(deviceId: string) {
  guardarPrefs({ salida: deviceId });
  await room?.switchActiveDevice('audiooutput', deviceId).catch(() => {});
}

/** Volumen de un usuario (0 a 2; con webAudioMix se puede pasar de 1). Se guarda en prefs. */
export function volumen(userId: string, v: number) {
  if (!Number.isFinite(v)) return;
  v = Math.min(2, Math.max(0, v));
  guardarPrefs({ volumenes: { [userId]: v } });
  room?.remoteParticipants.get(userId)?.setVolume(v);
}

export async function dispositivos(): Promise<{ entradas: MediaDeviceInfo[]; salidas: MediaDeviceInfo[] }> {
  try {
    const d = await navigator.mediaDevices.enumerateDevices();
    return { entradas: d.filter((x) => x.kind === 'audioinput'), salidas: d.filter((x) => x.kind === 'audiooutput') };
  } catch { return { entradas: [], salidas: [] }; }
}

/** Solo el dueño: silencia o des-silencia a un miembro en todas las salas de voz del grupo. */
export async function silenciar(groupId: string, userId: string, silenciado: boolean) {
  await pb.send(`/api/groups/${groupId}/silenciar`, { method: 'POST', body: { user: userId, silenciado } });
}
