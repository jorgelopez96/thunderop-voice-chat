// Lógica pura de la música sincronizada (sin runes ni reproductor): posición compartida y reloj del servidor.

/** Segundos de la canción según `reproducciones`: `pausaS` si está en pausa, si no lo que pasó desde `inicioMs` (nunca negativo). */
export function posicion(r: { inicioMs: number; pausaS: number | null }, ahoraServidorMs: number): number {
  return r.pausaS ?? Math.max(0, (ahoraServidorMs - r.inicioMs) / 1000);
}

/** Cuánto va adelantado el servidor (ms), tipo NTP: su `ahora` se toma a mitad de camino entre el envío y la respuesta. */
export function desfase(respuestaAhora: number, enviadoMs: number, recibidoMs: number): number {
  return respuestaAhora - (enviadoMs + recibidoMs) / 2;
}
