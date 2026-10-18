/** Cola FIFO acotada de muestras PCM intercaladas (anillo): al pasarse descarta lo más viejo. */
export class ColaPcm {
  private buf: Float32Array;
  private ini = 0;
  private n = 0;

  constructor(private max: number) { this.buf = new Float32Array(max); }

  get largo(): number { return this.n; }

  meter(lote: Float32Array): void {
    // un lote más grande que el máximo: solo importa el final
    if (lote.length > this.max) lote = lote.subarray(lote.length - this.max);
    const sobra = this.n + lote.length - this.max;
    if (sobra > 0) { this.ini = (this.ini + sobra) % this.max; this.n -= sobra; }
    for (let i = 0; i < lote.length; i++) this.buf[(this.ini + this.n + i) % this.max] = lote[i];
    this.n += lote.length;
  }

  /** Rellena `destino` con lo más viejo; si falta, ceros (silencio). */
  sacar(destino: Float32Array): void {
    const k = Math.min(destino.length, this.n);
    for (let i = 0; i < k; i++) destino[i] = this.buf[(this.ini + i) % this.max];
    destino.fill(0, k);
    this.ini = (this.ini + k) % this.max;
    this.n -= k;
  }
}

/** Lote del canal de Rust → muestras. Llega como ArrayBuffer; si la IPC cayó a postMessage, como number[] de bytes. Otra cosa: `null`. */
export function aMuestras(x: unknown): Float32Array | null {
  const b = x instanceof ArrayBuffer ? x : Array.isArray(x) ? new Uint8Array(x).buffer : null;
  return b && b.byteLength % 4 === 0 ? new Float32Array(b) : null;
}
