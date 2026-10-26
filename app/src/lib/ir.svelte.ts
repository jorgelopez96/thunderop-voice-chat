import { grupoActual } from './grupos.svelte';
import { navMovil } from './navMovil.svelte';

// Adónde lleva tocar una notificación de la campanita: el privado de un amigo o una sala de un grupo.
export type Ir = { tipo: 'privado'; id: string } | { tipo: 'sala'; grupo: string; sala: string };

/** Pedido pendiente: lo atiende la vista que corresponde cuando se monta (Amigos abre el privado, Grupo la sala). */
export const irA = $state<{ privado: string | null; sala: string | null }>({ privado: null, sala: null });

export function irAlAviso(ir: Ir) {
  if (ir.tipo === 'sala') {
    irA.sala = ir.sala;
    grupoActual.id = ir.grupo;
  } else {
    irA.privado = ir.id;
    grupoActual.id = null;
    navMovil.pestana = 'amigos'; // en el celular la lista de amigos es su pestaña; en la PC está en Inicio
  }
}
