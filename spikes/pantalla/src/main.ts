import { Room, RoomEvent, Track, type VideoCodec } from 'livekit-client';
import { summarizeSender } from './stats';
import { installBaselineH264Patch } from './sdp';

// location.hostname: localhost en la PC, la IP de la PC cuando se abre desde el celular.
const TOKENS = `http://${location.hostname}:7890/token`;
const CALIDADES: Record<string, { width: number; height: number; frameRate: number }> = {
  '720p30': { width: 1280, height: 720, frameRate: 30 },
  '720p60': { width: 1280, height: 720, frameRate: 60 },
  '1080p30': { width: 1920, height: 1080, frameRate: 30 },
  '1080p60': { width: 1920, height: 1080, frameRate: 60 },
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const room = new Room();
installBaselineH264Patch(() => $<HTMLInputElement>('gpu').checked);
document.body.prepend(
  Object.assign(document.createElement('h3'), {
    textContent: '__TAURI_INTERNALS__' in window ? 'APP DE ESCRITORIO' : 'NAVEGADOR',
  }),
);

function mostrarError(e: unknown) {
  $('error').textContent = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

room
  .on(RoomEvent.TrackSubscribed, (track) => {
    const el = track.attach();
    if (track.kind === Track.Kind.Video) el.setAttribute('controls', '');
    $('remotos').append(el);
  })
  .on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()))
  .on(RoomEvent.Disconnected, () => ($('estado').textContent = 'desconectado'));

$('conectar').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const nombre = $<HTMLInputElement>('nombre').value;
    const { token, url } = await (await fetch(`${TOKENS}?identity=${encodeURIComponent(nombre)}`)).json();
    await room.connect(url, token);
    $('estado').textContent = `conectado como ${nombre} a sala prueba`;
    $<HTMLButtonElement>('transmitir').disabled = false;
  } catch (err) {
    mostrarError(err);
  }
});

$('transmitir').addEventListener('click', async () => {
  $('error').textContent = '';
  const resolution = CALIDADES[$<HTMLSelectElement>('calidad').value];
  const videoCodec = $<HTMLSelectElement>('codec').value as VideoCodec;
  try {
    await room.localParticipant.setScreenShareEnabled(
      true,
      { audio: true, contentHint: 'motion', resolution },
      {
        videoCodec,
        simulcast: false,
        screenShareEncoding: {
          maxBitrate: Number($<HTMLSelectElement>('bitrate').value) * 1_000_000,
          maxFramerate: resolution.frameRate,
        },
      },
    );
    $<HTMLButtonElement>('detener').disabled = false;
  } catch (err) {
    mostrarError(err);
  }
});

$('detener').addEventListener('click', async () => {
  await room.localParticipant.setScreenShareEnabled(false);
  $<HTMLButtonElement>('detener').disabled = true;
  $('stats').textContent = '';
});

// Diagnóstico: llama a getDisplayMedia sin LiveKit y reporta si resuelve, falla o queda colgada.
$('probar').addEventListener('click', async () => {
  const log = (m: string) => ($('estado').textContent = `[probar] ${m}`);
  log(`getDisplayMedia existe: ${typeof navigator.mediaDevices?.getDisplayMedia}; esperando...`);
  const t0 = performance.now();
  const timer = setInterval(() => log(`sigue esperando (${Math.round((performance.now() - t0) / 1000)} s)`), 1000);
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const s = stream.getVideoTracks()[0]?.getSettings();
    log(`OK: ${s?.width}x${s?.height} @ ${s?.frameRate} fps, audio: ${stream.getAudioTracks().length}`);
    stream.getTracks().forEach((t) => t.stop());
  } catch (err) {
    log('falló');
    mostrarError(err);
  } finally {
    clearInterval(timer);
  }
});

setInterval(async () => {
  const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack;
  const report = await track?.getRTCStatsReport();
  if (!report) return;
  const s = summarizeSender(report);
  $('stats').textContent = s
    ? `encoder: ${s.encoder} (hardware: ${s.hardware ?? '?'})  codec: ${s.codec ?? '?'}\n` +
      `${s.width}x${s.height} @ ${s.fps} fps  limitación: ${s.limitation}`
    : 'sin estadísticas de video todavía';
}, 1000);
