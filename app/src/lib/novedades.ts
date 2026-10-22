// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.3.7', fecha: '2026-10-22', cambios: [
      { tipo: 'nuevo', texto: 'Mirá varias transmisiones a la vez: arriba elegí ver 1, 2 o 3, y tocá "Ver" en cada uno que transmite.' },
      { tipo: 'nuevo', texto: 'Música: pegá una lista de YouTube o YouTube Music y se agregan todos sus temas (hasta 200), en orden o mezclados.' },
      { tipo: 'nuevo', texto: 'Editá tus mensajes con el lápiz: quedan marcados como "(editado)".' },
      { tipo: 'nuevo', texto: 'Aviso de mensajes nuevos con sonido, y notificación de Windows si la app no está a la vista. Cada chat se puede silenciar con su campanita.' },
      { tipo: 'nuevo', texto: 'Sonidos al empezar alguien a transmitir y, para el que transmite, cuando alguien se pone a mirarlo.' },
      { tipo: 'nuevo', texto: 'Clic derecho en un sonido de la botonera para cambiarle el nombre o el volumen.' },
      { tipo: 'nuevo', texto: 'Configuraciones más grandes y por secciones: Audio, Transmisión y Notificaciones.' },
      { tipo: 'arreglo', texto: 'Volumen de las personas: el 200% de antes ahora es el 100%, y se puede subir hasta el doble.' },
      { tipo: 'arreglo', texto: 'Se pide confirmación antes de borrar mensajes y sonidos. Los sonidos se borran solo desde Configuraciones.' },
      { tipo: 'arreglo', texto: 'El menú del nombre del grupo se cierra al volver a tocarlo.' },
      { tipo: 'arreglo', texto: 'La música ya no debería saltar para adelante o para atrás de golpe.' },
      { tipo: 'arreglo', texto: 'La app busca actualizaciones cada hora (nunca en plena llamada).' },
    ],
  },
];
