import { tick } from 'svelte';

/** Abre un menú (popover) donde se hizo clic sin que se salga de la ventana: se mide ya abierto y se corre hacia adentro. */
export async function abrirEnPunto(menu: HTMLElement | undefined, x: number, y: number) {
  if (!menu) return;
  await tick(); // el contenido depende de a quién se eligió
  if (!menu.matches(':popover-open')) menu.showPopover();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
}

// El toque afuera cierra el popover antes del click: sin esto, volver a tocar el botón lo cerraba y lo reabría.
let tocado: HTMLElement | undefined;
/** En el pointerdown del botón que abre `menu`: anota si estaba abierto. */
export const alTocar = (menu?: HTMLElement) => { tocado = menu?.matches(':popover-open') ? menu : undefined; };
/** En el click del mismo botón: si `menu` estaba abierto lo deja cerrado y da true (el botón alterna). */
export function estabaAbierto(menu?: HTMLElement): boolean {
  const si = !!menu && (tocado === menu || menu.matches(':popover-open'));
  tocado = undefined;
  if (menu?.matches(':popover-open')) menu.hidePopover();
  return si;
}
