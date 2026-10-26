// Notificaciones en la versión web. El permiso se pide solo al prender "Notificaciones de escritorio" en Configuración
// (sin un toque del usuario los navegadores lo rechazan o lo terminan bloqueando).

/** Muestra la notificación si ya hay permiso; si no hay o el navegador no deja (Chrome de Android), no hace nada. */
export function mostrar(titulo: string, texto: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try { new Notification(titulo, { body: texto }); } catch { /* quedan el sonido y el contador */ }
}

export async function pedirPermiso(): Promise<NotificationPermission | 'sin-soporte'> {
  if (typeof Notification === 'undefined') return 'sin-soporte';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}
