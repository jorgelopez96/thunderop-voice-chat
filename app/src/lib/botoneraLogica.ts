// Lógica pura de la botonera (sin runes ni audio): validación de subidas.
export const MAX_SEGUNDOS = 10;
export const MAX_BYTES = 1024 * 1024;
export const TIPOS = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'];

/** Mensaje de error de una subida, o `''` si es válida. Mismos topes que la colección `sonidos`. */
export function validarSonido({ duracion, tamaño, tipo }: { duracion: number; tamaño: number; tipo: string }): string {
  if (!TIPOS.includes(tipo)) return 'Tipo de archivo no permitido.';
  if (tamaño > MAX_BYTES) return 'El sonido pesa más de 1 MB.';
  if (duracion > MAX_SEGUNDOS) return 'El sonido dura más de 10 segundos.';
  return '';
}

/** Mensaje en español para un error de PocketBase al crear un sonido (`e.response`): solo se deja pasar el texto propio del hook. */
export function mensajeSubida(response: { message?: unknown; data?: { file?: { code?: unknown } } } | undefined): string {
  if (response?.message === 'El grupo ya tiene 50 sonidos.') return response.message;
  const code = response?.data?.file?.code;
  if (code === 'validation_file_size_limit') return 'El sonido pesa más de 1 MB.';
  if (code === 'validation_invalid_mime_type') return 'Tipo de archivo no permitido.';
  return 'No se pudo subir el sonido.';
}

// El ícono del botón es el primer grafema del nombre si es un emoji: así entran enteros los tonos de piel, las uniones ZWJ (👨‍👩‍👧), keycaps (#️⃣) y banderas.
const grafemas = new Intl.Segmenter();
const ES_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

/** Separa el nombre guardado en emoji del botón y texto. */
export function separarEmoji(nombre: string): { emoji: string; texto: string } {
  const primero = grafemas.segment(nombre)[Symbol.iterator]().next().value?.segment ?? '';
  return ES_EMOJI.test(primero) ? { emoji: primero, texto: nombre.slice(primero.length).trimStart() } : { emoji: '', texto: nombre };
}

/** Nombre a guardar: "EMOJI texto" (el emoji va en el nombre: los que no actualizaron lo ven igual). */
export const unirEmoji = (emoji: string, texto: string) => (emoji ? `${emoji} ${texto.trim()}` : texto.trim());

// Recorte de sonidos antes de subirlos: se elige un pedazo de hasta 10 s y se sube como WAV mono de 16 bits.
/** Tasa del WAV que se sube: 10 s mono de 16 bits a 44,1 kHz son ~862 KB, entran en 1 MB. */
export const TASA = 44100;
/** Tope del archivo original (antes de recortar): más grande y decodificarlo se come demasiada memoria. */
export const MAX_BYTES_ORIGINAL = 30 * 1024 * 1024;
const MIN_SEGUNDOS = 0.1;

export type Seleccion = { inicio: number; fin: number };

export const seleccionInicial = (duracion: number): Seleccion => ({ inicio: 0, fin: Math.min(duracion, MAX_SEGUNDOS) });

const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Mueve una manija a `t`. Si la selección se pasaría de 10 s (o quedaría casi vacía), arrastra a la otra manija. */
export function moverManija(sel: Seleccion, cual: keyof Seleccion, t: number, duracion: number): Seleccion {
  const min = Math.min(MIN_SEGUNDOS, duracion);
  if (cual === 'inicio') {
    const inicio = entre(t, 0, duracion - min);
    return { inicio, fin: Math.min(duracion, entre(sel.fin, inicio + min, inicio + MAX_SEGUNDOS)) };
  }
  const fin = entre(t, min, duracion);
  return { inicio: Math.max(0, entre(sel.inicio, fin - MAX_SEGUNDOS, fin - min)), fin };
}

/** Muestras mono (promedio de los canales) de la selección, nunca más de 10 s. */
export function recortarMono(canales: Float32Array[], tasa: number, sel: Seleccion): Float32Array {
  const desde = Math.round(sel.inicio * tasa);
  const n = Math.max(0, Math.min(Math.round(sel.fin * tasa), (canales[0]?.length ?? 0), desde + MAX_SEGUNDOS * tasa) - desde);
  const mono = new Float32Array(n);
  for (const c of canales) for (let i = 0; i < n; i++) mono[i] += c[desde + i] / canales.length;
  return mono;
}

/** WAV PCM mono de 16 bits. */
export function codificarWav(muestras: Float32Array, tasa: number): ArrayBuffer {
  const b = new ArrayBuffer(44 + muestras.length * 2), v = new DataView(b);
  const texto = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  texto(0, 'RIFF'); v.setUint32(4, 36 + muestras.length * 2, true); texto(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, tasa, true);
  v.setUint32(28, tasa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  texto(36, 'data'); v.setUint32(40, muestras.length * 2, true);
  for (let i = 0; i < muestras.length; i++) {
    const s = entre(muestras[i], -1, 1);
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return b;
}

/** Pico (0 a 1) de cada uno de `n` tramos, para dibujar la forma de onda. */
export function picos(muestras: Float32Array, n: number): number[] {
  const tramo = muestras.length / n;
  return Array.from({ length: n }, (_, i) => {
    let p = 0;
    for (let j = Math.floor(i * tramo), fin = Math.floor((i + 1) * tramo); j < fin; j++) p = Math.max(p, Math.abs(muestras[j]));
    return Math.min(1, p);
  });
}

/** "3,5 s" */
export const formatoSegundos = (t: number) => `${t.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
