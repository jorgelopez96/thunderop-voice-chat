// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.14.0', fecha: '2026-11-22', cambios: [
      { tipo: 'nuevo', texto: 'Al prender la cámara primero te ves vos solo en una vista previa; los demás te ven recién cuando tocás "Compartir cámara".' },
      { tipo: 'nuevo', texto: 'Fondo difuminado para la cámara, suave o fuerte. Se elige en la vista previa y se puede cambiar en vivo con la flechita al lado del botón (en el celular, en Más).' },
      { tipo: 'nuevo', texto: 'Desde el celular podés pasar a la cámara trasera, en la vista previa o en Más.' },
    ],
  },
];
