<script lang="ts">
  import { Smile } from '@lucide/svelte';
  import { EMOJIS } from '../emojis';
  import { abrirEnPunto, alTocar, estabaAbierto } from '../menu';

  // Carita que abre el menú de emojis; `elegir` recibe el elegido. Con `actual`, el botón muestra ese emoji en vez de la carita.
  // Con `texto`, se ve como un campo (carita + texto gris) en vez de un botoncito.
  let { elegir, actual = '', texto = '' }: { elegir: (emoji: string) => void; actual?: string; texto?: string } = $props();
  let menu = $state<HTMLElement>();
</script>

<button type="button" class="plano carita" class:campo={!!texto} title="Emojis" aria-label="Emojis"
  onpointerdown={() => alTocar(menu)} onclick={(e) => { if (estabaAbierto(menu)) return; const r = e.currentTarget.getBoundingClientRect(); abrirEnPunto(menu, r.left, r.bottom + 4); }}>{#if actual}<span class="actual">{actual}</span>{:else}<Smile size={18} strokeWidth={1.75} />{/if}{#if texto}<span class="texto">{texto}</span>{/if}</button>
<div popover class="emojis" bind:this={menu}>
  {#each EMOJIS as emoji (emoji)}<button type="button" class="plano" onclick={() => { menu?.hidePopover(); elegir(emoji); }}>{emoji}</button>{/each}
</div>

<style>
  .carita { padding: 4px; color: var(--icono); }
  .actual { font-size: 18px; line-height: 18px; }
  .campo { width: 100%; justify-content: flex-start; gap: 8px; padding: 0 10px; height: 38px; border: 1px solid var(--borde); background: var(--hondo); border-radius: var(--radio); }
  .texto { color: var(--apagado); font-weight: 400; }
  .emojis { position: fixed; inset: auto; margin: 0; padding: 6px; width: 296px; flex-wrap: wrap; gap: 2px; background: var(--panel); border: 1px solid var(--borde); border-radius: 10px; }
  .emojis:popover-open { display: flex; }
  .emojis button { font-size: 20px; padding: 2px; min-height: 0; width: 34px; height: 34px; }
</style>
