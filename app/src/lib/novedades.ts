// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.6.1', fecha: '2026-10-24', cambios: [
      { tipo: 'nuevo', texto: 'Invitar al grupo: buscá a tus amigos y mandales la invitación por privado, o copiá el link. En el chat aparece el botón «Unirme al grupo».' },
      { tipo: 'arreglo', texto: 'Los juegos que se minimizan al pasar a Thunderop ya aparecen en la lista para transmitir; la imagen se ve apenas volvés al juego.' },
    ],
  },
];
