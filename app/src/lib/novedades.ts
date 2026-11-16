// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.13.1', fecha: '2026-11-16', cambios: [
      { tipo: 'arreglo', texto: 'Si se corta internet o el servidor, la app vuelve sola a la llamada en cuanto la conexión vuelve (antes te dejaba afuera con "Se perdió la conexión de voz"). Mientras tanto avisa "Volviendo a entrar a la llamada…".' },
    ],
  },
];
