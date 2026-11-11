<script lang="ts">
  import { MicOff, HeadphoneOff, Video } from '@lucide/svelte';
  // Cómo está alguien en la voz, igual en todas las listas: ensordecido (auricular tachado, ya implica el micrófono
  // apagado), si no micrófono apagado, y la cámara prendida.
  let { silenciado = false, ensordecido = false, camara = false, tam = 14 }: { silenciado?: boolean; ensordecido?: boolean; camara?: boolean; tam?: number } = $props();
</script>

{#if ensordecido}<span class="estado rojo" title="Ensordecido" aria-label="Ensordecido"><HeadphoneOff size={tam} strokeWidth={1.75} /></span>
{:else if silenciado}<span class="estado rojo" title="Sin micrófono" aria-label="Silenciado"><MicOff size={tam} strokeWidth={1.75} /></span>{/if}
{#if camara}<span class="estado" title="Con la cámara prendida" aria-label="Con la cámara prendida"><Video size={tam} strokeWidth={1.75} /></span>{/if}

<style>
  .estado { display: inline-flex; flex: none; color: var(--acento-texto); }
  .rojo { color: var(--peligro); }
</style>
