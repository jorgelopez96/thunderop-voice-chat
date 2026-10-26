// Celular: mantener apretado (500 ms sin mover el dedo) hace lo que en la PC es el clic derecho o pasar el mouse.
// Solo con el dedo o el lápiz: con mouse siguen el clic derecho y la barrita por hover.
const ESPERA = 500, TOLERANCIA = 10;

export function mantener(nodo: HTMLElement, alMantener: (x: number, y: number) => void) {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  let desde = { x: 0, y: 0 };
  const cancelar = () => { clearTimeout(reloj); reloj = undefined; };
  const abajo = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    desde = { x: e.clientX, y: e.clientY };
    cancelar();
    reloj = setTimeout(() => { reloj = undefined; alMantener(desde.x, desde.y); }, ESPERA);
  };
  const mueve = (e: PointerEvent) => {
    if (reloj && Math.hypot(e.clientX - desde.x, e.clientY - desde.y) > TOLERANCIA) cancelar();
  };
  // El menú del sistema (copiar, compartir) no aparece encima del nuestro.
  const menuNativo = (e: Event) => { const t = (e as PointerEvent).pointerType; if (t === 'touch' || t === 'pen') e.preventDefault(); };
  nodo.addEventListener('pointerdown', abajo);
  nodo.addEventListener('pointermove', mueve);
  nodo.addEventListener('pointerup', cancelar);
  nodo.addEventListener('pointercancel', cancelar);
  nodo.addEventListener('contextmenu', menuNativo);
  return {
    update(f: typeof alMantener) { alMantener = f; },
    destroy() {
      cancelar();
      nodo.removeEventListener('pointerdown', abajo);
      nodo.removeEventListener('pointermove', mueve);
      nodo.removeEventListener('pointerup', cancelar);
      nodo.removeEventListener('pointercancel', cancelar);
      nodo.removeEventListener('contextmenu', menuNativo);
    },
  };
}
