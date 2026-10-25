<script lang="ts">
  import { House, LayoutGrid, Users, CircleUser } from '@lucide/svelte';
  import { navMovil, type Pestana } from '../../navMovil.svelte';

  // Pestañas fijas abajo en las pantallas de afuera del celular.
  const PESTANAS = [['inicio', 'Inicio', House], ['grupos', 'Grupos', LayoutGrid], ['amigos', 'Amigos', Users], ['perfil', 'Perfil', CircleUser]] as const;
</script>

<nav class="pestanas" aria-label="Secciones">
  {#each PESTANAS as [id, texto, Icono] (id)}
    <button class="plano" aria-pressed={navMovil.pestana === id} onclick={() => (navMovil.pestana = id as Pestana)}>
      <Icono size={22} strokeWidth={1.75} /><span>{texto}</span></button>
  {/each}
</nav>

<style>
  .pestanas { flex: none; display: grid; grid-template-columns: repeat(4, 1fr); height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom); background: var(--panel); border-top: 1px solid var(--borde); }
  button { flex-direction: column; gap: 3px; height: 56px; min-height: 44px; border-radius: 0; font-size: 11px; font-weight: 550; color: var(--tenue); }
  button:hover:not(:disabled) { background: none; }
  button[aria-pressed='true'] { background: none; color: var(--acento-texto); }
</style>
