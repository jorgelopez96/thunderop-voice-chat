<script lang="ts">
  import { voz, vistaPrevia, dispositivos, elegirEntrada, elegirSalida, cambiarSupresion, cambiarGanancia } from '../voz.svelte';
  import { leerPrefs, guardarPrefs } from '../prefs';
  import { dbDePorcentaje, porcentajeDeDb } from '../ganancia';
  import MedidorMic from './MedidorMic.svelte';
  import { TEMAS, aplicarTema, temaGuardado } from '../tema';

  // Configuraciones generales, por solapas como las del grupo.
  let { cerrar }: { cerrar: () => void } = $props();
  let d: HTMLDialogElement;
  let error = $state('');
  let solapa = $state<'audio' | 'transmision' | 'notificaciones' | 'apariencia'>('audio');
  let tema = $state(temaGuardado());
  let lista = $state<Awaited<ReturnType<typeof dispositivos>>>({ entradas: [], salidas: [] });
  const prefs = leerPrefs();
  let pctMic = $state(porcentajeDeDb(prefs.gananciaDb));
  let entrada = $state(prefs.entrada);
  $effect(() => { if (!d.open) d.showModal(); dispositivos().then((x) => (lista = x)).catch(() => (error = 'No se pudieron listar los dispositivos de audio.')); });
  const SOLAPAS = [['audio', 'Audio'], ['transmision', 'Transmisión'], ['notificaciones', 'Notificaciones'], ['apariencia', 'Apariencia']] as const;
</script>

<dialog class="config" bind:this={d} oncancel={cerrar} onclose={cerrar} onclick={(e) => e.target === d && d.close()}>
  <h2>Configuración</h2>
  <div class="solapas" role="tablist">
    {#each SOLAPAS as [id, texto] (id)}<button role="tab" class="plano" aria-selected={solapa === id} onclick={() => (solapa = id)}>{texto}</button>{/each}
  </div>
  {#if error}<p role="alert">{error}</p>{/if}

  {#if solapa === 'audio'}
    <section>
      <label>Entrada
        <select value={prefs.entrada ?? 'default'} onchange={(e) => { entrada = e.currentTarget.value; elegirEntrada(entrada); }}>
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
      <label>Volumen del micrófono: {pctMic}%
        <input type="range" min="0" max="100" step="1" bind:value={pctMic} oninput={() => cambiarGanancia(dbDePorcentaje(pctMic))} />
      </label>
      <small>Sube o baja cómo te escuchan los demás (50% = sin cambios). Hablá y mirá las barritas: las rojas son que satura.</small>
      <MedidorMic {entrada} gananciaDb={dbDePorcentaje(pctMic)} />
    </section>
  {:else if solapa === 'apariencia'}
    <section>
      <span>Color de la app</span>
      <div class="temas" role="radiogroup" aria-label="Color de la app">
        {#each TEMAS as t (t.id)}
          <button class="plano tema" role="radio" aria-checked={tema === t.id} onclick={() => { tema = t.id; aplicarTema(t.id); }}>
            <span class="muestra" style="background:{t.color}"></span>{t.nombre}</button>
        {/each}
      </div>
      <small>Solo cambia cómo la ves vos, en esta PC.</small>
    </section>
  {:else if solapa === 'notificaciones'}
    <section>
      <label class="casilla"><input type="checkbox" checked={prefs.sonidoMensajes} onchange={(e) => guardarPrefs({ sonidoMensajes: e.currentTarget.checked })} /> Sonido al llegar un mensaje</label>
      <label class="casilla"><input type="checkbox" checked={prefs.notificaciones} onchange={(e) => guardarPrefs({ notificaciones: e.currentTarget.checked })} /> Notificación de Windows si la app no está a la vista</label>
      <small>Para silenciar un chat en particular, usá la campanita de arriba del chat.</small>
    </section>
  {:else}
    <section>
      <label class="casilla"><input type="checkbox" checked={prefs.gpu} onchange={(e) => guardarPrefs({ gpu: e.currentTarget.checked })} /> Codificar con la GPU</label>
      <small>Desactivala solo si alguien no puede ver tu transmisión. Aplica en la próxima transmisión.</small>
      <label class="casilla"><input type="checkbox" checked={voz.vistaPrevia} onchange={(e) => vistaPrevia(e.currentTarget.checked)} /> Mostrar vista previa de mi transmisión</label>
      <small>Desactivala para ahorrar recursos.</small>
    </section>
  {/if}
  <div class="fila fin"><button onclick={() => d.close()}>Cerrar</button></div>
</dialog>

<style>
  h2 { font-size: 18px; font-weight: 600; }
  section { display: flex; flex-direction: column; gap: 12px; }
  .casilla { flex-direction: row; align-items: center; gap: 8px; }
  small { color: var(--tenue); font-size: 12px; }
  input[type='range'] { padding: 0; background: none; }
  select { font: inherit; color: var(--texto); background: var(--hondo); border: 0; border-radius: var(--radio); padding: 8px 10px; }
  .fin { justify-content: flex-end; margin-top: auto; }
  .temas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .tema { justify-content: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid var(--borde); color: var(--texto); }
  .tema[aria-checked='true'] { border-color: var(--acento); background: var(--acento-suave); }
  .muestra { width: 20px; height: 20px; border-radius: 999px; flex: none; }
</style>
