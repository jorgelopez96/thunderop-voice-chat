// Novedades por versión, la más nueva primero. Se completa en cada release (viaja dentro de la app).
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.2.0', fecha: '2026-10-21', cambios: [
      { tipo: 'nuevo', texto: 'Pantalla de inicio con tus grupos, las novedades y tus amigos.' },
      { tipo: 'nuevo', texto: 'Amigos: mandá solicitudes por nombre o con clic derecho en Participantes, y aceptalas en la campanita.' },
      { tipo: 'nuevo', texto: 'Mensajes privados con tus amigos, con fotos y videos, y aviso de no leídos.' },
      { tipo: 'nuevo', texto: 'Lucecita de conectado y micrófono apagado en Participantes.' },
      { tipo: 'nuevo', texto: 'Configuración en la tuerquita: supresión de ruido (ahora prendida por defecto) y ganancia del micrófono.' },
      { tipo: 'nuevo', texto: 'Foto de grupo, que la elige el dueño.' },
      { tipo: 'nuevo', texto: 'Los nombres de usuario ahora son únicos.' },
      { tipo: 'arreglo', texto: 'La música de la sala ya no se corta al cambiar de chat o de grupo.' },
    ],
  },
  {
    version: '0.1.1', fecha: '2026-10-20', cambios: [
      { tipo: 'arreglo', texto: 'Ya no se escucha doble al transmitir con sonido.' },
      { tipo: 'arreglo', texto: 'El botón de silenciar la transmisión funciona en pantalla completa.' },
      { tipo: 'nuevo', texto: 'Pegá fotos en el chat con Ctrl+V.' },
      { tipo: 'nuevo', texto: 'Vista previa antes de mandar una foto y fotos en grande al tocarlas.' },
      { tipo: 'nuevo', texto: 'Ícono nuevo.' },
    ],
  },
];
