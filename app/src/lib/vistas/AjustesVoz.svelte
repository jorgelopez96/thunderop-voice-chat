<script lang="ts">
  import { dispositivos, elegirEntrada, elegirSalida } from '../voz.svelte';
  import { leerPrefs } from '../prefs';

  let { cerrar }: { cerrar: () => void } = $props();
  let d: HTMLDialogElement;
  let lista = $state<Awaited<ReturnType<typeof dispositivos>>>({ entradas: [], salidas: [] });
  const prefs = leerPrefs();
  $effect(() => { if (!d.open) d.showModal(); dispositivos().then((x) => (lista = x)); });
</script>

<dialog bind:this={d} oncancel={cerrar} onclose={cerrar}>
  <h3>Ajustes de voz</h3>
  <label>Entrada
    <select value={prefs.entrada ?? 'default'} onchange={(e) => elegirEntrada(e.currentTarget.value)}>
      <option value="default">Predeterminado</option>
      {#each lista.entradas.filter((x) => x.deviceId !== 'default') as x (x.deviceId)}<option value={x.deviceId}>{x.label || 'Micrófono'}</option>{/each}
    </select>
  </label>
  <label>Salida
    <select value={prefs.salida ?? 'default'} onchange={(e) => elegirSalida(e.currentTarget.value)}>
      <option value="default">Predeterminado</option>
      {#each lista.salidas.filter((x) => x.deviceId !== 'default') as x (x.deviceId)}<option value={x.deviceId}>{x.label || 'Altavoz'}</option>{/each}
    </select>
  </label>
  <div class="fila" style="justify-content:flex-end"><button onclick={cerrar}>Cerrar</button></div>
</dialog>

<style>
  dialog { display: flex; flex-direction: column; gap: 12px; min-width: 300px; }
  dialog:not([open]) { display: none; }
  select { font: inherit; color: var(--texto); background: var(--hondo); border: 0; border-radius: var(--radio); padding: 8px 10px; }
</style>
