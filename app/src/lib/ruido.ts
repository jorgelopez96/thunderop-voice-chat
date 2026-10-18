import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';
import type { RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';
import workletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import wasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import simdUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

// La librería se importa al usarla: define clases que heredan de AudioWorkletNode al cargarse.
// El wasm se baja una vez por sesión; el worklet se registra una vez por AudioContext.
let wasm: Promise<ArrayBuffer> | null = null;
const registrados = new WeakMap<AudioContext, Promise<void>>();

/**
 * Supresor de ruido RNNoise como procesador de LiveKit. Corre en el AudioContext de la Room
 * (debe ser de 48 kHz, lo exige RNNoise): no crea contextos propios.
 */
export function crearSupresor(): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  let nodos: AudioNode[] = [];
  const p: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
    name: 'rnnoise',
    async init({ track, audioContext: ctx }) {
      const { RnnoiseWorkletNode, loadRnnoise } = await import('@sapphi-red/web-noise-suppressor');
      wasm ??= loadRnnoise({ url: wasmUrl, simdUrl }).catch((e) => { wasm = null; throw e; });
      if (!registrados.has(ctx)) registrados.set(ctx, ctx.audioWorklet.addModule(workletUrl));
      try { await registrados.get(ctx); } catch (e) { registrados.delete(ctx); throw e; }
      const wasmBinary = await wasm;
      const fuente = ctx.createMediaStreamSource(new MediaStream([track]));
      try {
        const rnnoise = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary });
        const destino = ctx.createMediaStreamDestination();
        fuente.connect(rnnoise).connect(destino);
        nodos = [fuente, rnnoise, destino];
        p.processedTrack = destino.stream.getAudioTracks()[0];
      } catch (e) { fuente.disconnect(); throw e; }
    },
    async restart(opts) { await p.destroy(); await p.init(opts); },
    async destroy() {
      for (const n of nodos) n.disconnect();
      (nodos[1] as RnnoiseWorkletNode | undefined)?.destroy();
      p.processedTrack?.stop();
      nodos = [];
      p.processedTrack = undefined;
    },
  };
  return p;
}
