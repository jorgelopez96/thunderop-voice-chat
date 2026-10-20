<script lang="ts">
  import { voz, vistaPrevia, dispositivos, elegirEntrada, elegirSalida, cambiarSupresion, cambiarGanancia } from '../voz.svelte';
  import { leerPrefs, guardarPrefs } from '../prefs';

  let { cerrar }: { cerrar: () => void } = $props();
  let d: HTMLDialogElement;
  let error = $state('');
  let lista = $state<Awaited<ReturnType<typeof dispositivos>>>({ entradas: [], salidas: [] });
  const prefs = leerPrefs();
  let ganancia = $state(prefs.gananciaDb);
  $effect(() => { if (!d.open) d.showModal(); dispositivos().then((x) => (lista = x)).catch(() => (error = 'No se pudieron listar los dispositivos de audio.')); });
</script>

<dialog bind:this={d} oncancel={cerrar} onclose={cerrar}>
  <h3>Configuración</h3>
  {#if error}<p role="alert">{error}</p>{/if}
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
  <label class="casilla"><input type="checkbox" checked={voz.supresion} onchange={(e) => cambiarSupresion(e.currentTarget.checked)} /> Supresión de ruido</label>
  <label>Ganancia del micrófono: {ganancia > 0 ? '+' : ''}{ganancia} dB
    <input type="range" min="-20" max="20" step="1" bind:value={ganancia} oninput={() => cambiarGanancia(ganancia)} />
  </label>
  <small>Sube o baja cómo te escuchan los demás.</small>
  <label class="casilla"><input type="checkbox" checked={prefs.gpu} onchange={(e) => guardarPrefs({ gpu: e.currentTarget.checked })} /> Codificar con la GPU</label>
  <small>Desactivala solo si alguien no puede ver tu transmisión. Aplica en la próxima transmisión.</small>
  <label class="casilla"><input type="checkbox" checked={voz.vistaPrevia} onchange={(e) => vistaPrevia(e.currentTarget.checked)} /> Mostrar vista previa de mi transmisión</label>
  <small>Desactivala para ahorrar recursos.</small>
  <div class="fila" style="justify-content:flex-end"><button onclick={cerrar}>Cerrar</button></div>
</dialog>

<style>
  dialog { display: flex; flex-direction: column; gap: 12px; min-width: 300px; }
  dialog:not([open]) { display: none; }
  .casilla { flex-direction: row; align-items: center; gap: 8px; }
  small { color: var(--tenue); font-size: 12px; }
  input[type='range'] { padding: 0; background: none; }
  select { font: inherit; color: var(--texto); background: var(--hondo); border: 0; border-radius: var(--radio); padding: 8px 10px; }
</style>
