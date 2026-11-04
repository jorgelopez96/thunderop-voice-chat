import { ColaPcm } from './colaPcm';

// Globals del AudioWorkletGlobalScope (no están en lib.dom).
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
}
declare function registerProcessor(nombre: string, ctor: new () => AudioWorkletProcessor): void;

// Audio estéreo intercalado a 48 kHz: 0,3 s de tope de latencia del puente (con 0,1 s, en una PC al límite los
// tirones del hilo principal se pasaban y se tiraba audio) y 50 ms de colchón al arrancar y después de cada corte.
const MAX_MUESTRAS = 28800;
const ARRANQUE = 4800;

class PcmEntrada extends AudioWorkletProcessor {
  private cola = new ColaPcm(MAX_MUESTRAS, ARRANQUE);
  private tmp = new Float32Array(0);

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<Float32Array>) => this.cola.meter(e.data);
  }

  process(_in: Float32Array[][], salidas: Float32Array[][]): boolean {
    const [izq, der = izq] = salidas[0];
    const n = izq.length;
    if (this.tmp.length !== n * 2) this.tmp = new Float32Array(n * 2);
    this.cola.sacar(this.tmp);
    for (let i = 0; i < n; i++) { izq[i] = this.tmp[2 * i]; der[i] = this.tmp[2 * i + 1]; }
    return true;
  }
}

registerProcessor('pcm-entrada', PcmEntrada);
