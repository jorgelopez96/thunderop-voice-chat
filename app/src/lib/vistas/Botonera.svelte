<script lang="ts">
  import { Search, Volume2, Plus, X } from '@lucide/svelte';
  import { sonidos, subir, borrar, tocar } from '../botonera.svelte';
  import { mensajeError } from '../sesion.svelte';
  import { voz } from '../voz.svelte';
  import { leerPrefs, guardarPrefs } from '../prefs';

  // Contenido del panelcito de Sonidos del dock. Quien lo usa lo recrea por grupo ({#key}).
  let { grupoId, userId, soyDueno }: { grupoId: string; userId: string | undefined; soyDueno: boolean } = $props();
  // svelte-ignore state_referenced_locally
  const s = sonidos(grupoId);
  $effect(() => s.parar);
  let dlg = $state<HTMLDialogElement>();
  let nombre = $state('');
  let archivo = $state<File>();
  let error = $state('');
  let subiendo = $state(false);
  let modal = $state(false); // `dlg.open` no es reactivo
  let vol = $state(Math.round(leerPrefs().volBotonera * 100));
  let busqueda = $state('');
  const visibles = $derived(s.estado.lista.filter((x) => x.name.toLowerCase().includes(busqueda.trim().toLowerCase())));

  async function enviar(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    if (!archivo) return (error = 'Elegí un archivo de audio.');
    error = ''; subiendo = true;
    try { await subir(grupoId, nombre, archivo); form.reset(); nombre = ''; archivo = undefined; dlg?.close(); }
    catch (e) { error = e instanceof Error ? e.message : mensajeError(e); }
    finally { subiendo = false; }
  }
  async function quitar(id: string) {
    error = '';
    try { await borrar(id); } catch (e) { error = mensajeError(e); }
  }
</script>

<div class="botonera">
  <div class="arriba">
    <label class="buscar"><Search size={16} strokeWidth={1.75} /><input bind:value={busqueda} placeholder="Buscá un sonido" aria-label="Buscar sonido" /></label>
    <span class="vol" title="Volumen de la botonera"><Volume2 size={16} strokeWidth={1.75} />
      <input type="range" min="0" max="100" step="5" bind:value={vol} aria-label="Volumen de la botonera" oninput={() => guardarPrefs({ volBotonera: vol / 100 })} /></span>
  </div>
  {#if error && !modal}<p role="alert">{error}</p>{/if}
  <ul class="grilla">
    {#each visibles as x (x.id)}
      <li>
        <button class="sonido" disabled={!voz.salaId} onclick={() => tocar(x.id)}>{x.name}</button>
        {#if soyDueno || x.owner === userId}<button class="icono borrar" aria-label={`Borrar ${x.name}`} title="Borrar" onclick={() => quitar(x.id)}><X size={12} strokeWidth={1.75} /></button>{/if}
      </li>
    {/each}
  </ul>
  {#if !s.estado.lista.length}<p class="tenue">Todavía no hay sonidos en este grupo.</p>
  {:else if !visibles.length}<p class="tenue">Ningún sonido se llama así.</p>{/if}
  <button class="agregar" aria-label="Agregar sonido" onclick={() => { error = ''; modal = true; dlg?.showModal(); }}><Plus size={16} strokeWidth={1.75} /> Sonido</button>
</div>

<dialog bind:this={dlg} onclose={() => { modal = false; error = ''; }}>
  <form onsubmit={enviar}>
    <h3>Subir un sonido</h3>
    <input bind:value={nombre} required maxlength="30" placeholder="Nombre del sonido" aria-label="Nombre del sonido" />
    <input type="file" accept="audio/*" required aria-label="Archivo de audio" onchange={(e) => (archivo = e.currentTarget.files?.[0])} />
    {#if error}<p role="alert">{error}</p>{/if}
    <div class="fila">
      <button type="submit" class="primario" disabled={subiendo}>Subir</button>
      <button type="button" onclick={() => dlg?.close()}>Cancelar</button>
    </div>
  </form>
</dialog>

<style>
  .botonera { display: flex; flex-direction: column; gap: 12px; }
  .arriba { display: flex; align-items: center; gap: 12px; }
  .buscar { flex: 1; flex-direction: row; align-items: center; gap: 8px; padding: 0 12px; background: var(--hondo); border: 1px solid var(--borde); border-radius: var(--radio); color: var(--tenue); }
  .buscar input { flex: 1; border: 0; background: none; padding: 8px 0; }
  .vol { display: flex; align-items: center; gap: 4px; color: var(--icono); }
  .vol input { width: 72px; padding: 0; border: 0; background: none; }
  .grilla { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 50vh; overflow-y: auto; }
  .grilla li { position: relative; }
  .sonido { width: 100%; height: 48px; padding: 4px 8px; background: var(--panel); border-color: transparent; font-size: 13px; line-height: 1.2; text-align: center; overflow: hidden; }
  .sonido:hover:not(:disabled) { background: var(--hover); }
  .borrar { position: absolute; top: 2px; right: 2px; padding: 2px; opacity: 0; }
  li:hover .borrar, .borrar:focus-visible { opacity: 1; }
  .agregar { align-self: flex-start; }
  .tenue { margin: 0; color: var(--tenue); font-size: 13px; }
  form { display: flex; flex-direction: column; gap: 8px; }
  form h3 { margin: 0 0 4px; }
  .fila { display: flex; gap: 8px; align-items: center; }
</style>
