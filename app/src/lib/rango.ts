/** Estilo de un slider: --v es cuánto de la pista se pinta con el acento (ver app.css). */
export const lleno = (v: number, min: number, max: number) => `--v:${((v - min) / (max - min)) * 100}%`;
