// Tema de color de la app, por dispositivo (`localStorage['dm.tema']`). Los colores están en app.css ([data-tema]).
export const TEMAS = [
  { id: 'pulse', nombre: 'Pulse', color: '#8B7CF6' },
  { id: 'oceano', nombre: 'Océano', color: '#3B9EE8' },
  { id: 'bosque', nombre: 'Bosque', color: '#3FB37F' },
  { id: 'fuego', nombre: 'Fuego', color: '#F07A3E' },
  { id: 'rosa', nombre: 'Rosa', color: '#E5609E' },
  { id: 'grafito', nombre: 'Grafito', color: '#A5ABBD' },
] as const;

export function temaGuardado(): string {
  try { return localStorage.getItem('dm.tema') ?? 'pulse'; } catch { return 'pulse'; }
}

export function aplicarTema(id: string) {
  if (!TEMAS.some((t) => t.id === id)) id = 'pulse';
  if (id === 'pulse') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = id;
  try { localStorage.setItem('dm.tema', id); } catch { /* sin almacenamiento: dura esta sesión */ }
}
