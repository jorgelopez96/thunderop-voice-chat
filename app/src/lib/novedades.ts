// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.4.0', fecha: '2026-10-22', cambios: [
      { tipo: 'nuevo', texto: 'GIFs en el chat: tocá "GIF" al lado de los emojis, buscá y mandalo.' },
      { tipo: 'nuevo', texto: 'Colores de la app: elegí entre 6 temas en Configuración → Apariencia.' },
      { tipo: 'nuevo', texto: 'Dueño del grupo: con clic derecho en la sala de voz podés mover a alguien a otra sala o desconectarlo sin dejarlo volver (se lo vuelve a dejar desde Participantes).' },
      { tipo: 'nuevo', texto: 'Dueño del grupo: cambiá el nombre o borrá una sala de chat desde sus tres puntitos.' },
      { tipo: 'nuevo', texto: 'Fotos en grande: con zoom podés arrastrar la imagen con el mouse.' },
      { tipo: 'nuevo', texto: 'Las salas nuevas se crean desde el menú del nombre del grupo, con un cartel que se puede cancelar.' },
      { tipo: 'arreglo', texto: 'Al alejar la foto ya no se achica más que su tamaño entero, y los botones de descargar y cerrar son nuevos.' },
    ],
  },
];
