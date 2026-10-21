import { tick } from 'svelte';

/** Abre un menú (popover) donde se hizo clic sin que se salga de la ventana: se mide ya abierto y se corre hacia adentro. */
export async function abrirEnPunto(menu: HTMLElement | undefined, x: number, y: number) {
  if (!menu) return;
  await tick(); // el contenido depende de a quién se eligió
  if (!menu.matches(':popover-open')) menu.showPopover();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
}
