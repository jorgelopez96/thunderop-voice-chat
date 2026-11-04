// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.7.3', fecha: '2026-11-04', cambios: [
      { tipo: 'nuevo', texto: 'Inicio nuevo en la PC: tus grupos a la izquierda con buscador y filtros, al centro quién está en voz y la charla reciente del grupo que marques, y tus amigos a la derecha.' },
      { tipo: 'nuevo', texto: 'La app se fija si hay una versión nueva a cada hora en punto, sin tener que cerrarla.' },
      { tipo: 'nuevo', texto: 'En pantalla completa aparece la barrita de la llamada (silenciarte, ensordecerte, transmitir, sonidos, música y cortar).' },
      { tipo: 'nuevo', texto: 'Sonidos sin límite: se pueden tocar y mezclar todos los que quieras, y se ve quién tocó cada uno.' },
      { tipo: 'nuevo', texto: 'El borde de quien habla sale con el color que eligió en su perfil, y se ve más parejo mientras habla.' },
      { tipo: 'nuevo', texto: 'Las secciones de salas de voz y chats también se pueden ordenar arrastrándolas.' },
      { tipo: 'arreglo', texto: 'Transmitir jugando ya no satura tu internet: respeta los fps que elegiste y no manda más de lo que pediste.' },
      { tipo: 'arreglo', texto: 'Ya no aparece «Ex miembro» en el chat de la sala, el micrófono no sale repetido en la lista y el botón Participantes cierra su ventanita.' },
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
