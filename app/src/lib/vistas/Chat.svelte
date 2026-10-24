<script lang="ts">
  import { alTocar, estabaAbierto } from '../menu';
  import { horaDe } from '../hora.svelte';
  import Insignia from './Insignia.svelte';
  import { Paperclip, Smile, SmilePlus, Reply, Trash2, X, Pencil, Download } from '@lucide/svelte';
  import { EMOJIS } from '../emojis';
  import { tick } from 'svelte';
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { foto } from '../foto';
  import { validarAdjunto, duracionVideo } from '../adjuntos';
  import type { ChatAbierto } from '../chat.svelte';
  import { mensajeError, sesion } from '../sesion.svelte';
  import Confirmar from './Confirmar.svelte';
  import MenuChat from './MenuChat.svelte';
  import VistaPrevia from './VistaPrevia.svelte';
  import Gifs from './Gifs.svelte';
  import { partirEnLinks, primerLink, abrirLink, esGif } from '../links';
  import { extraerCodigo } from '../invitacion';
  import { unirse } from '../grupos.svelte';
  import { mencionEnCurso, sugerencias, completar, partirMenciones, menciona } from '../menciones';
  import type { Snippet } from 'svelte';

  // Sirve para salas de grupo y privados: quien lo usa dice qué lista abrir y cómo enviar y borrar.
  // `soloLectura`: oculta el compositor y muestra ese texto (privado con alguien que ya no es amigo).
  // `silencio`: id del chat para el menú de tres puntitos (silenciar avisos); `acciones`: más opciones en ese menú.
  // `miembros`: quiénes pueden estar en el chat, para los nombres de las reacciones y las menciones con @.
  let { titulo, abrir, enviar, borrar, puedeBorrar, soloLectura = '', alVer, silencio, acciones, miembros = [] }: {
    titulo: string; abrir: () => ChatAbierto; enviar: (texto: string, archivo?: File, respondeA?: string) => Promise<unknown>;
    borrar: (id: string) => Promise<unknown>; puedeBorrar: (m: RecordModel) => boolean; soloLectura?: string;
    alVer?: (ultimo: RecordModel) => void; // se llama con el último mensaje visible (privados: marcar leído)
    silencio?: string; acciones?: Snippet<[() => void]>; miembros?: { id: string; name: string }[];
  } = $props();
  const nombres = $derived(miembros.map((m) => m.name).filter(Boolean));
  const nombreDe = (id: string) => miembros.find((m) => m.id === id)?.name ?? 'Ex miembro';

  // @ en el compositor: lista de gente del grupo que coincide con lo escrito; flechas eligen, Enter o Tab completan.
  let mencion = $state<{ inicio: number; consulta: string } | null>(null);
  let elegida = $state(0);
  const opciones = $derived(mencion ? sugerencias(nombres.filter((n) => n !== sesion.usuario?.name), mencion.consulta) : []);
  function revisarMencion() {
    mencion = caja ? mencionEnCurso(texto, caja.selectionStart) : null;
    elegida = 0;
  }
  function elegirMencion(nombre: string) {
    if (!mencion || !caja) return;
    const r = completar(texto, mencion.inicio, caja.selectionStart, nombre);
    texto = r.texto;
    mencion = null;
    tick().then(() => { caja?.focus(); caja?.setSelectionRange(r.cursor, r.cursor); });
  }
  // svelte-ignore state_referenced_locally
  const chat = abrir(); // se recrea con #key en quien lo usa
  $effect(() => chat.cerrar);
  $effect(() => { const m = chat.mensajes.at(-1); if (m) alVer?.(m); });

  let texto = $state('');
  let archivo = $state<File | null>(null);
  let error = $state('');
  let enviando = $state(false);
  let lista: HTMLElement | undefined = $state();
  let caja: HTMLTextAreaElement | undefined = $state();
  let ultimoId = '';

  // Baja al final cuando llega un mensaje nuevo (no al cargar anteriores).
  $effect(() => {
    const id = chat.mensajes.at(-1)?.id ?? '';
    if (id !== ultimoId) { ultimoId = id; tick().then(() => lista && (lista.scrollTop = lista.scrollHeight)); }
  });

  const autor = (m: RecordModel) => m.expand?.author as RecordModel | undefined;
  const hora = (m: RecordModel) => horaDe(m.created);
  const esVideo = (m: RecordModel) => /\.(mp4|webm)$/i.test(m.file);
  const fecha = (m: RecordModel) => new Date(m.created.replace(' ', 'T')).getTime();
  /** Seguido: mismo autor que el anterior y menos de 5 min después (sin repetir nombre y foto). Una respuesta siempre muestra el nombre. */
  const seguido = (i: number) => {
    const m = chat.mensajes[i], p = chat.mensajes[i - 1];
    return !!p && !m.respondeA && p.author === m.author && fecha(m) - fecha(p) < 5 * 60_000;
  };

  // Responder: el mensaje elegido queda marcado y el compositor muestra a quién le contestás.
  let respondiendo = $state<RecordModel | null>(null);
  function responder(m: RecordModel) { respondiendo = m; caja?.focus(); }
  const resumen = (m: RecordModel) => m.text ? m.text.slice(0, 80) : m.file ? (esVideo(m) ? 'Video' : 'Imagen') : '';
  let resaltado = $state('');
  function irA(id: string) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    resaltado = id;
    setTimeout(() => { if (resaltado === id) resaltado = ''; }, 1500);
  }

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
    try { await enviar(t, archivo ?? undefined, respondiendo?.id); texto = ''; archivo = null; respondiendo = null; }
    catch (e) { error = mensajeError(e); }
    finally { enviando = false; }
  }
  function tecla(e: KeyboardEvent) {
    if (mencion && opciones.length) {
      const n = opciones.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); elegida = (elegida + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegirMencion(opciones[elegida]); return; }
      if (e.key === 'Escape') { e.preventDefault(); mencion = null; return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
    if (e.key === 'Escape' && respondiendo) { e.preventDefault(); respondiendo = null; }
  }
  let aBorrar = $state<RecordModel | null>(null);
  // Edición en el lugar: Enter guarda, Esc cancela. Sin cambios no se manda nada.
  let editando = $state<{ id: string; texto: string; original: string } | null>(null);
  async function guardarEdicion() {
    const e = editando;
    if (!e) return;
    editando = null;
    if (e.texto.trim() === e.original.trim()) return;
    try { await chat.editar(e.id, e.texto.trim()); } catch (err) { error = mensajeError(err); }
  }
  function teclaEdicion(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); guardarEdicion(); }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); editando = null; }
  }
  async function quitar(m: RecordModel) {
    aBorrar = null;
    try { await borrar(m.id); } catch (e) { error = mensajeError(e); }
  }
  function alScroll() { if (lista && lista.scrollTop === 0 && chat.hayMas) chat.cargarMas(); }

  // Menú de emojis: para escribir (destino '') o para reaccionar a un mensaje (destino = su id).
  let menuEmojis: HTMLElement | undefined = $state();
  let destino = $state('');
  let posMenu = $state('');
  function abrirEmojis(e: MouseEvent, para: string) {
    if (estabaAbierto(menuEmojis) && destino === para) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    destino = para;
    // Arriba del botón si entra (~310 px de menú); si no (mensaje pegado arriba), abajo.
    const x = Math.max(8, Math.min(r.left, innerWidth - 304));
    posMenu = r.top > 320 ? `left:${x}px;bottom:${innerHeight - r.top + 4}px` : `left:${x}px;top:${r.bottom + 4}px`;
    menuEmojis?.showPopover();
  }
  // GIFs: panel arriba del botón; elegir uno lo manda enseguida (respondiendo, si había una respuesta en curso).
  let panelGifs = $state<HTMLElement>();
  let gifsAbierto = $state(false);
  let posGifs = $state('');
  function abrirGifs(e: MouseEvent) {
    if (estabaAbierto(panelGifs)) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    posGifs = `left:${Math.max(8, Math.min(r.left, innerWidth - 392))}px;bottom:${innerHeight - r.top + 4}px`;
    panelGifs?.showPopover();
  }
  async function mandarGif(url: string) {
    panelGifs?.hidePopover();
    error = '';
    try { await enviar(url, undefined, respondiendo?.id); respondiendo = null; } catch (e) { error = mensajeError(e); }
  }
  async function elegirEmoji(emoji: string) {
    menuEmojis?.hidePopover();
    if (destino) return reaccionar(destino, emoji);
    const i = caja?.selectionStart ?? texto.length, f = caja?.selectionEnd ?? texto.length;
    texto = texto.slice(0, i) + emoji + texto.slice(f);
    await tick();
    caja?.focus();
    caja?.setSelectionRange(i + emoji.length, i + emoji.length);
  }
  async function reaccionar(id: string, emoji: string) {
    try { await chat.reaccionar(id, emoji); } catch (e) { error = mensajeError(e); }
  }
  const reacciones = (m: RecordModel) => Object.entries((m.reacciones ?? {}) as Record<string, string[]>);

  // Imagen en grande: ruedita acerca/aleja hacia donde está el mouse.
  let visor: HTMLDialogElement | undefined = $state();
  let grande = $state<RecordModel | null>(null);
  let zoom = $state(1);
  let origen = $state('50% 50%');
  let mover = $state({ x: 0, y: 0 }); // arrastre con el mouse cuando hay zoom
  let arrastre = $state<{ x: number; y: number } | null>(null);
  function verGrande(m: RecordModel) { grande = m; zoom = 1; mover = { x: 0, y: 0 }; visor?.showModal(); }
  function rueda(e: WheelEvent) {
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    origen = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    zoom = Math.min(8, Math.max(1, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); // nunca más chica que entera
    if (zoom === 1) mover = { x: 0, y: 0 };
  }
  function agarrar(e: PointerEvent) {
    if (zoom === 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arrastre = { x: e.clientX - mover.x, y: e.clientY - mover.y };
  }
  function arrastrar(e: PointerEvent) {
    if (arrastre) mover = { x: e.clientX - arrastre.x, y: e.clientY - arrastre.y };
  }
</script>

<section class="chat" aria-label="Chat {titulo}">
  <h2 class="titulo">{titulo}{#if silencio}<MenuChat chat={silencio} {acciones} />{/if}</h2>
  <div class="lista" bind:this={lista} onscroll={alScroll} data-testid="mensajes">
    {#if chat.hayMas}<button class="plano" onclick={() => chat.cargarMas()}>Cargar anteriores</button>{/if}
    {#if chat.error}<p role="alert">{chat.error}</p>{/if}
    {#each chat.mensajes as m, i (m.id)}
      {@const a = autor(m)}
      {@const sigue = seguido(i)}
      {@const cita = m.expand?.respondeA as RecordModel | undefined}
      <article class="msg" class:sigue class:elegido={respondiendo?.id === m.id} class:resaltado={resaltado === m.id} class:mencionado={m.author !== sesion.usuario?.id && menciona(m.text, sesion.usuario?.name)} id="msg-{m.id}" data-testid="mensaje">
        {#if sigue}<small class="hora-lado">{hora(m)}</small>
        {:else}<img class="avatar" src={foto(a)} alt="" />{/if}
        <div class="cuerpo">
          {#if !sigue}<header>
            <strong style="color:{a?.color || 'var(--tenue)'}">{a ? a.name : 'Ex miembro'}</strong><Insignia usuario={a} />
            <small>{hora(m)}</small>
          </header>{/if}
          {#if m.respondeA}
            <button class="plano cita" onclick={() => cita && irA(cita.id)} disabled={!cita}>
              <Reply size={12} strokeWidth={1.75} />
              {#if cita}<strong>{(cita.expand?.author as RecordModel | undefined)?.name ?? 'Ex miembro'}</strong> <span>{resumen(cita)}</span>
              {:else}<span>Mensaje borrado</span>{/if}
            </button>
          {/if}
          {#if editando?.id === m.id}
            <!-- svelte-ignore a11y_autofocus -->
            <textarea class="edicion" bind:value={editando.texto} onkeydown={teclaEdicion} maxlength="2000" rows="2" autofocus aria-label="Editar mensaje"></textarea>
            <small class="ayuda">Enter guarda · Esc cancela</small>
          {:else if m.text && esGif(m.text)}<img class="gif" src={m.text.trim()} alt="GIF" loading="lazy" referrerpolicy="no-referrer" />
          {:else if m.text}<p class="texto">{#each partirEnLinks(m.text) as parte, j (j)}{#if parte.url}{@const url = parte.url}<a href={url} onclick={(e) => { e.preventDefault(); abrirLink(url); }}>{parte.texto}</a>{:else}{#each partirMenciones(parte.texto, nombres) as p, k (k)}{#if p.nombre}<span class="mencion" class:yo={p.nombre === sesion.usuario?.name}>{p.texto}</span>{:else}{p.texto}{/if}{/each}{/if}{/each}{#if m.editado}<small class="editado" title={`Editado ${new Date(m.editado.replace(' ', 'T')).toLocaleString('es')}`}> (editado)</small>{/if}</p>{/if}
          {#if m.text && editando?.id !== m.id && !esGif(m.text)}{@const link = primerLink(m.text)}{#if link}<VistaPrevia url={link} />{/if}{/if}
          {#if m.text && m.author !== sesion.usuario?.id && m.text.trim().startsWith('thunderop://invite/') && extraerCodigo(m.text)}{@const t = m.text}<button class="primario unirse" onclick={() => unirse(t).catch((e) => (error = mensajeError(e)))}>Unirme al grupo</button>{/if}
          {#if m.file}
            {@const url = pb.files.getURL(m, m.file)}
            {#if esVideo(m)}<video class="adjunto" controls src={url}><track kind="captions" /></video>
            {:else}<button class="plano ver" title="Ver en grande" onclick={() => verGrande(m)}><img class="adjunto" src={url} alt="Imagen adjunta" /></button>{/if}
          {/if}
          {#if reacciones(m).length}<div class="reacciones">
            {#each reacciones(m) as [emoji, quienes] (emoji)}
              <button class="plano chip" aria-pressed={quienes.includes(sesion.usuario?.id ?? '')} onclick={() => reaccionar(m.id, emoji)}
                title="{quienes.map(nombreDe).join(', ')} reaccion{quienes.length === 1 ? 'ó' : 'aron'} con {emoji}">{emoji} {quienes.length}</button>
            {/each}
          </div>{/if}
        </div>
        <div class="herramientas">
          <button class="icono" title="Responder" aria-label="Responder" onclick={() => responder(m)}><Reply size={16} strokeWidth={1.75} /></button>
          <button class="icono" title="Reaccionar" aria-label="Reaccionar" onpointerdown={() => alTocar(menuEmojis)} onclick={(e) => abrirEmojis(e, m.id)}><SmilePlus size={16} strokeWidth={1.75} /></button>
          {#if m.author === sesion.usuario?.id && !soloLectura && !esGif(m.text ?? '')}<button class="icono" title="Editar" aria-label="Editar" onclick={() => (editando = { id: m.id, texto: m.text, original: m.text })}><Pencil size={16} strokeWidth={1.75} /></button>{/if}
          {#if puedeBorrar(m)}<button class="icono borrar" title="Borrar" aria-label="Borrar" onclick={() => (aBorrar = m)}><Trash2 size={16} strokeWidth={1.75} /></button>{/if}
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
  {#if respondiendo && !soloLectura}
    <div class="pie respondiendo">
      <Reply size={14} strokeWidth={1.75} />
      <span>Respondiendo a <strong>{autor(respondiendo)?.name ?? 'Ex miembro'}</strong>: {resumen(respondiendo)}</span>
      <button class="icono" aria-label="Cancelar respuesta" title="Cancelar (Esc)" onclick={() => (respondiendo = null)}><X size={14} strokeWidth={1.75} /></button>
    </div>
  {/if}
  {#if soloLectura}<p class="pie tenue">{soloLectura}</p>
  {:else}<div class="composer">
    <label class="clip" title="Adjuntar imagen o video"><Paperclip size={18} strokeWidth={1.75} /><input type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm" onchange={elegir} data-testid="adjuntar" /></label>
    <button class="plano emoji" title="Emojis" aria-label="Emojis" onpointerdown={() => alTocar(menuEmojis)} onclick={(e) => abrirEmojis(e, '')}><Smile size={18} strokeWidth={1.75} /></button>
    <button class="plano gif-boton" title="GIFs" aria-label="GIFs" onpointerdown={() => alTocar(panelGifs)} onclick={abrirGifs}>GIF</button>
    {#if mencion && opciones.length}<ul class="sugerencias" role="listbox" aria-label="Mencionar a">
      {#each opciones as n, i (n)}<li><button type="button" class="plano" role="option" aria-selected={i === elegida} onmousedown={(e) => { e.preventDefault(); elegirMencion(n); }}>@{n}</button></li>{/each}
    </ul>{/if}
    <textarea bind:this={caja} bind:value={texto} onkeydown={tecla} oninput={revisarMencion} onclick={revisarMencion} onblur={() => (mencion = null)} onpaste={pegar} maxlength="2000" rows="1" placeholder="Escribí un mensaje" title="Enter envía, Shift+Enter hace una línea nueva"></textarea>
    <button class="primario" onclick={enviarMensaje} disabled={enviando}>Enviar</button>
  </div>{/if}
  {#if aBorrar}{@const m = aBorrar}<Confirmar texto="¿Borrar este mensaje?" cancelar={() => (aBorrar = null)} confirmar={() => quitar(m)} />{/if}
  <div popover class="panel-gifs" bind:this={panelGifs} style={posGifs} ontoggle={(e) => (gifsAbierto = e.newState === 'open')}>
    {#if gifsAbierto}<Gifs elegir={mandarGif} />{/if}
  </div>
  <div popover class="emojis" bind:this={menuEmojis} style={posMenu}>
    {#each EMOJIS as emoji (emoji)}<button class="plano" onclick={() => elegirEmoji(emoji)}>{emoji}</button>{/each}
  </div>
  <dialog class="visor" bind:this={visor} onclose={() => (grande = null)} onclick={(e) => e.target === visor && visor.close()}>
    {#if grande}
      <div class="acciones">
        <a class="boton plano" href={pb.files.getURL(grande, grande.file, { download: true })} download title="Descargar" aria-label="Descargar"><Download size={18} strokeWidth={1.75} /></a>
        <button class="plano" onclick={() => visor?.close()} title="Cerrar" aria-label="Cerrar"><X size={18} strokeWidth={1.75} /></button>
      </div>
      <div class="marco" role="presentation" class:movible={zoom > 1} class:agarrado={!!arrastre} onwheel={rueda} onpointerdown={agarrar} onpointermove={arrastrar} onpointerup={() => (arrastre = null)} onpointercancel={() => (arrastre = null)}>
        <img src={pb.files.getURL(grande, grande.file)} alt="Imagen adjunta" style="transform: translate({mover.x}px, {mover.y}px) scale({zoom}); transform-origin: {origen}" draggable="false" />
      </div>
    {/if}
  </dialog>
</section>

<style>
  .chat { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .titulo { font-size: 15px; padding: 12px 16px; border-bottom: 1px solid var(--hover); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .lista { flex: 1; overflow-y: auto; padding: 8px 0; }
  /* Separados entre sí; los seguidos del mismo autor van sin nombre ni foto. */
  .msg { position: relative; display: flex; gap: 12px; margin: 12px 12px 0; padding: 8px 12px; border-radius: var(--radio-menu); transition: background-color .12s; }
  .msg.sigue { margin-top: 4px; }
  .msg:hover { background: var(--hover); }
  .msg.elegido, .msg.resaltado { background: var(--acento-suave); box-shadow: inset 2px 0 var(--acento); }
  .hora-lado { width: 32px; flex: none; font-size: 11px; text-align: center; padding-top: 3px; opacity: 0; }
  .msg:hover .hora-lado { opacity: 1; }
  .cuerpo { min-width: 0; flex: 1; }
  header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
  header small { font-size: 11px; }
  .texto { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
  .texto a { color: var(--acento); text-decoration: underline; }
  .editado { font-size: 11px; color: var(--apagado); }
  .edicion { width: 100%; resize: vertical; }
  .ayuda { font-size: 11px; color: var(--tenue); }
  .cita { display: flex; gap: 6px; align-items: center; max-width: 100%; margin-bottom: 4px; padding: 2px 8px; font-size: 12px; color: var(--tenue);
    border-left: 2px solid var(--acento); border-radius: 0 var(--radio) var(--radio) 0; background: var(--hover); justify-content: flex-start; }
  .cita span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cita strong { font-weight: 600; color: var(--texto); flex: none; }
  .herramientas { position: absolute; top: -12px; right: 8px; display: none; gap: 2px; padding: 2px; background: var(--elevado); border: 1px solid var(--borde); border-radius: var(--radio); }
  .msg:hover .herramientas, .herramientas:focus-within { display: flex; }
  .herramientas .icono { padding: 4px; }
  .herramientas .borrar:hover { color: var(--peligro); }
  .respondiendo { display: flex; align-items: center; gap: 8px; margin: 8px 16px 0; padding: 6px 8px; font-size: 13px; color: var(--tenue);
    border-left: 2px solid var(--acento); background: var(--acento-suave); border-radius: 0 var(--radio) var(--radio) 0; }
  .respondiendo span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .respondiendo + .composer { margin-top: 4px; }
  .adjunto { display: block; max-width: min(400px, 100%); max-height: 300px; border-radius: var(--radio); margin-top: 4px; }
  .pie { margin: 0 16px; }
  .tenue { color: var(--tenue); margin-bottom: 16px; }
  .adjuntado { display: flex; align-items: center; gap: 8px; }
  .miniatura { width: 64px; height: 64px; object-fit: cover; border-radius: var(--radio); }
  .ver { padding: 0; display: block; cursor: zoom-in; }
  .reacciones { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .chip { min-height: 26px; padding: 2px 8px; font-size: 13px; border-color: var(--borde); }
  .emoji { padding: 4px; color: var(--icono); }
  .gif { display: block; max-width: 280px; max-height: 240px; border-radius: var(--radio); margin-top: 2px; }
  .gif-boton { font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 2px 6px; border: 1.5px solid var(--icono); border-radius: 4px; color: var(--icono); }
  .panel-gifs { position: fixed; inset: auto; margin: 0; padding: 10px; background: var(--elevado); color: var(--texto); border: 1px solid var(--borde); border-radius: var(--radio-menu); }
  .emojis { position: fixed; inset: auto; margin: 0; padding: 6px; width: 296px; flex-wrap: wrap; gap: 2px;
    background: var(--panel); border: 1px solid var(--borde); border-radius: 10px; }
  .emojis:popover-open { display: flex; }
  .emojis button { font-size: 20px; padding: 2px; min-height: 0; width: 34px; height: 34px; }
  .visor { max-width: none; width: 70vw; height: 70vh; padding: 0; overflow: hidden; background: var(--hondo); }
  .visor[open] { display: flex; flex-direction: column; }
  .acciones { display: flex; justify-content: flex-end; gap: 4px; padding: 6px; }
  .acciones .boton { display: inline-flex; align-items: center; padding: 6px 14px; color: var(--tenue); text-decoration: none; border-radius: var(--radio); }
  .acciones .boton:hover { color: var(--texto); background: var(--hover); }
  .marco { flex: 1; min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .marco img { max-width: 100%; max-height: 100%; object-fit: contain; transition: transform .08s; user-select: none; }
  .marco.movible { cursor: grab; }
  .marco.agarrado { cursor: grabbing; }
  .marco.agarrado img { transition: none; }
  .composer { display: flex; align-items: center; gap: 8px; margin: 8px 16px 16px; background: var(--panel); border: 1px solid var(--borde); border-radius: 8px; padding: 6px 8px; }
  .composer { position: relative; }
  .sugerencias { position: absolute; left: 8px; bottom: calc(100% + 4px); z-index: 5; margin: 0; padding: 4px; list-style: none; min-width: 200px; background: var(--panel); border: 1px solid var(--borde); border-radius: var(--radio-menu); }
  .sugerencias button { width: 100%; text-align: left; padding: 6px 8px; }
  .sugerencias button[aria-selected='true'] { background: var(--acento-suave); }
  .mencion { padding: 0 2px; border-radius: 4px; background: var(--acento-suave); color: var(--acento-texto, var(--acento)); font-weight: 600; }
  .mencion.yo { background: var(--acento); color: #fff; }
  .msg.mencionado { box-shadow: inset 2px 0 var(--acento); }
  .composer textarea { flex: 1; min-width: 0; resize: none; field-sizing: content; max-height: 120px; background: none; border: 0; padding: 6px 4px; }
  .clip { cursor: pointer; flex-direction: row; color: var(--icono); padding: 4px; }
  .clip:hover { color: var(--texto); }
  .unirse { align-self: flex-start; margin-top: 4px; }
</style>
