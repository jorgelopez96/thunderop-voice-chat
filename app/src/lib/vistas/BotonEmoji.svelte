<script lang="ts">
  import { Smile } from '@lucide/svelte';
  import MenuEmojis from './MenuEmojis.svelte';
  import { abrirEnPunto, alTocar, estabaAbierto } from '../menu';

  // Carita que abre el menú de emojis; `elegir` recibe el elegido. Con `actual`, el botón muestra ese emoji en vez de la carita.
  // Con `texto`, se ve como un campo (carita + texto gris) en vez de un botoncito.
  let { elegir, actual = '', texto = '' }: { elegir: (emoji: string) => void; actual?: string; texto?: string } = $props();
  let menu = $state<HTMLElement>();
</script>

<button type="button" class="plano carita" class:campo={!!texto} title="Emojis" aria-label="Emojis"
  onpointerdown={() => alTocar(menu)} onclick={(e) => { if (estabaAbierto(menu)) return; const r = e.currentTarget.getBoundingClientRect(); abrirEnPunto(menu, r.left, r.bottom + 4); }}>{#if actual}<span class="actual">{actual}</span>{:else}<Smile size={18} strokeWidth={1.75} />{/if}{#if texto}<span class="texto">{texto}</span>{/if}</button>
<MenuEmojis bind:menu {elegir} />

<style>
  .carita { padding: 4px; color: var(--icono); }
  .actual { font-size: 18px; line-height: 18px; }
  .campo { width: 100%; justify-content: flex-start; gap: 8px; padding: 0 10px; height: 38px; border: 1px solid var(--borde); background: var(--hondo); border-radius: var(--radio); }
  .texto { color: var(--apagado); font-weight: 400; }
</style>
