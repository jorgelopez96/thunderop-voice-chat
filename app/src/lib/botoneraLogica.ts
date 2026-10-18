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
