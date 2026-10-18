import { ColaPcm } from './colaPcm';

// Globals del AudioWorkletGlobalScope (no están en lib.dom).
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
}
declare function registerProcessor(nombre: string, ctor: new () => AudioWorkletProcessor): void;

// 0,1 s de audio estéreo intercalado a 48 kHz: tope de latencia del puente.
const MAX_MUESTRAS = 9600;

class PcmEntrada extends AudioWorkletProcessor {
  private cola = new ColaPcm(MAX_MUESTRAS);
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
