<script lang="ts">
  import { Smile } from '@lucide/svelte';
  import { EMOJIS } from '../emojis';
  import { abrirEnPunto } from '../menu';

  // Carita que abre el menú de emojis; `elegir` recibe el elegido.
  let { elegir }: { elegir: (emoji: string) => void } = $props();
  let menu = $state<HTMLElement>();
</script>

<button type="button" class="plano carita" title="Emojis" aria-label="Emojis"
  onclick={(e) => { const r = e.currentTarget.getBoundingClientRect(); abrirEnPunto(menu, r.left, r.bottom + 4); }}><Smile size={18} strokeWidth={1.75} /></button>
<div popover class="emojis" bind:this={menu}>
  {#each EMOJIS as emoji (emoji)}<button type="button" class="plano" onclick={() => { menu?.hidePopover(); elegir(emoji); }}>{emoji}</button>{/each}
</div>

<style>
  .carita { padding: 4px; color: var(--icono); }
  .emojis { position: fixed; inset: auto; margin: 0; padding: 6px; width: 296px; flex-wrap: wrap; gap: 2px; background: var(--panel); border: 1px solid var(--borde); border-radius: 10px; }
  .emojis:popover-open { display: flex; }
  .emojis button { font-size: 20px; padding: 2px; min-height: 0; width: 34px; height: 34px; }
</style>
