// Cerrar un <dialog> tocando afuera (el fondo). Solo si se apretó Y se soltó afuera: si se aprieta adentro (por ejemplo
// seleccionando texto) y se suelta afuera, el navegador manda el clic al dialog igual, y antes eso lo cerraba.
export function cerrarAfuera(d: HTMLDialogElement) {
  let empezoAfuera = false;
  const abajo = (e: Event) => { empezoAfuera = e.target === d; };
  const clic = (e: Event) => {
    if (empezoAfuera && e.target === d) d.close();
    empezoAfuera = false;
  };
  d.addEventListener('pointerdown', abajo);
  d.addEventListener('click', clic);
  return {
    destroy() {
      d.removeEventListener('pointerdown', abajo);
      d.removeEventListener('click', clic);
    },
  };
}
