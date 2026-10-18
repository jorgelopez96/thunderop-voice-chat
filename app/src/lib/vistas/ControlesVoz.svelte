<script lang="ts">
  import { voz, alternarMute, alternarSupresion, salirVoz, transmitir, dejarDeTransmitir } from '../voz.svelte';
  import { CALIDADES, leerPrefs, type Calidad } from '../prefs';
  import AjustesVoz from './AjustesVoz.svelte';

  let { alSalir }: { alSalir?: () => void } = $props();
  let ajustes = $state(false);
  let d = $state<HTMLDialogElement>();
  let calidad = $state<Calidad>('1080p60');
  const abrir = () => { calidad = leerPrefs().calidad; d?.showModal(); };
  const empezar = () => { d?.close(); transmitir(calidad); };
  const nombre = (c: Calidad) => `${CALIDADES[c].alto}p · ${CALIDADES[c].fps} fps`;
</script>

<div class="controles">
  <strong>🔊 {voz.salaNombre}</strong>
  <div class="fila">
    <button onclick={alternarMute} disabled={voz.sinPermiso}>{voz.muteado ? 'Activar micrófono' : 'Silenciarme'}</button>
    <button aria-pressed={voz.supresion} class:activo={voz.supresion} onclick={alternarSupresion}>Supresión de ruido</button>
  </div>
  {#if voz.sinPermiso}<p class="nota">El dueño te silenció.</p>{/if}
  {#if voz.transmitiendo}<button class="peligro" onclick={dejarDeTransmitir}>Dejar de transmitir</button>
  {:else}<button onclick={abrir} disabled={voz.conectando}>Transmitir</button>{/if}
  <div class="fila">
    <button class="plano" onclick={() => (ajustes = true)}>Ajustes</button>
    <button class="peligro" onclick={() => { salirVoz(); alSalir?.(); }}>Desconectar</button>
  </div>
  {#if ajustes}<AjustesVoz cerrar={() => (ajustes = false)} />{/if}
</div>

<dialog bind:this={d}>
  <h3>Transmitir pantalla</h3>
  <label>Calidad
    <select bind:value={calidad}>{#each Object.keys(CALIDADES) as c (c)}<option value={c}>{nombre(c as Calidad)}</option>{/each}</select>
  </label>
  <div class="fila" style="justify-content:flex-end">
    <button class="plano" onclick={() => d?.close()}>Cancelar</button>
    <button class="primario" onclick={empezar}>Empezar</button>
  </div>
</dialog>

<style>
  dialog { flex-direction: column; gap: 12px; min-width: 300px; }
  dialog[open] { display: flex; }
  select { font: inherit; color: var(--texto); background: var(--hondo); border: 0; border-radius: var(--radio); padding: 8px 10px; }
  .controles { margin-top: auto; background: var(--hondo); border-radius: var(--radio); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .controles strong { color: var(--ok); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fila { flex-wrap: wrap; }
  button.activo { background: var(--acento); }
  .nota { font-size: 13px; color: var(--tenue); }
</style>
