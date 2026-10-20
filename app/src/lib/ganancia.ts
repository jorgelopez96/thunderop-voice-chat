// Ganancia del micrófono en dB (−20 a +20) a factor lineal para un GainNode.
export const dbALineal = (db: number) => 10 ** (Math.min(20, Math.max(-20, db)) / 20);
