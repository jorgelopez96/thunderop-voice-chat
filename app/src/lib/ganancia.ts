// Ganancia del micrófono en dB (−20 a +20) a factor lineal para un GainNode.
export const dbALineal = (db: number) => 10 ** (Math.min(20, Math.max(-20, db)) / 20);

// La barrita de Configuración va de 0% a 100% (50% = sin cambios); cada 1% son 0,4 dB.
export const dbDePorcentaje = (pct: number) => (Math.min(100, Math.max(0, pct)) - 50) * 0.4;
export const porcentajeDeDb = (db: number) => Math.round(db / 0.4 + 50);
