<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  let { usuario }: { usuario?: RecordModel } = $props();
</script>

{#if usuario?.fundador}
  <span class="insignia" title="Fundador de Thunderop" aria-label="Fundador de Thunderop">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--acento)" /></svg>
  </span>
{/if}

<style>
  .insignia { display: inline-flex; vertical-align: -2px; margin-left: 4px; }
</style>
