<script lang="ts">
  import type { Snippet } from 'svelte';
  import { EllipsisVertical, BellOff } from '@lucide/svelte';
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
<div popover class="menu" bind:this={menu}>
  {#if hasta}<small>{estado}</small><button class="plano" onclick={() => elegir(0)}>Quitar silencio</button>
  {:else}<small>Silenciar este chat</small>
    {#each DURACIONES as [texto, dias] (texto)}<button class="plano" onclick={() => elegir(dias)}>{texto}</button>{/each}{/if}
  {#if acciones}<hr />{@render acciones(cerrar)}{/if}
</div>

<style>
  .lado { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .silenciado { display: grid; color: var(--apagado); }
  .menu { position: fixed; inset: auto; margin: 0; padding: 8px; width: 220px; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); }
  .menu:popover-open { display: flex; }
  .menu :global(button) { justify-content: flex-start; color: var(--texto); }
  .menu small { padding: 4px 8px 0; font-size: 11px; color: var(--tenue); }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
</style>
