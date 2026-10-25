<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cerrarCapa } from '../../navMovil.svelte';

  // Celular: menú que sube desde abajo (lo que en la PC es la barrita por hover o el clic derecho).
  // Quien la abre registra la capa con conAtras; tocar el velo o atrás la cierra.
  let { abierta, children }: { abierta: boolean; children: Snippet } = $props();
</script>

{#if abierta}
  <button class="velo" aria-label="Cerrar" onclick={cerrarCapa}></button>
  <div class="hoja" role="menu">{@render children()}</div>
{/if}

<style>
  .velo { position: fixed; inset: 0; z-index: 30; padding: 0; border: 0; border-radius: 0; background: rgb(5 6 9 / .6); }
  .velo:hover:not(:disabled) { background: rgb(5 6 9 / .6); }
  .hoja { position: fixed; left: 0; right: 0; bottom: 0; z-index: 31; display: flex; flex-direction: column; gap: 2px;
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom)); background: var(--elevado); border-top: 1px solid var(--borde-fuerte);
    border-radius: var(--radio-grande) var(--radio-grande) 0 0; box-shadow: var(--sombra-3); }
  .hoja :global(button) { justify-content: flex-start; gap: 12px; min-height: 48px; padding: 0 14px; font-size: 15px; }
  .hoja :global(button:not(.peligro)) { color: var(--texto); }
  :global([data-modo='moderno']) .hoja { animation: sube 220ms var(--curva-salida); }
  @keyframes sube { from { transform: translateY(100%); } }
</style>
