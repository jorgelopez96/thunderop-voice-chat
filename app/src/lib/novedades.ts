// Novedades por versión, la más nueva primero. Se completa en cada release (viaja dentro de la app).
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.3.0', fecha: '2026-10-20', cambios: [
      { tipo: 'nuevo', texto: 'Diseño nuevo en toda la app: colores, tipografía, íconos y portada con tus grupos y quién está en voz.' },
      { tipo: 'nuevo', texto: 'Sala de voz con tarjetas grandes para cada uno, y la pantalla que mirás arriba de todo.' },
      { tipo: 'nuevo', texto: 'Barra de abajo con micrófono, auriculares para ensordecerte (también calla la música), pantalla, sonidos y música.' },
      { tipo: 'nuevo', texto: 'Sonidos y música en panelcitos que se abren desde la barra, con buscador de sonidos.' },
      { tipo: 'nuevo', texto: 'Reproductor de música abajo de la sala: pausar, pasar y silenciar solo para vos.' },
      { tipo: 'nuevo', texto: 'Cada sala de voz tiene su propio chat.' },
      { tipo: 'nuevo', texto: 'Responder mensajes, reaccionar con emojis y mandar emojis desde un menú.' },
      { tipo: 'nuevo', texto: 'Los mensajes seguidos de la misma persona se agrupan.' },
      { tipo: 'nuevo', texto: 'Contador de mensajes sin leer en los chats y en los grupos.' },
      { tipo: 'nuevo', texto: 'Fotos en grande con zoom con la ruedita y botón para descargarlas.' },
      { tipo: 'nuevo', texto: 'Clic derecho en alguien: ver perfil y volumen de esa persona.' },
      { tipo: 'nuevo', texto: 'Configuraciones del grupo: foto, participantes y borrar (pide escribir el nombre para confirmar).' },
      { tipo: 'nuevo', texto: 'Sonido corto cuando alguien entra o sale de la sala.' },
      { tipo: 'nuevo', texto: 'Foto de perfil por defecto para quien no subió una, e ícono nuevo de la app.' },
    ],
  },
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
