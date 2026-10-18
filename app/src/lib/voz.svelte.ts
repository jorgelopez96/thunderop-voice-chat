import type { LocalAudioTrack, Participant, RemoteTrack } from 'livekit-client';
import { pb } from './pb';
import { mensajeError } from './sesion.svelte';
import { leerPrefs, guardarPrefs } from './prefs';

/** `silenciado`: no está mandando audio (muteado, sin permiso del dueño o sin micrófono publicado). */
export type Participante = { id: string; nombre: string; hablando: boolean; silenciado: boolean; local: boolean };

/** `sinPermiso`: el dueño nos silenció (los permisos de LiveKit no dejan publicar el micrófono). */
export const voz = $state<{ salaId: string | null; salaNombre: string; grupoId: string | null; conectando: boolean; error: string; muteado: boolean; sinPermiso: boolean; supresion: boolean; participantes: Participante[] }>({
  salaId: null, salaNombre: '', grupoId: null, conectando: false, error: '', muteado: false, sinPermiso: false, supresion: leerPrefs().supresion, participantes: [],
});

// LiveKit se carga recién al entrar a la voz: el arranque de la app no lo paga. Mientras haya `room`, `lk` está cargado.
let lk: typeof import('livekit-client');
let room: import('livekit-client').Room | null = null;
let ctx: AudioContext | null = null;
let intento = 0; // invalida un `entrarVoz` en curso si se sale o se entra a otra sala

const microfono = () => room?.localParticipant.getTrackPublication(lk.Track.Source.Microphone)?.track as LocalAudioTrack | undefined;

function actualizar() {
  if (!room) { voz.participantes = []; voz.sinPermiso = false; return; }
  const p = (x: Participant, local: boolean): Participante => ({ id: x.identity, nombre: x.name || x.identity, hablando: x.isSpeaking, silenciado: !x.isMicrophoneEnabled, local });
  voz.participantes = [p(room.localParticipant, true), ...[...room.remoteParticipants.values()].map((x) => p(x, false))];
  // Misma regla que usa LiveKit para dejar publicar (sin fuentes listadas = todas permitidas).
  const perm = room.localParticipant.permissions;
  voz.sinPermiso = !!perm && (!perm.canPublish || (perm.canPublishSources.length > 0
    && !perm.canPublishSources.map(lk.Track.sourceFromProto).includes(lk.Track.Source.Microphone)));
}

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

// En serie: LiveKit recién registra el procesador cuando termina su init (import + wasm), así que un
// on→off rápido sin cola vería "sin procesador" y dejaría RNNoise puesto. Cada paso decide al llegar su turno.
let cola = Promise.resolve();
function aplicarSupresion() {
  cola = cola.then(async () => {
    const t = microfono();
    if (!t) return;
    try {
      if (voz.supresion && !t.getProcessor()) await t.setProcessor((await import('./ruido')).crearSupresor());
      else if (!voz.supresion && t.getProcessor()) await t.stopProcessor();
    } catch { voz.error = 'No se pudo activar la supresión de ruido.'; }
  });
  return cola;
}

/** Corta la sala actual y la olvida. El contexto se cierra después de desconectar (LiveKit desarma el procesador ahí). */
function limpiar() {
  const r = room, c = ctx;
  room = null; ctx = null;
  if (typeof document !== 'undefined') for (const el of document.querySelectorAll('audio[data-voz]')) el.remove();
  Object.assign(voz, { salaId: null, salaNombre: '', grupoId: null, conectando: false, sinPermiso: false, participantes: [] });
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
  try { lk ??= await import('livekit-client'); }
  catch { if (vigente()) { voz.error = 'No se pudo conectar a la voz.'; salirVoz(); } return; }
  if (!vigente()) return;
  const { Room, RoomEvent, Track } = lk;
  const r = new Room({ adaptiveStream: true, dynacast: true, webAudioMix: { audioContext: c } });
  room = r;

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
    await r.connect(url, token);
  } catch {
    if (vigente()) { voz.error = 'No se pudo conectar a la voz.'; salirVoz(); }
    return;
  }
  if (!vigente()) { r.disconnect(); return; } // por si el connect terminó pese al disconnect de limpiar()
  voz.conectando = false;
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

// Solo para los E2E (en el build de producción no existe): micrófono local y, por nombre de cada
// remoto, si publica micrófono y los bytes de audio recibidos de él.
if (import.meta.env.DEV) {
  (globalThis as unknown as { __voz: unknown }).__voz = {
    async stats() {
      const remotos: Record<string, { mic: boolean; bytes: number }> = {};
      for (const p of room?.remoteParticipants.values() ?? []) {
        const pub = p.getTrackPublication(lk.Track.Source.Microphone);
        let bytes = 0;
        (await pub?.track?.getRTCStatsReport())?.forEach((s) => { if (s.type === 'inbound-rtp') bytes += s.bytesReceived ?? 0; });
        remotos[p.name || p.identity] = { mic: !!pub && !pub.isMuted, bytes };
      }
      return { mic: room?.localParticipant.isMicrophoneEnabled ?? false, remotos };
    },
  };
}

/** Solo el dueño: silencia o des-silencia a un miembro en todas las salas de voz del grupo. */
export async function silenciar(groupId: string, userId: string, silenciado: boolean) {
  await pb.send(`/api/groups/${groupId}/silenciar`, { method: 'POST', body: { user: userId, silenciado } });
}
