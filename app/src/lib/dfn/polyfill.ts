// El hilo de audio (AudioWorkletGlobalScope) no tiene TextEncoder/TextDecoder, y el código que genera wasm-bindgen los
// crea al cargarse (solo para textos de error). Con esto alcanza: UTF-8 básico, sin dependencias.
const g = globalThis as unknown as Record<string, unknown>;
if (!g.TextDecoder) {
  g.TextDecoder = class {
    decode(b?: Uint8Array) {
      if (!b) return '';
      let s = '';
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      try { return decodeURIComponent(escape(s)); } catch { return s; }
    }
  };
}
if (!g.TextEncoder) {
  g.TextEncoder = class {
    encode(s = '') { const u = unescape(encodeURIComponent(s)); return Uint8Array.from(u, (c) => c.charCodeAt(0)); }
    encodeInto(s: string, d: Uint8Array) { const e = this.encode(s); const n = Math.min(e.length, d.length); d.set(e.subarray(0, n)); return { read: s.length, written: n }; }
  };
}
export {};
