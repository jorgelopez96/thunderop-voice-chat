import { leerPrefs, guardarPrefs } from './prefs';

// Formato de hora de los mensajes (24 h o 12 h), por dispositivo.
export const formatoHora = $state({ h24: leerPrefs().hora24 });

export function cambiarFormatoHora(h24: boolean) {
  formatoHora.h24 = h24;
  guardarPrefs({ hora24: h24 });
}

export const horaDe = (fecha: string) =>
  new Date(fecha.replace(' ', 'T')).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: !formatoHora.h24 });

// Un solo reloj para todos los contadores en vivo (tiempo con gente en una sala de voz).
export const reloj = $state({ ahora: Date.now() });
setInterval(() => (reloj.ahora = Date.now()), 1000);

/** Duración en ms como 5:07 o 1:05:07. */
export function duracion(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000)), dos = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return h ? `${h}:${dos(m)}:${dos(s % 60)}` : `${m}:${dos(s % 60)}`;
}
/** Cuánto pasó desde `desde` (ms), al segundo. */
export const desdeHace = (desde: number) => duracion(reloj.ahora - desde);
