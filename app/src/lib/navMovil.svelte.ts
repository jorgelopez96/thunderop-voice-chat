// Navegación del celular: qué pestaña de abajo está elegida (Inicio, Grupos, Amigos, Perfil).
export type Pestana = 'inicio' | 'grupos' | 'amigos' | 'perfil';
export const navMovil = $state<{ pestana: Pestana }>({ pestana: 'inicio' });
