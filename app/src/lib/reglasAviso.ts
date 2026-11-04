// Reglas de los avisos de mensajes nuevos, sin Tauri ni PocketBase (para poder probarlas).

type Caso = {
  mencion: boolean; // te nombraron con @
  avisoMenciones: boolean; // preferencias
  avisoMensajes: boolean;
  notificaciones: boolean;
  silenciado: boolean; // el chat
  aLaVista: boolean; // ventana visible y con foco
  viendoChat: boolean; // ese chat está abierto
};

/** `avisa`: sonido y campanita; `destacar`: titileo y globito en la barra de tareas; `notificar`: notificación de Windows. */
export function queAvisar(c: Caso) {
  const avisa = ((c.mencion && c.avisoMenciones) || (c.avisoMensajes && !c.silenciado)) && !(c.aLaVista && c.viendoChat);
  const destacar = avisa && !c.aLaVista;
  return { avisa, destacar, notificar: destacar && c.notificaciones };
}

/** Sin leer de los chats que no están silenciados. */
export function contarSinLeer(cuentas: Record<string, number>[], silenciado: (chat: string) => boolean): number {
  let n = 0;
  for (const c of cuentas) for (const [chat, k] of Object.entries(c)) if (!silenciado(chat)) n += k;
  return n;
}

/** Número del globito: vacío si no llegó nada desde que se fue; si no, los sin leer (al menos los que llegaron), "9+" si son muchos.
 * Lo que llegó cuenta aunque el chat esté silenciado (menciones con @). */
export function textoGlobito(sinLeer: number, nuevos: number): string {
  if (nuevos <= 0) return '';
  const n = Math.max(sinLeer, nuevos);
  return n > 9 ? '9+' : String(n);
}
