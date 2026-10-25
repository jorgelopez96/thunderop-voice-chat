// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.7.1', fecha: '2026-10-25', cambios: [
      { tipo: 'nuevo', texto: 'Chat de amigos renovado: su foto al lado del nombre, se cierra tocando afuera o con la ✕, y el menú ⋮ trae Silenciar, Bloquear y Eliminar amigo.' },
      { tipo: 'nuevo', texto: 'Bloquear: deja de ser tu amigo, no puede escribirte ni mandarte solicitudes. Se desbloquea desde Configuración → Cuenta.' },
      { tipo: 'nuevo', texto: 'El dueño puede ordenar las salas arrastrándolas y elegir si los chats van arriba o abajo de las salas de voz.' },
      { tipo: 'nuevo', texto: 'Música: botón «Quitar todas». En el dock, un circulito verde, naranja o rojo según tu conexión.' },
      { tipo: 'nuevo', texto: 'Perfil nuevo: foto con lápiz para cambiarla, apodo, descripción corta y tu mail oculto. Sin foto, se muestra tu inicial con un color.' },
      { tipo: 'arreglo', texto: 'Al entrar a un chat te deja en el último mensaje, los GIFs ya no se salen del chat de la sala y la pantalla completa de una transmisión ocupa toda la pantalla.' },
      { tipo: 'arreglo', texto: 'La tarjeta de quien transmite se acomoda al tamaño, el clip quedó alineado y la descripción del grupo pasó a la tarjeta de Inicio.' },
    ],
  },
];
