<script lang="ts">
  import LogoThunderop from './LogoThunderop.svelte';
  import { actualizacion } from '../actualizacion.svelte';
</script>

<div class="fondo">
  <div class="cartel" role="status">
    <h1><LogoThunderop tam={26} /></h1>
    {#if actualizacion.estado === 'buscando'}
      <p class="tenue">Buscando actualizaciones…</p>
    {:else if actualizacion.estado === 'descargando'}
      <p>Actualizando Thunderop a la versión {actualizacion.version}…</p>
      <progress value={actualizacion.progreso} max="1" aria-label="Progreso de la actualización"></progress>
    {:else if actualizacion.estado === 'error'}
      <p role="alert">{actualizacion.error}</p>
      <button class="primario" onclick={() => (actualizacion.estado = 'lista')}>Entrar igual</button>
    {/if}
  </div>
</div>

<style>
  .fondo { position: fixed; inset: 0; display: grid; place-items: center; background: var(--hondo); }
  .cartel { display: flex; flex-direction: column; align-items: center; gap: 12px; width: min(360px, 90vw); text-align: center; }
  h1 { font-size: 20px; margin: 0; }
  .tenue { color: var(--tenue); }
  progress { width: 100%; accent-color: var(--acento); }
</style>
