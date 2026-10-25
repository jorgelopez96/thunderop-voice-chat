<script lang="ts">
  import { isTauri } from '@tauri-apps/api/core';
  import type { Snippet } from 'svelte';

  // Barra de título propia (la ventana va sin decoraciones de Windows). Se arrastra desde la barra y desde
  // los huecos marcados con data-tauri-drag-region; doble clic maximiza. Cerrar pasa por CloseRequested
  // en lib.rs, que la manda a la bandeja igual que la X de antes.
  // `flotante`: pantallas sin barra propia (login, actualización): va encima, sin fondo.
  let { children, flotante = false }: { children?: Snippet; flotante?: boolean } = $props();

  const ventana = isTauri() ? import('@tauri-apps/api/window').then((m) => m.getCurrentWindow()) : null;
  let maximizada = $state(false);
  $effect(() => {
    if (!ventana) return;
    let fin: (() => void) | undefined;
    ventana.then(async (w) => {
      const ver = async () => { maximizada = await w.isMaximized(); };
      await ver();
      fin = await w.onResized(ver);
    });
    return () => fin?.();
  });
  const hacer = (f: (w: Awaited<NonNullable<typeof ventana>>) => Promise<void>) => ventana?.then(f).catch(() => {});
</script>

<header class="barra" class:flotante data-tauri-drag-region>
  {#if children}{@render children()}{:else}<div class="libre" data-tauri-drag-region></div>{/if}
  {#if ventana}
    <span class="sep"></span>
    <div class="ventana">
      <button aria-label="Minimizar" title="Minimizar" onclick={() => hacer((w) => w.minimize())}>
        <svg viewBox="0 0 10 10"><path d="M0 5.5h10" /></svg></button>
      <button aria-label={maximizada ? 'Restaurar' : 'Maximizar'} title={maximizada ? 'Restaurar' : 'Maximizar'} onclick={() => hacer((w) => w.toggleMaximize())}>
        {#if maximizada}
          <svg viewBox="0 0 10 10"><rect x=".5" y="2.5" width="7" height="7" rx="1.5" /><path d="M2.5 2.5V2A1.5 1.5 0 0 1 4 .5h4A1.5 1.5 0 0 1 9.5 2v4A1.5 1.5 0 0 1 8 7.5h-.5" /></svg>
        {:else}
          <svg viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" rx="1.5" /></svg>
        {/if}</button>
      <button class="cerrar" aria-label="Cerrar" title="Cerrar" onclick={() => hacer((w) => w.close())}>
        <svg viewBox="0 0 10 10"><path d="M.5.5l9 9M9.5.5l-9 9" /></svg></button>
    </div>
  {/if}
</header>

<style>
  .barra { display: flex; align-items: center; gap: 4px; height: 48px; padding-left: 8px; flex: none; user-select: none;
    background: var(--fondo); border-bottom: 1px solid var(--borde); }
  .flotante { position: fixed; inset: 0 0 auto; z-index: 10; background: none; border-bottom-color: transparent; }
  .barra :global(.libre) { flex: 1; align-self: stretch; min-width: 0; display: flex; align-items: center; }
  .barra :global(.libre *) { pointer-events: none; }
  .sep { width: 1px; height: 20px; margin: 0 4px; background: var(--borde-fuerte); }
  .ventana { display: flex; align-self: stretch; }
  .ventana button { width: 46px; height: 48px; min-height: 0; padding: 0; border: 0; border-radius: 0; background: none; color: var(--tenue); }
  .ventana button:hover { background: var(--hover-fuerte); color: var(--texto); }
  .ventana button:active { background: var(--activo); }
  .ventana .cerrar { border-top-right-radius: 8px; }
  svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1; shape-rendering: crispEdges; }
</style>
