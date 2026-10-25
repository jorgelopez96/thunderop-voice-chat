// Navegación del celular: qué pestaña de abajo está elegida (Inicio, Grupos, Amigos, Perfil).
export type Pestana = 'inicio' | 'grupos' | 'amigos' | 'perfil';
// `chatSala`: el chat de la sala de voz abierto a pantalla completa. `irASala`: la barrita de llamada pidió volver a la sala.
export const navMovil = $state<{ pestana: Pestana; chatSala: boolean; irASala: boolean }>({ pestana: 'inicio', chatSala: false, irASala: false });

// Capas que el botón atrás del celular cierra (grupo abierto, cajones, hojas): cada una deja una entrada en el
// historial; atrás la saca y llama a su `cerrar`. Cerrar desde la interfaz también pasa por el historial.
const capas: (() => void)[] = [];
export function conAtras(cerrar: () => void) {
  history.pushState({ capa: capas.length + 1 }, '');
  capas.push(cerrar);
}
export const cerrarCapa = () => { if (capas.length) history.back(); };
if (typeof window !== 'undefined') addEventListener('popstate', () => capas.pop()?.());
