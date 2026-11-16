// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.13.0', fecha: '2026-11-16', cambios: [
      { tipo: 'nuevo', texto: 'Atajos de teclado y mouse (Configuración → Atajos): silenciarte, ensordecerte y pulsar para hablar sin abrir la app, también con los botones laterales del mouse.' },
      { tipo: 'nuevo', texto: 'Al entrar a un grupo se abre el último chat en el que estuviste, listo para escribir.' },
      { tipo: 'nuevo', texto: 'Si estás en "Disponible" y no tocás la PC por 10 minutos, los demás te ven "Ausente"; al volver, "Disponible" otra vez. En una sala de voz no pasa.' },
      { tipo: 'nuevo', texto: 'Cuando alguien cierra la app o apaga la PC se ve "Desconectado" en unos segundos (antes tardaba hasta un minuto y medio).' },
      { tipo: 'arreglo', texto: 'La cámara de quien transmite con "Pantalla + cámara" ya no titila (tampoco las de las tarjetas de la llamada).' },
      { tipo: 'arreglo', texto: 'El sonido sale por la salida que elegiste en Configuración → Audio aunque entres a la sala silenciado (antes se escuchaba por la de Windows).' },
      { tipo: 'arreglo', texto: 'Entrar y salir de pantalla completa ya no muestra la ventana achicándose y agrandándose.' },
      { tipo: 'arreglo', texto: 'Con la ventana angosta los textos ya no se cortan ni se montan.' },
    ],
  },
];
