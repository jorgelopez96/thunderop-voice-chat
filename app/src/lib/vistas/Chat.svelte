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

  async function elegir(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
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
  <h3># {room.name}</h3>
  <div class="lista" bind:this={lista} onscroll={alScroll} data-testid="mensajes">
    {#if chat.hayMas}<button onclick={() => chat.cargarMas()}>Cargar anteriores</button>{/if}
    {#if chat.error}<p role="alert">{chat.error}</p>{/if}
    {#each chat.mensajes as m (m.id)}
      {@const a = autor(m)}
      <article class="msg" data-testid="mensaje">
        <header>
          {#if a?.avatar}<img class="avatar" src={pb.files.getURL(a, a.avatar, { thumb: '64x64' })} alt="" />
          {:else}<span class="avatar"></span>{/if}
          <strong style="color:{a?.color || '#888'}">{a ? a.name : 'Ex miembro'}</strong>
          <small>{hora(m)}</small>
          {#if m.author === sesion.usuario?.id || soyDueno}<button onclick={() => quitar(m)}>Borrar</button>{/if}
        </header>
        {#if m.text}<p class="texto">{m.text}</p>{/if}
        {#if m.file}
          {@const url = pb.files.getURL(m, m.file)}
          {#if esVideo(m)}<video controls src={url} style="max-width:320px"><track kind="captions" /></video>
          {:else}<img src={url} alt="Imagen adjunta" style="max-width:320px" />{/if}
        {/if}
      </article>
    {/each}
  </div>
  {#if error}<p role="alert" style="color:#c00">{error}</p>{/if}
  <div class="composer">
    <textarea bind:value={texto} onkeydown={tecla} maxlength="2000" rows="2" placeholder="Escribí un mensaje (Enter envía, Shift+Enter nueva línea)"></textarea>
    <label>📎 <input type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm" onchange={elegir} data-testid="adjuntar" /></label>
    {#if archivo}<small>{archivo.name} <button onclick={() => (archivo = null)}>Quitar</button></small>{/if}
    <button onclick={enviarMensaje} disabled={enviando}>Enviar</button>
  </div>
</section>

<style>
  .lista { max-height: 50vh; overflow-y: auto; }
  .texto { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
  .avatar { width: 24px; height: 24px; border-radius: 50%; background: #888; display: inline-block; vertical-align: middle; }
</style>
