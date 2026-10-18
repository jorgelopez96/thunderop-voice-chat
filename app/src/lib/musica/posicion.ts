// Lógica pura de la música sincronizada (sin runes ni reproductor): posición compartida y reloj del servidor.

/** Segundos de la canción según `reproducciones`: `pausaS` si está en pausa, si no lo que pasó desde `inicioMs` (nunca negativo). */
export function posicion(r: { inicioMs: number; pausaS: number | null }, ahoraServidorMs: number): number {
  return r.pausaS ?? Math.max(0, (ahoraServidorMs - r.inicioMs) / 1000);
}

/** Cuánto va adelantado el servidor (ms), tipo NTP: su `ahora` se toma a mitad de camino entre el envío y la respuesta. */
export function desfase(respuestaAhora: number, enviadoMs: number, recibidoMs: number): number {
  return respuestaAhora - (enviadoMs + recibidoMs) / 2;
}

/** Una medición del reloj: desfase, ida y vuelta (`rtt`) y cuándo se tomó (ms locales). */
export type Muestra = { desfase: number; rtt: number; en: number };
export const muestra = (respuestaAhora: number, enviadoMs: number, recibidoMs: number): Muestra =>
  ({ desfase: desfase(respuestaAhora, enviadoMs, recibidoMs), rtt: recibidoMs - enviadoMs, en: recibidoMs });

/** Como NTP: se queda con la de menor ida y vuelta (la más precisa). Una peor solo reemplaza a una vencida (`venceMs`, 5 min). */
export function mejor(actual: Muestra | null, nueva: Muestra, ahoraMs: number, venceMs = 300_000): Muestra {
  return !actual || nueva.rtt <= actual.rtt || ahoraMs - actual.en > venceMs ? nueva : actual;
}
