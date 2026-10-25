// Gesto del celular: arrastrar desde el borde abre un cajón (izquierdo: grupos y salas; derecho: participantes).
const BORDE = 24, RECORRIDO = 60;

export function deslizar(nodo: HTMLElement, op: { alAbrirIzq(): void; alAbrirDer(): void }) {
  let inicio: { x: number; y: number; lado: 'izq' | 'der' } | null = null;
  const abajo = (e: PointerEvent) => {
    inicio = e.clientX <= BORDE ? { x: e.clientX, y: e.clientY, lado: 'izq' }
      : e.clientX >= innerWidth - BORDE ? { x: e.clientX, y: e.clientY, lado: 'der' } : null;
  };
  const mueve = (e: PointerEvent) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
    if (Math.abs(dy) > Math.abs(dx)) { inicio = null; return; } // es scroll
    if (inicio.lado === 'izq' && dx >= RECORRIDO) { inicio = null; op.alAbrirIzq(); }
    else if (inicio.lado === 'der' && dx <= -RECORRIDO) { inicio = null; op.alAbrirDer(); }
  };
  const fin = () => (inicio = null);
  nodo.addEventListener('pointerdown', abajo);
  nodo.addEventListener('pointermove', mueve);
  nodo.addEventListener('pointerup', fin);
  nodo.addEventListener('pointercancel', fin);
  return {
    update(nuevo: typeof op) { op = nuevo; },
    destroy() {
      nodo.removeEventListener('pointerdown', abajo);
      nodo.removeEventListener('pointermove', mueve);
      nodo.removeEventListener('pointerup', fin);
      nodo.removeEventListener('pointercancel', fin);
    },
  };
}
