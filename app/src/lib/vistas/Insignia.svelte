<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { Crown } from '@lucide/svelte';
  // Orden fijo: verificado (tilde azul) → fundador (rayo) → dueño (corona).
  let { usuario, dueno = false }: { usuario?: RecordModel; dueno?: boolean } = $props();
</script>

{#if usuario?.verificado}
  <span class="insignia" title="Cuenta verificada" aria-label="Cuenta verificada">
    <!-- La forma de BadgeCheck de Lucide, rellena. -->
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" fill="var(--verificado)" />
      <path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
{/if}

{#if usuario?.fundador}
  <span class="insignia" title="Fundador de Thunderop" aria-label="Fundador de Thunderop">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--acento)" /></svg>
  </span>
{/if}
{#if dueno}<span class="insignia" title="Dueño del grupo" aria-label="Dueño del grupo"><Crown size={14} strokeWidth={1.75} color="var(--corona)" /></span>{/if}

<style>
  .insignia { display: inline-flex; vertical-align: -2px; margin-left: 4px; }
</style>
