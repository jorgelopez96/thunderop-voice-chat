// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.3.8', fecha: '2026-10-22', cambios: [
      { tipo: 'nuevo', texto: 'Mirá varias transmisiones a la vez: tocá "Ver" en la tarjeta de cada uno y se van sumando. "Dejar de ver" saca esa sola.' },
      { tipo: 'nuevo', texto: 'Los links del chat se abren en tu navegador y muestran una vista previa con imagen y título (YouTube y la mayoría de las páginas).' },
      { tipo: 'nuevo', texto: 'Tres puntitos arriba de cada chat: silenciar notificaciones y, en privados, eliminar amigo.' },
      { tipo: 'nuevo', texto: 'El dueño del grupo puede desconectar a alguien de la llamada (clic derecho en su tarjeta).' },
      { tipo: 'nuevo', texto: 'Configuración → Audio: volumen del micrófono de 0% a 100% y barritas que se mueven cuando hablás.' },
      { tipo: 'arreglo', texto: 'Si dejabas de escuchar a alguien después de un corte, ahora se vuelve a conectar solo.' },
      { tipo: 'arreglo', texto: 'Ensordecido ya no escuchás los sonidos de la botonera.' },
      { tipo: 'arreglo', texto: 'La música vuelve a sincronizar como antes.' },
    ],
  },
];
