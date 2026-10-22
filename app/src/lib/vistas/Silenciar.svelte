<script lang="ts">
  import { Bell, BellOff } from '@lucide/svelte';
  import { abrirEnPunto } from '../menu';
  import { DURACIONES, silenciar, silenciadoHasta, esParaSiempre } from '../notificaciones.svelte';

  // Campanita del chat: silenciar sus avisos por un tiempo o para siempre.
  let { chat }: { chat: string } = $props();
  let menu = $state<HTMLElement>();
  const hasta = $derived(silenciadoHasta(chat));
  const titulo = $derived(!hasta ? 'Silenciar' : esParaSiempre(hasta) ? 'Silenciado' : `Silenciado hasta el ${new Date(hasta).toLocaleString('es', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  const elegir = (dias: number | null) => { menu?.hidePopover(); silenciar(chat, dias); };
</script>

<button class="icono" title={titulo} aria-label={`${titulo} (avisos del chat)`} onclick={(e) => { const r = e.currentTarget.getBoundingClientRect(); abrirEnPunto(menu, r.right - 200, r.bottom + 4); }}>
  {#if hasta}<BellOff size={16} strokeWidth={1.75} />{:else}<Bell size={16} strokeWidth={1.75} />{/if}
</button>
<div popover class="menu" bind:this={menu}>
  {#if hasta}<button class="plano" onclick={() => elegir(0)}>Quitar silencio</button><hr />{/if}
  <small>Silenciar</small>
  {#each DURACIONES as [texto, dias] (texto)}<button class="plano" onclick={() => elegir(dias)}>{texto}</button>{/each}
</div>

<style>
  .menu { position: fixed; inset: auto; margin: 0; padding: 8px; width: 200px; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde); border-radius: var(--radio-menu); }
  .menu:popover-open { display: flex; }
  .menu button { justify-content: flex-start; }
  .menu small { padding: 4px 8px 0; font-size: 11px; color: var(--tenue); }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
</style>
