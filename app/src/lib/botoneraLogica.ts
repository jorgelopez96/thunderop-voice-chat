// Lógica pura de la botonera (sin runes ni audio): validación de subidas y tope de fuentes simultáneas.
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

/** Cupo de fuentes simultáneas: `intentar` toma un lugar (false si no hay) y `liberar` lo devuelve. */
export class Limite {
  private en = 0;
  constructor(private max: number) {}
  intentar() { if (this.en >= this.max) return false; this.en++; return true; }
  liberar() { this.en = Math.max(0, this.en - 1); }
}

/** Mensaje en español para un error de PocketBase al crear un sonido (`e.response`): solo se deja pasar el texto propio del hook. */
export function mensajeSubida(response: { message?: unknown; data?: { file?: { code?: unknown } } } | undefined): string {
  if (response?.message === 'El grupo ya tiene 50 sonidos.') return response.message;
  const code = response?.data?.file?.code;
  if (code === 'validation_file_size_limit') return 'El sonido pesa más de 1 MB.';
  if (code === 'validation_invalid_mime_type') return 'Tipo de archivo no permitido.';
  return 'No se pudo subir el sonido.';
}

// Un emoji (con sus variantes y uniones ZWJ, ej. 👨‍👩‍👧 o ❤️) al principio del nombre: es el ícono del botón.
const EMOJI_INICIAL = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;

/** Separa el nombre guardado en emoji del botón y texto. */
export function separarEmoji(nombre: string): { emoji: string; texto: string } {
  const m = EMOJI_INICIAL.exec(nombre);
  return m ? { emoji: m[1], texto: nombre.slice(m[0].length) } : { emoji: '', texto: nombre };
}

/** Nombre a guardar: "EMOJI texto" (el emoji va en el nombre: los que no actualizaron lo ven igual). */
export const unirEmoji = (emoji: string, texto: string) => (emoji ? `${emoji} ${texto.trim()}` : texto.trim());
