// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.5.1', fecha: '2026-10-23', cambios: [
      { tipo: 'nuevo', texto: 'Botonera: cada sonido puede llevar su emoji adelante del nombre (tocá la carita al subirlo o con clic derecho para editarlo).' },
      { tipo: 'nuevo', texto: 'Botonera: los sonidos aparecen en el orden en que se subieron.' },
      { tipo: 'nuevo', texto: 'Mientras transmitís podés cambiar la calidad sin cortar: tocá la flechita al lado del botón de transmitir.' },
      { tipo: 'nuevo', texto: 'Menciones: escribí @ en el chat y elegí a alguien del grupo. Al mencionado le llega el aviso aunque tenga ese chat silenciado.' },
      { tipo: 'nuevo', texto: 'Reacciones: pasá el mouse por arriba de una reacción para ver quién reaccionó.' },
      { tipo: 'arreglo', texto: 'Si transmitís una ventana, se escucha solo el sonido de ese programa (antes se escuchaba toda la PC).' },
      { tipo: 'arreglo', texto: 'Volvió la vista previa de tu transmisión y el contador de cuántos te están mirando.' },
    ],
  },
];
