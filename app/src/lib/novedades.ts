// Novedades por versión, la más nueva primero. Se completa en cada release (viaja dentro de la app).
// Las versiones de un mismo día van juntas en una sola entrada, con el número de la última.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.3.5', fecha: '2026-10-20', cambios: [
      { tipo: 'arreglo', texto: 'La transmisión ya no tiene tope de calidad: usa todo lo que dé la conexión del que transmite.' },
    ],
  },
  {
    version: '0.3.4', fecha: '2026-10-20', cambios: [
      { tipo: 'nuevo', texto: 'Contador de espectadores en la transmisión: al lado del nombre ves cuántos la están mirando.' },
      { tipo: 'arreglo', texto: 'La transmisión ya no se cuadricula al mover la cámara rápido en los juegos, y se ve nítida desde que empezás a mirarla.' },
    ],
  },
  {
    version: '0.3.3', fecha: '2026-10-20', cambios: [
      { tipo: 'nuevo', texto: 'Diseño nuevo en toda la app: colores, tipografía, íconos y portada con tus grupos y quién está en voz.' },
      { tipo: 'nuevo', texto: 'Pantalla de inicio con tus grupos, las novedades y tus amigos.' },
      { tipo: 'nuevo', texto: 'Amigos: mandá solicitudes por nombre o con clic derecho en Participantes, y aceptalas en la campanita.' },
      { tipo: 'nuevo', texto: 'Mensajes privados con tus amigos, con fotos y videos.' },
      { tipo: 'nuevo', texto: 'Sala de voz con tarjetas grandes para cada uno, y la pantalla que mirás arriba de todo.' },
      { tipo: 'nuevo', texto: 'Barra de abajo con micrófono, auriculares para ensordecerte (también calla la música), pantalla, sonidos y música.' },
      { tipo: 'nuevo', texto: 'Reproductor de música abajo de la sala: pausar, pasar y silenciar solo para vos.' },
      { tipo: 'nuevo', texto: 'Cada sala de voz tiene su propio chat.' },
      { tipo: 'nuevo', texto: 'Responder mensajes, reaccionar con emojis y mandar emojis desde un menú. Los mensajes seguidos de la misma persona se agrupan.' },
      { tipo: 'nuevo', texto: 'Contador de mensajes sin leer en los chats, los privados y los grupos.' },
      { tipo: 'nuevo', texto: 'Fotos: pegalas con Ctrl+V, mirá la vista previa antes de mandarlas, y en grande con zoom con la ruedita y botón para descargarlas.' },
      { tipo: 'nuevo', texto: 'Clic derecho en alguien: ver perfil y volumen de esa persona.' },
      { tipo: 'nuevo', texto: 'Lucecita de conectado y micrófono apagado en Participantes, con los conectados arriba.' },
      { tipo: 'nuevo', texto: 'Configuración en la tuerquita: supresión de ruido y ganancia del micrófono.' },
      { tipo: 'nuevo', texto: 'Configuraciones del grupo: foto, participantes, sonidos y borrar el grupo (pide escribir el nombre para confirmar).' },
      { tipo: 'nuevo', texto: 'Sonidos: elegí el volumen al subirlo (vale para todos), cambialo después en Configuraciones → Sonidos, y ponele emojis al nombre.' },
      { tipo: 'nuevo', texto: 'Cambiar el nombre o borrar una sala ahora es con clic derecho sobre la sala.' },
      { tipo: 'nuevo', texto: 'Sonido corto cuando alguien entra o sale de la sala.' },
      { tipo: 'nuevo', texto: 'La X ya no cierra la app: queda en la bandeja, al lado de la hora (la voz sigue). Para cerrarla del todo, clic derecho en el ícono → Salir. Ahí usa menos memoria si no estás en una llamada.' },
      { tipo: 'nuevo', texto: 'Los nombres de usuario son únicos, foto de perfil por defecto, foto de grupo e ícono nuevo de la app.' },
      { tipo: 'arreglo', texto: 'La transmisión ya no se cuadricula al mover la cámara rápido en los juegos, y se ve nítida desde que empezás a mirarla.' },
      { tipo: 'arreglo', texto: 'Ya no se escucha doble al transmitir con sonido, y silenciar la transmisión funciona en pantalla completa.' },
      { tipo: 'arreglo', texto: 'La música de la sala ya no se corta al cambiar de chat o de grupo.' },
      { tipo: 'arreglo', texto: 'Los menús del clic derecho ya no se salen de la pantalla.' },
    ],
  },
];
