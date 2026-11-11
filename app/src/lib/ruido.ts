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
  const nodo = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: await wasm });
  // RNNoise procesa solo el primer canal: con un micrófono estéreo el derecho salía en silencio y a los demás
  // se los escuchaba de un solo lado. Se mezcla a mono antes de entrar (y sale mono, que se oye en los dos lados).
  nodo.channelCount = 1;
  nodo.channelCountMode = 'explicit';
  nodo.channelInterpretation = 'speakers';
  return nodo;
}

// Supresión "Fuerte": DeepFilterNet compilado a WebAssembly (dfn/), ~16 MB que se bajan la primera vez que se elige.
// El módulo se compila una vez por sesión y se le pasa al hilo de audio (dfn/worklet.ts).
let dfnModulo: Promise<WebAssembly.Module> | null = null;
/** Cuánto de un núcleo usa el filtro fuerte (el hilo de audio lo mide cada 5 s). */
export const cargaDfn = { porcentaje: 0 };
const dfnRegistrados = new WeakMap<AudioContext, Promise<void>>();
async function crearDfn(ctx: AudioContext): Promise<AudioWorkletNode> {
  // compile (y no compileStreaming): no depende de que el servidor mande el tipo application/wasm.
  dfnModulo ??= fetch('/dfn/df_bg.wasm').then((r) => { if (!r.ok) throw new Error(`no se pudo bajar el filtro (${r.status})`); return r.arrayBuffer(); })
    .then((b) => WebAssembly.compile(b)).catch((e) => { dfnModulo = null; throw e; });
  if (!dfnRegistrados.has(ctx)) dfnRegistrados.set(ctx, ctx.audioWorklet.addModule((await import('./dfn/worklet.ts?worker&url')).default));
  try { await dfnRegistrados.get(ctx); } catch (e) { dfnRegistrados.delete(ctx); throw e; }
  const nodo = new AudioWorkletNode(ctx, 'dfn', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1,
    channelCountMode: 'explicit', channelInterpretation: 'speakers', processorOptions: { module: await dfnModulo } });
  // El hilo de audio avisa si pudo arrancar el modelo; si no, deja pasar el audio y acá se informa.
  await new Promise<void>((ok, mal) => {
    nodo.port.onmessage = (m) => {
      if (m.data?.msPorCuadro !== undefined) { cargaDfn.porcentaje = (m.data.msPorCuadro / m.data.msCuadro) * 100; return; }
      if (m.data?.error) mal(new Error(m.data.error)); else ok();
    };
    setTimeout(() => mal(new Error('El filtro fuerte tardó demasiado en arrancar.')), 15_000);
  });
  return nodo;
}

export type OpcionesMic = { supresion: boolean; fuerte?: boolean; gananciaDb: number };
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
  let dfn: AudioWorkletNode | null = null;
  let gain: GainNode | null = null;

  async function armar() {
    if (!ctx || !fuente || !gain) return;
    p.fallo = '';
    // Fuerte: DeepFilterNet; si no arranca, sigue con el Normal (RNNoise) y se avisa.
    if (op.supresion && op.fuerte && !dfn) {
      try { dfn = await crearDfn(ctx); } catch (e) { console.error(e); p.fallo = `filtro fuerte: ${e instanceof Error ? e.message : String(e)}`; }
      if (!ctx || !fuente || !gain) return; // se destruyó mientras cargaba
    }
    const usarDfn = op.supresion && op.fuerte && !!dfn;
    if (op.supresion && !usarDfn && !rnnoise) {
      try { rnnoise = await crearRnnoise(ctx); } catch (e) { console.error(e); p.fallo = e instanceof Error ? e.message : String(e); }
      if (!ctx || !fuente || !gain) return; // se destruyó mientras cargaba
    }
    gain.gain.value = dbALineal(op.gananciaDb);
    fuente.disconnect();
    rnnoise?.disconnect();
    dfn?.disconnect();
    if (usarDfn) fuente.connect(dfn!).connect(gain);
    else if (op.supresion && rnnoise) fuente.connect(rnnoise).connect(gain);
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
      fuente?.disconnect(); rnnoise?.disconnect(); dfn?.disconnect(); gain?.disconnect();
      rnnoise?.destroy();
      dfn?.port.close();
      p.processedTrack?.stop();
      ctx = fuente = rnnoise = gain = null;
      dfn = null;
      p.processedTrack = undefined;
    },
  };
  return p;
}
