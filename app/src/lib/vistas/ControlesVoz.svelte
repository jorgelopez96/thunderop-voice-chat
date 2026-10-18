<script lang="ts">
  import { voz, alternarMute, alternarSupresion, salirVoz } from '../voz.svelte';
  import AjustesVoz from './AjustesVoz.svelte';

  let { sala, alSalir }: { sala: string; alSalir: () => void } = $props();
  let ajustes = $state(false);
</script>

<div class="controles">
  <strong>🔊 {sala}</strong>
  <div class="fila">
    <button onclick={alternarMute}>{voz.muteado ? 'Activar micrófono' : 'Silenciarme'}</button>
    <button aria-pressed={voz.supresion} class:activo={voz.supresion} onclick={alternarSupresion}>Supresión de ruido</button>
  </div>
  <div class="fila">
    <button class="plano" onclick={() => (ajustes = true)}>Ajustes</button>
    <button class="peligro" onclick={() => { salirVoz(); alSalir(); }}>Desconectar</button>
  </div>
  {#if ajustes}<AjustesVoz cerrar={() => (ajustes = false)} />{/if}
</div>

<style>
  .controles { margin-top: auto; background: var(--hondo); border-radius: var(--radio); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .controles strong { color: var(--ok); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fila { flex-wrap: wrap; }
  button.activo { background: var(--acento); }
</style>
