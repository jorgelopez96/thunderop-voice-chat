<script lang="ts">
  import type { Snippet } from 'svelte';
  import { pantalla } from '../../plataforma.svelte';
  import { cerrarCapa } from '../../navMovil.svelte';

  // En el celular, el contenido va en un cajón que entra desde un costado (con velo); en la PC se muestra tal cual.
  let { lado, abierto, children }: { lado: 'izq' | 'der'; abierto: boolean; children: Snippet } = $props();
</script>

{#if pantalla.movil}
  {#if abierto}<button class="velo" aria-label="Cerrar" onclick={cerrarCapa}></button>{/if}
  <div class="cajon {lado}" class:abierto aria-hidden={!abierto} inert={!abierto}>{@render children()}</div>
{:else}
  {@render children()}
{/if}

<style>
  .velo { position: fixed; inset: 0; z-index: 20; padding: 0; border: 0; border-radius: 0; background: rgb(5 6 9 / .6); }
  .velo:hover:not(:disabled) { background: rgb(5 6 9 / .6); }
  .cajon { position: fixed; top: 0; bottom: 0; z-index: 21; display: flex; width: min(86vw, 340px); padding-top: env(safe-area-inset-top);
    background: var(--panel); box-shadow: var(--sombra-3); }
  .izq { left: 0; transform: translateX(-100%); border-right: 1px solid var(--borde); }
  .der { right: 0; transform: translateX(100%); border-left: 1px solid var(--borde); }
  .abierto { transform: none; }
  .cajon > :global(*) { flex: 1; min-width: 0; }
  :global([data-modo='moderno']) .cajon { transition: transform var(--dur-lenta) var(--curva-salida); }
</style>
