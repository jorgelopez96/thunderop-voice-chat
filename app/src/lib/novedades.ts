// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.3.6', fecha: '2026-10-21', cambios: [
      { tipo: 'nuevo', texto: 'Elegí tu estado desde tu perfil, arriba a la derecha: Disponible, Ausente, Ocupado o Invisible. La lucecita de tu foto cambia de color.' },
      { tipo: 'nuevo', texto: 'Salir de Thunderop desde el menú del perfil (cerrar la ventana la deja en la bandeja).' },
      { tipo: 'nuevo', texto: 'Botón rojo para colgar en la barra de la llamada, al lado del micrófono y los auriculares.' },
      { tipo: 'nuevo', texto: 'Contador de espectadores en la transmisión: ves cuántos la están mirando.' },
      { tipo: 'arreglo', texto: 'La transmisión ya no tiene tope de calidad y se ve nítida desde que empezás a mirarla.' },
      { tipo: 'arreglo', texto: 'Tu perfil ya no aparece repetido abajo: queda solo arriba a la derecha.' },
    ],
  },
];
