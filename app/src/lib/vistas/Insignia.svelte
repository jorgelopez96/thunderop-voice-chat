<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { Crown } from '@lucide/svelte';
  // Orden fijo: fundador (rayo) → dueño (corona).
  let { usuario, dueno = false }: { usuario?: RecordModel; dueno?: boolean } = $props();
</script>

{#if usuario?.fundador}
  <span class="insignia" title="Fundador de Thunderop" aria-label="Fundador de Thunderop">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--acento)" /></svg>
  </span>
{/if}
{#if dueno}<span class="insignia" title="Dueño del grupo" aria-label="Dueño del grupo"><Crown size={14} strokeWidth={1.75} color="var(--corona)" /></span>{/if}

<style>
  .insignia { display: inline-flex; vertical-align: -2px; margin-left: 4px; }
</style>
