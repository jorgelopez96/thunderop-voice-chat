// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.12.0', fecha: '2026-11-11', cambios: [
      { tipo: 'arreglo', texto: 'Las cámaras se ven mucho mejor: aunque la conexión ande justa, lo peor que llega es 360p (antes se veían en 180p, todas pixeladas).' },
      { tipo: 'arreglo', texto: 'Las transmisiones gastan menos internet (1080p60 va a 8 Mbps): con varios mirando ya no se traban las cámaras de los demás.' },
      { tipo: 'nuevo', texto: 'Clic derecho sobre alguien con la cámara prendida: elegís en qué calidad verla (automática, media o baja). Se recuerda para cada uno.' },
      { tipo: 'arreglo', texto: 'Pantalla completa sin la franja negra abajo, también al agrandar la cámara de alguien.' },
      { tipo: 'nuevo', texto: 'En la PC podés esconder la lista de salas (botón al lado del nombre del grupo) y la de participantes (botón de la gente en el chat).' },
      { tipo: 'nuevo', texto: 'Lo que escribiste y no mandaste te espera cuando volvés a ese chat.' },
      { tipo: 'arreglo', texto: 'Al instalar, Windows muestra el ícono nuevo sin tener que reiniciar.' },
    ],
  },
];
