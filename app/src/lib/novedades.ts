// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.6.0', fecha: '2026-10-24', cambios: [
      { tipo: 'nuevo', texto: 'Cuentas nuevas: ahora tenés un usuario único (para entrar y para que te agreguen) además del apodo.' },
      { tipo: 'nuevo', texto: 'Al crear la cuenta te mandamos un código por mail para confirmarla.' },
      { tipo: 'nuevo', texto: '¿Te olvidaste la contraseña? Podés cambiarla con un código que te llega por mail.' },
      { tipo: 'nuevo', texto: 'Podés entrar con Google.' },
      { tipo: 'nuevo', texto: 'Aviso: empezamos de cero. Las cuentas, grupos y mensajes anteriores no se migraron, hay que crear la cuenta de nuevo.' },
      { tipo: 'arreglo', texto: 'Con la supresión de ruido activada a algunos se los escuchaba solo del lado izquierdo: ya se escuchan de los dos lados.' },
      { tipo: 'nuevo', texto: 'Al transmitir elegís qué compartir con miniaturas de todas tus pantallas y ventanas, en cualquier monitor.' },
      { tipo: 'nuevo', texto: 'Si tu PC no tiene codificador de video por hardware, la transmisión usa uno por software (hasta 720p y 30 fps).' },
      { tipo: 'nuevo', texto: 'Cuando una transmisión falla, el mensaje explica mejor qué pasó.' },
      { tipo: 'nuevo', texto: 'Sacamos la opción «Codificar con la GPU»: la app usa siempre lo mejor que tenga tu PC.' },
      { tipo: 'nuevo', texto: 'De cada transmisión se envía un registro técnico para ayudarnos a arreglar problemas (sin imágenes ni nombres de ventanas).' },
      { tipo: 'nuevo', texto: 'Configuración del grupo renovada: descripción, solapa Participantes (cuándo se creó cada cuenta y desde cuándo está en el grupo), Baneados y Borrar grupo.' },
      { tipo: 'nuevo', texto: 'El dueño puede banear: el baneado sale del grupo y no puede volver con invitaciones hasta que lo desbaneen.' },
      { tipo: 'nuevo', texto: 'Nueva ventana para subir sonidos a la botonera.' },
      { tipo: 'arreglo', texto: 'Los menús (emojis, GIFs, micrófono, salida de audio) ahora se cierran al tocar de nuevo su botón.' },
      { tipo: 'arreglo', texto: 'El menú del perfil quedó alineado y los links de invitación dicen thunderop://.' },
      { tipo: 'nuevo', texto: 'Configuración renovada: solapa Cuenta (tus datos, cambiar la contraseña, desactivar o borrar la cuenta), Notificaciones y Apariencia y rendimiento.' },
      { tipo: 'nuevo', texto: 'Podés elegir si las horas se ven en formato de 24 o de 12 horas.' },
    ],
  },
];
