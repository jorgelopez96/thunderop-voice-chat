// Procesador de audio con DeepFilterNet (supresión "Fuerte"). Corre en el hilo de audio: recibe el WebAssembly ya
// compilado por processorOptions, junta los bloques de 128 muestras del navegador en cuadros del modelo (480 a 48 kHz,
// 10 ms) y devuelve lo filtrado con ~20 ms de demora. Si algo falla, deja pasar el audio sin tocarlo.
import './polyfill';
import { initSync, df_create_default, df_get_frame_length, df_process_frame } from './pkg/df.js';

declare const registerProcessor: (n: string, c: unknown) => void;
declare const sampleRate: number;
declare class AudioWorkletProcessor { port: MessagePort; constructor(o?: unknown); }

class Dfn extends AudioWorkletProcessor {
  private st = 0;
  private hop = 0;
  private ent = new Float32Array(0);
  private nEnt = 0;
  private cola: Float32Array[] = [];
  private pos = 0;
  private enCola = 0;
  private arrancado = false;
  private listo = false;
  private medido = 0; // ms gastados en el modelo en los últimos 500 cuadros (para medir cuánto procesador usa)
  private cuadros = 0;

  constructor(o: { processorOptions: { module: WebAssembly.Module; atenuacion?: number } }) {
    super();
    try {
      initSync(o.processorOptions.module);
      this.st = df_create_default(o.processorOptions.atenuacion ?? 100) as unknown as number;
      this.hop = df_get_frame_length(this.st as never) as unknown as number;
      this.ent = new Float32Array(this.hop);
      this.listo = true;
      this.port.postMessage({ listo: true });
    } catch (e) {
      this.port.postMessage({ error: String(e) });
    }
  }

  process(entradas: Float32Array[][], salidas: Float32Array[][]) {
    const ent = entradas[0]?.[0], sal = salidas[0]?.[0];
    if (!sal) return true;
    if (!ent) return true;
    if (!this.listo) { sal.set(ent); return true; }
    for (let i = 0; i < ent.length;) {
      const n = Math.min(this.hop - this.nEnt, ent.length - i);
      this.ent.set(ent.subarray(i, i + n), this.nEnt);
      this.nEnt += n; i += n;
      if (this.nEnt === this.hop) {
        const t0 = Date.now();
        const f = df_process_frame(this.st as never, this.ent) as unknown as Float32Array;
        this.medido += Date.now() - t0;
        if (++this.cuadros === 500) { this.port.postMessage({ msPorCuadro: this.medido / 500, msCuadro: (this.hop / sampleRate) * 1000 }); this.medido = 0; this.cuadros = 0; }
        this.cola.push(f); this.enCola += f.length; this.nEnt = 0;
      }
    }
    // Arranca con un cuadro de colchón para que nunca se quede sin audio entre cuadro y cuadro.
    if (!this.arrancado) { if (this.enCola < this.hop + sal.length) return true; this.arrancado = true; }
    for (let o = 0; o < sal.length && this.cola.length;) {
      const f = this.cola[0], n = Math.min(sal.length - o, f.length - this.pos);
      sal.set(f.subarray(this.pos, this.pos + n), o);
      o += n; this.pos += n; this.enCola -= n;
      if (this.pos === f.length) { this.cola.shift(); this.pos = 0; }
    }
    return true;
  }
}

registerProcessor('dfn', Dfn);
