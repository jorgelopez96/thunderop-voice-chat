<script lang="ts">
  import type { Snippet } from 'svelte';
  import { EllipsisVertical, BellOff, Bell, ChevronLeft } from '@lucide/svelte';
  import { abrirEnPunto, alTocar, estabaAbierto } from '../menu';
  import { DURACIONES, silenciar, silenciadoHasta, esParaSiempre } from '../notificaciones.svelte';

  // Tres puntitos arriba del chat: silenciar sus avisos y, si quien lo usa las pasa, más acciones (`acciones` recibe cerrar).
  let { chat, acciones }: { chat: string; acciones?: Snippet<[() => void]> } = $props();
  let menu = $state<HTMLElement>();
  const hasta = $derived(silenciadoHasta(chat));
  const estado = $derived(!hasta ? '' : esParaSiempre(hasta) ? 'Silenciado' : `Silenciado hasta el ${new Date(hasta).toLocaleString('es', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  const cerrar = () => menu?.hidePopover();
  const elegir = (dias: number | null) => { cerrar(); silenciar(chat, dias); };
</script>

<span class="lado">
  {#if hasta}<span class="silenciado" title={estado} aria-label={estado}><BellOff size={14} strokeWidth={1.75} /></span>{/if}
  <button class="icono" title="Opciones del chat" aria-label="Opciones del chat" onpointerdown={() => alTocar(menu)} onclick={(e) => { if (estabaAbierto(menu)) return; const r = e.currentTarget.getBoundingClientRect(); abrirEnPunto(menu, r.right - 220, r.bottom + 4); }}>
    <EllipsisVertical size={16} strokeWidth={1.75} />
  </button>
</span>
<!-- "Silenciar" abre sus opciones en un cuadrito al costado (a la izquierda: el menú vive pegado al borde derecho). -->
<div popover class="menu" bind:this={menu}>
  {#if hasta}<small>{estado}</small><button class="plano" onclick={() => elegir(0)}><Bell size={16} strokeWidth={1.75} /> Quitar silencio</button>
  {:else}
    <div class="con-sub">
      <button class="plano" aria-haspopup="menu"><BellOff size={16} strokeWidth={1.75} /> Silenciar<ChevronLeft class="flecha" size={14} strokeWidth={1.75} /></button>
      <div class="sub" role="menu">
        {#each DURACIONES as [texto, dias] (texto)}<button class="plano" role="menuitem" onclick={() => elegir(dias)}>{texto}</button>{/each}
      </div>
    </div>
  {/if}
  {#if acciones}<hr />{@render acciones(cerrar)}{/if}
</div>

<style>
  .lado { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .silenciado { display: grid; color: var(--apagado); }
  .menu { position: fixed; inset: auto; margin: 0; padding: 6px; width: 220px; flex-direction: column; gap: 2px; overflow: visible;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); }
  .menu:popover-open { display: flex; }
  .menu :global(button) { justify-content: flex-start; gap: 10px; width: 100%; padding: 7px 10px; text-align: left; white-space: nowrap; font-weight: 450; }
  .menu :global(button:not(.peligro)) { color: var(--texto); }
  .menu small { padding: 4px 10px 2px; font-size: 11.5px; color: var(--tenue); }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
  .con-sub { position: relative; }
  .con-sub :global(.flecha) { margin-left: auto; color: var(--tenue); }
  .sub { position: absolute; top: -6px; right: calc(100% + 4px); display: none; flex-direction: column; gap: 2px; min-width: 210px; padding: 6px;
    background: var(--elevado); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); }
  /* Puente invisible entre el botón y el cuadrito, para que no se cierre al cruzar el hueco con el mouse. */
  .sub::after { content: ''; position: absolute; top: 0; bottom: 0; left: 100%; width: 8px; }
  .con-sub:hover .sub, .con-sub:focus-within .sub { display: flex; }
  .con-sub:hover > button, .con-sub:focus-within > button { background: var(--hover); }
</style>
