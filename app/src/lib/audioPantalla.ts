import { Channel, invoke } from '@tauri-apps/api/core';
import workletUrl from './pcm.worklet.ts?worker&url';
import { aMuestras } from './colaPcm';

// El worklet se registra una vez por AudioContext.
const registrados = new WeakMap<AudioContext, Promise<void>>();
let nodos: AudioNode[] = [];
let pista: MediaStreamTrack | null = null;

/** Audio del sistema (Rust) → pista WebRTC: todo menos la app o, con `pid`, solo el de ese programa. `null` si no es Tauri o el comando falla. */
export async function iniciarAudioPantalla(ctx: AudioContext, pid?: number): Promise<MediaStreamTrack | null> {
  if (!('__TAURI_INTERNALS__' in globalThis)) return null;
  await detenerAudioPantalla();
  try {
    if (!registrados.has(ctx)) registrados.set(ctx, ctx.audioWorklet.addModule(workletUrl));
    try { await registrados.get(ctx); } catch (e) { registrados.delete(ctx); throw e; }
    const worklet = new AudioWorkletNode(ctx, 'pcm-entrada', { numberOfInputs: 0, outputChannelCount: [2] });
    const destino = new MediaStreamAudioDestinationNode(ctx, { channelCount: 2 });
    worklet.connect(destino);
    nodos = [worklet, destino];
    pista = destino.stream.getAudioTracks()[0];
    const canal = new Channel<unknown>();
    // Nunca tira: si `onmessage` falla, el Channel de Tauri no avanza y acumula todos los lotes siguientes.
    canal.onmessage = (m) => {
      try { const f = aMuestras(m); if (f) worklet.port.postMessage(f, [f.buffer]); } catch { /* se pierde el lote */ }
    };
    await invoke('iniciar_audio', { canal, incluir: pid ?? null });
    return pista;
  } catch (e) {
    console.warn('audio de pantalla no disponible', e);
    await detenerAudioPantalla();
    return null;
  }
}

/** Idempotente: frena la captura nativa y desarma el puente. */
export async function detenerAudioPantalla(): Promise<void> {
  for (const n of nodos) n.disconnect();
  pista?.stop();
  nodos = [];
  pista = null;
  if (!('__TAURI_INTERNALS__' in globalThis)) return;
  try { await invoke('detener_audio'); } catch (e) { console.warn('detener_audio falló', e); }
}
