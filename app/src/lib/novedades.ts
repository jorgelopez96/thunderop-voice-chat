// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.7.0', fecha: '2026-10-25', cambios: [
      { tipo: 'nuevo', texto: 'Diseño renovado en toda la app: logo nuevo, barra de título propia del color de la ventana, portada con «Ahora en voz» y panel de amigos, chat, sala de voz y dock rediseñados.' },
      { tipo: 'nuevo', texto: 'Modo visual en Configuración → Apariencia: Básico (liviano, sin animaciones, ideal mientras jugás) o Moderno (sombras, brillos en tu color y animaciones cortas).' },
      { tipo: 'nuevo', texto: 'La campanita ahora junta todas las notificaciones: menciones, mensajes privados y solicitudes de amistad. Se pueden borrar cuando ya las leíste.' },
      { tipo: 'nuevo', texto: 'Las actualizaciones se bajan solas en segundo plano: la campanita te avisa y elegís cuándo reiniciar.' },
    ],
  },
];
