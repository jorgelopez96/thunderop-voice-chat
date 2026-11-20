// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.13.2', fecha: '2026-11-20', cambios: [
      { tipo: 'nuevo', texto: 'Silenciarte y ensordecerte hacen un sonidito, así sabés que se hizo (también con los atajos).' },
      { tipo: 'nuevo', texto: 'Desde el celular, "Girar la cámara" (en Más) la pone de costado para todos.' },
      { tipo: 'arreglo', texto: 'Ensordecerte corta el sonido al instante, en vez de bajarlo de a poco. En iPhone ahora sí lo corta.' },
      { tipo: 'arreglo', texto: 'Una cámara en pantalla completa ya no deja ver la app de fondo al mover el mouse.' },
      { tipo: 'arreglo', texto: 'En Configuración → Atajos los botones quedan fijos al elegir una tecla.' },
    ],
  },
];
