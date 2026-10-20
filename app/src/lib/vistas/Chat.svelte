<script lang="ts">
  import { tick } from 'svelte';
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { validarAdjunto, duracionVideo } from '../adjuntos';
  import { abrirChat, enviar, borrar } from '../chat.svelte';
  import { sesion, mensajeError } from '../sesion.svelte';

  let { room, soyDueno }: { room: RecordModel; soyDueno: boolean } = $props();
  // svelte-ignore state_referenced_locally
  const chat = abrirChat(room.id); // se recrea por sala (#key en Grupo)
  $effect(() => chat.cerrar);

  let texto = $state('');
  let archivo = $state<File | null>(null);
  let error = $state('');
  let enviando = $state(false);
  let lista: HTMLElement | undefined = $state();
  let ultimoId = '';

  // Baja al final cuando llega un mensaje nuevo (no al cargar anteriores).
  $effect(() => {
    const id = chat.mensajes.at(-1)?.id ?? '';
    if (id !== ultimoId) { ultimoId = id; tick().then(() => lista && (lista.scrollTop = lista.scrollHeight)); }
  });

  const autor = (m: RecordModel) => m.expand?.author as RecordModel | undefined;
  const hora = (m: RecordModel) => new Date(m.created.replace(' ', 'T')).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const esVideo = (m: RecordModel) => /\.(mp4|webm)$/i.test(m.file);

  // Vista previa del adjunto antes de mandarlo.
  const previa = $derived(archivo ? URL.createObjectURL(archivo) : '');
  $effect(() => { const u = previa; return () => { if (u) URL.revokeObjectURL(u); }; });

  async function elegir(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    await adjuntar(f);
  }
  function pegar(e: ClipboardEvent) {
    const f = e.clipboardData?.files[0];
    if (!f) return; // texto: pega normal
    e.preventDefault();
    adjuntar(f);
  }
  async function adjuntar(f: File | undefined) {
    error = ''; archivo = null;
    if (!f) return;
    let dur: number | undefined;
    if (f.type.startsWith('video/')) { try { dur = await duracionVideo(f); } catch { dur = undefined; } }
    const v = validarAdjunto(f, dur);
    if (v.ok) archivo = f; else error = v.motivo;
  }
  async function enviarMensaje() {
    const t = texto.trim();
    if ((!t && !archivo) || enviando) return;
    enviando = true; error = '';
    try { await enviar(room.id, t, archivo ?? undefined); texto = ''; archivo = null; }
    catch (e) { error = mensajeError(e); }
    finally { enviando = false; }
  }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
  }
  async function quitar(m: RecordModel) {
    try { await borrar(m.id); } catch (e) { error = mensajeError(e); }
  }
  function alScroll() { if (lista && lista.scrollTop === 0 && chat.hayMas) chat.cargarMas(); }
</script>

<section class="chat" aria-label="Chat {room.name}">
  <h2 class="titulo"># {room.name}</h2>
  <div class="lista" bind:this={lista} onscroll={alScroll} data-testid="mensajes">
    {#if chat.hayMas}<button class="plano" onclick={() => chat.cargarMas()}>Cargar anteriores</button>{/if}
    {#if chat.error}<p role="alert">{chat.error}</p>{/if}
    {#each chat.mensajes as m (m.id)}
      {@const a = autor(m)}
      <article class="msg" data-testid="mensaje">
        {#if a?.avatar}<img class="avatar" src={pb.files.getURL(a, a.avatar, { thumb: '64x64' })} alt="" />
        {:else}<span class="avatar" style="background:{a?.color || ''}"></span>{/if}
        <div class="cuerpo">
          <header>
            <strong style="color:{a?.color || 'var(--tenue)'}">{a ? a.name : 'Ex miembro'}</strong>
            <small>{hora(m)}</small>
            {#if m.author === sesion.usuario?.id || soyDueno}<button class="plano borrar" onclick={() => quitar(m)}>Borrar</button>{/if}
          </header>
          {#if m.text}<p class="texto">{m.text}</p>{/if}
          {#if m.file}
            {@const url = pb.files.getURL(m, m.file)}
            {#if esVideo(m)}<video class="adjunto" controls src={url}><track kind="captions" /></video>
            {:else}<button class="plano ver" title="Ver en grande" onclick={(e) => e.currentTarget.querySelector('img')?.requestFullscreen().catch(() => {})}><img class="adjunto" src={url} alt="Imagen adjunta" /></button>{/if}
          {/if}
        </div>
      </article>
    {/each}
  </div>
  {#if error}<p role="alert" class="pie">{error}</p>{/if}
  {#if archivo}<div class="pie adjuntado">
    {#if archivo.type.startsWith('video/')}<video class="miniatura" src={previa} muted></video>
    {:else}<img class="miniatura" src={previa} alt="Vista previa del adjunto" />{/if}
    <small>{archivo.name}</small> <button class="plano" onclick={() => (archivo = null)}>Quitar</button>
  </div>{/if}
  <div class="composer">
    <label class="clip" title="Adjuntar imagen o video">📎 <input type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm" onchange={elegir} data-testid="adjuntar" /></label>
    <textarea bind:value={texto} onkeydown={tecla} onpaste={pegar} maxlength="2000" rows="1" placeholder="Escribí un mensaje (Enter envía, Shift+Enter nueva línea)"></textarea>
    <button class="primario" onclick={enviarMensaje} disabled={enviando}>Enviar</button>
  </div>
</section>

<style>
  .chat { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .titulo { font-size: 15px; padding: 12px 16px; border-bottom: 1px solid var(--hover); }
  .lista { flex: 1; overflow-y: auto; padding: 8px 0; }
  .msg { display: flex; gap: 12px; padding: 4px 16px; }
  .msg:hover { background: var(--panel); }
  .cuerpo { min-width: 0; flex: 1; }
  header { display: flex; align-items: baseline; gap: 8px; }
  .borrar { opacity: 0; margin-left: auto; font-size: 12px; }
  .msg:hover .borrar, .borrar:focus-visible { opacity: 1; }
  .texto { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
  .adjunto { display: block; max-width: min(400px, 100%); max-height: 300px; border-radius: var(--radio); margin-top: 4px; }
  .pie { margin: 0 16px; }
  .adjuntado { display: flex; align-items: center; gap: 8px; }
  .miniatura { width: 64px; height: 64px; object-fit: cover; border-radius: var(--radio); }
  .ver { padding: 0; display: block; cursor: zoom-in; }
  .adjunto:fullscreen { max-width: none; max-height: none; object-fit: contain; background: #000; }
  .composer { display: flex; align-items: center; gap: 8px; margin: 8px 16px 16px; background: var(--panel); border: 1px solid var(--borde); border-radius: 8px; padding: 6px 8px; }
  .composer textarea { flex: 1; resize: none; background: none; border: 0; padding: 6px 4px; }
  .clip { cursor: pointer; font-size: 18px; flex-direction: row; }
</style>
