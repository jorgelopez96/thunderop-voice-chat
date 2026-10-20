import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';
import type { RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';
import workletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import wasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import simdUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import { dbALineal } from './ganancia';

// La librería se importa al usarla: define clases que heredan de AudioWorkletNode al cargarse.
// El wasm se baja una vez por sesión; el worklet se registra una vez por AudioContext.
let wasm: Promise<ArrayBuffer> | null = null;
const registrados = new WeakMap<AudioContext, Promise<void>>();

async function crearRnnoise(ctx: AudioContext): Promise<RnnoiseWorkletNode> {
  const { RnnoiseWorkletNode, loadRnnoise } = await import('@sapphi-red/web-noise-suppressor');
  wasm ??= loadRnnoise({ url: wasmUrl, simdUrl }).catch((e) => { wasm = null; throw e; });
  if (!registrados.has(ctx)) registrados.set(ctx, ctx.audioWorklet.addModule(workletUrl));
  try { await registrados.get(ctx); } catch (e) { registrados.delete(ctx); throw e; }
  return new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: await wasm });
}

export type OpcionesMic = { supresion: boolean; gananciaDb: number };
/** `fallo`: por qué no se pudo cargar RNNoise ('' si anda). El micrófono sigue con la ganancia, sin supresión. */
export type ProcesadorMic = TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> & { ajustar(op: OpcionesMic): Promise<void>; fallo: string };

/**
 * Procesador del micrófono para LiveKit: fuente → [RNNoise si `supresion`] → ganancia → lo que se envía.
 * Corre en el AudioContext de la Room (debe ser de 48 kHz, lo exige RNNoise): no crea contextos propios.
 * Apagar la supresión deja RNNoise creado pero fuera del camino; se destruye con el procesador.
 */
export function crearProcesador(op: OpcionesMic): ProcesadorMic {
  let ctx: AudioContext | null = null;
  let fuente: MediaStreamAudioSourceNode | null = null;
  let rnnoise: RnnoiseWorkletNode | null = null;
  let gain: GainNode | null = null;

  async function armar() {
    if (!ctx || !fuente || !gain) return;
    p.fallo = '';
    if (op.supresion && !rnnoise) {
      try { rnnoise = await crearRnnoise(ctx); } catch (e) { console.error(e); p.fallo = e instanceof Error ? e.message : String(e); }
      if (!ctx || !fuente || !gain) return; // se destruyó mientras cargaba
    }
    gain.gain.value = dbALineal(op.gananciaDb);
    fuente.disconnect();
    rnnoise?.disconnect();
    if (op.supresion && rnnoise) fuente.connect(rnnoise).connect(gain);
    else fuente.connect(gain);
  }

  const p: ProcesadorMic = {
    name: 'microfono',
    fallo: '',
    async init({ track, audioContext }) {
      ctx = audioContext;
      fuente = ctx.createMediaStreamSource(new MediaStream([track]));
      gain = ctx.createGain();
      const destino = ctx.createMediaStreamDestination();
      gain.connect(destino);
      p.processedTrack = destino.stream.getAudioTracks()[0];
      await armar();
    },
    async restart(opts) { await p.destroy(); await p.init(opts); },
    async ajustar(nuevo) { op = nuevo; await armar(); },
    async destroy() {
      fuente?.disconnect(); rnnoise?.disconnect(); gain?.disconnect();
      rnnoise?.destroy();
      p.processedTrack?.stop();
      ctx = fuente = rnnoise = gain = null;
      p.processedTrack = undefined;
    },
  };
  return p;
}
