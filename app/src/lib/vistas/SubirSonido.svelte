<script lang="ts">
  import { lleno } from '../rango';
  import type { RecordModel } from 'pocketbase';
  import { Upload, X } from '@lucide/svelte';
  import { subir, editar, decodificar, recorteWav } from '../botonera.svelte';
  import { mensajeError } from '../sesion.svelte';
  import BotonEmoji from './BotonEmoji.svelte';
  import RecorteSonido from './RecorteSonido.svelte';
  import { separarEmoji, unirEmoji, seleccionInicial } from '../botoneraLogica';

  // Modal para subir un sonido al grupo, o para editar `sonido` (emoji, nombre y volumen).
  // El emoji va al principio del nombre ("🔥 Bruh"): no hay campo aparte en el servidor. Quien lo usa lo monta con {#if} y lo desmonta en `cerrar`.
  let { grupoId, cerrar, sonido }: { grupoId: string; cerrar: () => void; sonido?: RecordModel } = $props();
  let dlg = $state<HTMLDialogElement>();
  $effect(() => { dlg?.showModal(); });
  // svelte-ignore state_referenced_locally
  const { emoji: e0, texto: t0 } = separarEmoji(sonido?.name ?? '');
  let emoji = $state(e0);
  let nombre = $state(t0);
  let archivo = $state<File>();
  let audio = $state<AudioBuffer>();
  let sel = $state({ inicio: 0, fin: 0 });
  // svelte-ignore state_referenced_locally
  let volumen = $state(sonido?.volumen || 100);
  let error = $state('');
  let subiendo = $state(false);

  async function enviar(e: SubmitEvent) {
    e.preventDefault();
    if (sonido) return guardar(() => editar(sonido.id, { name: unirEmoji(emoji, nombre), volumen }));
    if (!archivo || !audio) return (error = 'Elegí un archivo de audio.');
    const f = recorteWav(audio, sel, archivo.name);
    await guardar(() => subir(grupoId, unirEmoji(emoji, nombre), f, volumen));
  }
  // Se sube solo el pedazo elegido en el editor, recodificado a WAV: así entra cualquier duración y casi cualquier formato.
  async function elegir(f: File | undefined) {
    archivo = f; audio = undefined; error = '';
    if (!f) return;
    try {
      const a = await decodificar(f);
      if (archivo !== f) return; // eligió otro mientras se leía
      sel = seleccionInicial(a.duration); audio = a;
    } catch (e) { if (archivo === f) error = e instanceof Error ? e.message : 'No se pudo leer el audio.'; }
  }
  async function guardar(f: () => Promise<unknown>) {
    error = ''; subiendo = true;
    try { await f(); dlg?.close(); }
    catch (e) { error = e instanceof Error ? e.message : mensajeError(e); }
    finally { subiendo = false; }
  }
</script>

<dialog bind:this={dlg} onclose={cerrar}>
  <form onsubmit={enviar}>
    <header>
      <h3>{sonido ? 'Editar sonido' : 'Subí un sonido'}</h3>
      <button type="button" class="plano icono" aria-label="Cerrar" onclick={() => dlg?.close()}><X size={20} strokeWidth={1.75} /></button>
    </header>
    {#if !sonido}
      <div class="campo">
        <span class="etiqueta">Archivo <b>*</b></span>
        <label class="archivo">
          <Upload size={18} strokeWidth={1.75} />
          <span class="nombre-archivo" class:tenue={!archivo}>{archivo?.name ?? 'Elegí un archivo'}</span>
          <span class="explorar">Explorar</span>
          <input type="file" accept="audio/*" hidden aria-label="Archivo de audio" onchange={(e) => elegir(e.currentTarget.files?.[0])} />
        </label>
        {#if audio}<RecorteSonido {audio} bind:sel />{/if}
      </div>
    {/if}
    <div class="dos">
      <label class="campo"><span class="etiqueta">Nombre del sonido <b>*</b></span>
        <input bind:value={nombre} required maxlength="24" placeholder="Nombre del sonido" /></label>
      <div class="campo"><span class="etiqueta">Emoji</span>
        <BotonEmoji actual={emoji} texto={emoji ? 'Tocá para cambiarlo' : 'Tocá para elegir'} elegir={(e) => (emoji = e)} /></div>
    </div>
    <label class="campo"><span class="etiqueta">Volumen del sonido <small>{volumen}%</small></span>
      <input type="range" min="5" max="200" step="5" bind:value={volumen} style={lleno(volumen, 5, 200)} /></label>
    {#if error}<p role="alert">{error}</p>{/if}
    <div class="botones">
      <button type="button" onclick={() => dlg?.close()}>Cancelar</button>
      <button type="submit" class="primario" disabled={subiendo || !nombre.trim() || (!sonido && !audio)}>{sonido ? 'Guardar' : 'Subir'}</button>
    </div>
  </form>
</dialog>

<style>
  dialog { width: min(520px, 92vw); max-width: none; padding: 24px; }
  form { display: flex; flex-direction: column; gap: 18px; }
  header { display: flex; align-items: center; justify-content: space-between; }
  h3 { margin: 0; font-size: 20px; }
  .campo { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .etiqueta { display: flex; font-weight: 600; color: var(--texto); }
  .etiqueta b { color: var(--peligro); font-weight: 600; margin-left: 4px; }
  .etiqueta small { margin-left: auto; color: var(--tenue); font-weight: 400; }
  .archivo { display: flex; flex-direction: row; align-items: center; gap: 10px; padding: 5px 5px 5px 12px; border: 1px solid var(--borde);
    border-radius: var(--radio); background: var(--hondo); cursor: pointer; color: var(--icono); }
  .nombre-archivo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--texto); }
  .nombre-archivo.tenue { color: var(--apagado); }
  .explorar { padding: 6px 12px; border-radius: var(--radio); background: var(--panel); border: 1px solid var(--borde); color: var(--texto); font-weight: 600; font-size: 14px; }
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  input[type='range'] { padding: 0; border: 0; background: none; accent-color: var(--acento); }
  .botones { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .botones button { height: 42px; justify-content: center; }
</style>
