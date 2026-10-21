<script lang="ts">
  import Insignia from './Insignia.svelte';
  import type { RecordModel } from 'pocketbase';
  import { MicOff, Users, Link, Volume2, VolumeX, Maximize, ChevronRight, MessageSquare } from '@lucide/svelte';
  import { foto } from '../foto';
  import { mensajeError, sesion } from '../sesion.svelte';
  import { crearInvitacion } from '../grupos.svelte';
  import { abrirChat, enviar, borrar } from '../chat.svelte';
  import AhoraSuena from './AhoraSuena.svelte';
  import Chat from './Chat.svelte';
  import { voz, volumen, silenciar, ver, pistaPantalla, pistaPantallaPropia, vistaPrevia, volumenPantalla } from '../voz.svelte';
  import { leerPrefs } from '../prefs';
  import { abrirEnPunto } from '../menu';
  import { mirar as mirarSala } from '../noLeidos.svelte';

  let { grupo, soyDueno, sala, verParticipantes }: { grupo: RecordModel; soyDueno: boolean; sala: string; verParticipantes: () => void } = $props();
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  const miembro = (id: string) => miembros.find((m) => m.id === id);
  // Silencios recién pedidos, hasta que el grupo se refresque con el valor del servidor.
  let pedidos = $state<Record<string, boolean>>({});
  const silenciado = (id: string) => pedidos[id] ?? ((grupo.silenciados ?? []) as string[]).includes(id);
  let vols = $state<Record<string, number>>({ ...leerPrefs().volumenes });
  let error = $state('');
  let aviso = $state('');

  async function alternar(id: string) {
    menu?.hidePopover();
    error = '';
    const nuevo = !silenciado(id);
    try { await silenciar(grupo.id, id, nuevo); pedidos[id] = nuevo; } catch (e) { error = mensajeError(e); }
  }
  async function copiarLink() {
    error = '';
    try {
      const link = await crearInvitacion(grupo.id);
      await navigator.clipboard.writeText(link).then(() => (aviso = 'Link de invitación copiado.'), () => (aviso = link));
    } catch (e) { error = mensajeError(e); }
  }

  let vid = $state<HTMLVideoElement>();
  let pctPantalla = $state(100);
  let ultimoPct = 100;
  let marco = $state<HTMLElement>();
  function sonarPantalla(pct: number) {
    if (pct) ultimoPct = pct;
    pctPantalla = pct;
    if (voz.viendo) volumenPantalla(voz.viendo, pct / 100);
  }
  // Se recalcula con cada cambio de `voz.participantes` (así se entera de que llegó la pista), pero solo
  // avisa si cambia la pista: hablar o silenciarse no re-engancha el video.
  const pista = $derived((void voz.participantes, voz.viendo ? pistaPantalla(voz.viendo) : undefined));
  $effect(() => {
    const t = pista;
    if (!t || !vid) return;
    const el = vid;
    t.attach(el);
    return () => { t.detach(el); };
  });
  // Vista previa de la propia transmisión: misma regla, solo reacciona a la referencia de la pista.
  let prev = $state<HTMLVideoElement>();
  const pistaPropia = $derived((void voz.participantes, voz.transmitiendo && voz.vistaPrevia ? pistaPantallaPropia() : undefined));
  $effect(() => {
    const t = pistaPropia;
    if (!t || !prev) return;
    const el = prev;
    t.attach(el);
    return () => { t.detach(el); };
  });
  const mirar = (id: string | null) => { pctPantalla = 100; if (id) volumenPantalla(id, 1); ver(id); };
  const quien = $derived(voz.participantes.find((p) => p.id === voz.viendo)?.nombre ?? '');
  // Fondo de la tarjeta: el color del usuario, o un tono derivado del nombre.
  const fondo = (color: string | undefined, nombre: string) =>
    `color-mix(in srgb, ${color || `hsl(${[...nombre].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 45% 40%)`} 35%, var(--panel))`;
  function cambiar(id: string, pct: number) { vols[id] = pct / 100; volumen(id, pct / 100); }

  // Clic derecho en una píldora: volumen y, para el dueño, silenciar.
  let menu = $state<HTMLElement>();
  let elegido = $state<{ id: string; nombre: string } | null>(null);
  function abrirMenu(e: MouseEvent, p: { id: string; nombre: string; local: boolean }) {
    e.preventDefault();
    if (p.local) return;
    elegido = p;
    void abrirEnPunto(menu, e.clientX, e.clientY);
  }

  // Chat de la sala, plegable y recordado.
  let chatAbierto = $state((() => { try { return localStorage.getItem('dm.chatSala') !== '0'; } catch { return true; } })());
  $effect(() => { if (chatAbierto && voz.salaId) return mirarSala(voz.salaId); });
  function plegarChat(a: boolean) { chatAbierto = a; try { localStorage.setItem('dm.chatSala', a ? '1' : '0'); } catch { /* sin almacenamiento */ } }
</script>

<section class="voz" class:conChat={chatAbierto}>
  <div class="centro">
    <header>
      <h2>{sala}</h2>
      <span class="tenue">{grupo.name}</span>
      <button class="plano" onclick={verParticipantes}><Users size={16} strokeWidth={1.75} /> Participantes · {miembros.length}</button>
      <button class="icono" onclick={copiarLink} aria-label="Copiar link de invitación" title="Copiar link de invitación"><Link size={16} strokeWidth={1.75} /></button>
      {#if !chatAbierto}<button class="icono" onclick={() => plegarChat(true)} aria-label="Abrir chat de la sala" title="Chat de la sala"><MessageSquare size={16} strokeWidth={1.75} /></button>{/if}
    </header>
    {#if voz.conectando}<p role="status">Conectando…</p>{/if}
    {#if aviso}<p role="status">{aviso}</p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}

    {#if voz.viendo}
      <!-- Pantalla completa sobre el contenedor (no el <video>): el mute nativo del video no toca el audio, que va por otra pista. -->
      <div class="escenario" bind:this={marco}>
        <video bind:this={vid} autoplay playsinline muted aria-label={`Pantalla de ${quien}`}></video>
        <span class="etiqueta"><span class="punto"></span>{quien}</span>
        <div class="controles">
          <button class="icono" onclick={() => sonarPantalla(pctPantalla ? 0 : ultimoPct)} aria-label={pctPantalla ? 'Silenciar transmisión' : 'Activar sonido'}>
            {#if pctPantalla}<Volume2 size={16} strokeWidth={1.75} />{:else}<VolumeX size={16} strokeWidth={1.75} />{/if}</button>
          <input type="range" min="0" max="200" step="5" bind:value={pctPantalla} aria-label="Volumen de la transmisión" oninput={() => sonarPantalla(pctPantalla)} />
          <button class="icono" onclick={() => (document.fullscreenElement ? document.exitFullscreen() : marco?.requestFullscreen())?.catch(() => {})} aria-label="Pantalla completa" title="Pantalla completa"><Maximize size={16} strokeWidth={1.75} /></button>
        </div>
      </div>
    {/if}
    <ul class="franja">
      {#each voz.participantes as p (p.id)}
        {@const m = miembro(p.id)}
        <li class:hablando={p.hablando} class:transmite={p.transmite} style="background:{fondo(m?.color, p.nombre)}" oncontextmenu={(e) => abrirMenu(e, p)}>
          <img class="avatar" alt="" src={foto(m, '256x256')} />
          {#if p.transmite}<span class="vivo">EN VIVO</span>
            {#if !p.local}<button class="primario ver" onclick={() => mirar(voz.viendo === p.id ? null : p.id)}>{voz.viendo === p.id ? 'Dejar de ver' : 'Ver'}</button>{/if}{/if}
          <span class="etiqueta-nombre">
            {#if p.silenciado}<span class="mic" title="Sin micrófono" aria-label="Silenciado"><MicOff size={16} strokeWidth={1.75} /></span>{/if}
            <span class="nombre">{p.nombre}{p.local ? ' (vos)' : ''}</span><Insignia usuario={m} />
          </span>
        </li>
      {/each}
    </ul>
    {#if voz.transmitiendo}<div class="propia">
      {#if voz.vistaPrevia}
        <video class="previa" bind:this={prev} autoplay playsinline muted aria-label="Vista previa de tu transmisión"></video>
        <button class="plano" onclick={() => vistaPrevia(false)}>Ocultar vista previa</button>
      {:else}<button class="plano" onclick={() => vistaPrevia(true)}>Mostrar vista previa</button>{/if}
    </div>{/if}

    <div class="pie-musica"><AhoraSuena /></div>
  </div>

  {#if chatAbierto && voz.salaId}
    {@const id = voz.salaId}
    <aside class="chatSala">
      <button class="icono plegar" onclick={() => plegarChat(false)} aria-label="Plegar chat de la sala" title="Plegar"><ChevronRight size={16} strokeWidth={1.75} /></button>
      {#key id}<Chat titulo="Chat de la sala" abrir={() => abrirChat(id)} enviar={(t, f, r) => enviar(id, t, f, r)} {borrar}
        puedeBorrar={(m) => m.author === sesion.usuario?.id || soyDueno} />{/key}
    </aside>
  {/if}
</section>

<div popover bind:this={menu} class="menu">
  {#if elegido}
    {@const p = elegido}
    <label>Volumen · {Math.round((vols[p.id] ?? 1) * 100)} %
      <input type="range" min="0" max="200" step="5" value={Math.round((vols[p.id] ?? 1) * 100)}
        aria-label={`Volumen de ${p.nombre}`} oninput={(e) => cambiar(p.id, +e.currentTarget.value)} />
    </label>
    {#if soyDueno}<hr /><button class="plano peligro" onclick={() => alternar(p.id)}>{silenciado(p.id) ? 'Quitar silencio' : 'Silenciar'}</button>{/if}
  {/if}
</div>

<style>
  .voz { display: grid; grid-template-columns: 1fr; min-height: 0; min-width: 0; }
  .voz.conChat { grid-template-columns: 1fr 320px; }
  .centro { padding: 16px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  header { display: flex; align-items: center; gap: 8px; }
  h2 { font-size: 20px; font-weight: 600; }
  .tenue { color: var(--tenue); margin-right: auto; }
  /* Una tarjeta por persona (como Discord); la pantalla que mirás va arriba, a todo el ancho. */
  .franja { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
  .franja li { position: relative; aspect-ratio: 16 / 9; display: grid; place-items: center; border: 2px solid transparent; border-radius: var(--radio-tarjeta); overflow: hidden; transition: border-color .12s; }
  .franja li.hablando { border-color: var(--ok); }
  .franja li.transmite:not(.hablando) { border-color: color-mix(in srgb, var(--ok) 40%, transparent); }
  .franja .avatar { width: 80px; height: 80px; }
  .etiqueta-nombre { position: absolute; left: 8px; bottom: 8px; max-width: calc(100% - 16px); display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: var(--radio); background: rgb(0 0 0 / .55); }
  .nombre { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mic { color: var(--peligro); display: grid; }
  .vivo { position: absolute; top: 8px; left: 8px; padding: 2px 8px; border-radius: var(--radio); font-size: 11px; font-weight: 600; color: #fff; background: color-mix(in srgb, var(--ok) 70%, #000); }
  .ver { position: absolute; bottom: 8px; right: 8px; }
  .escenario { position: relative; background: var(--hondo); border: 1px solid var(--borde); border-radius: var(--radio-tarjeta); overflow: hidden; }
  .escenario video { display: block; width: 100%; max-height: 60vh; object-fit: contain; }
  .etiqueta { position: absolute; top: 12px; left: 12px; display: flex; align-items: center; gap: 8px; padding: 4px 8px; font-size: 13px; font-weight: 500; background: rgb(0 0 0 / .6); border-radius: var(--radio); }
  .punto { width: 6px; height: 6px; border-radius: 999px; background: var(--ok); }
  .controles { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 4px; padding: 2px 4px; background: rgb(0 0 0 / .6); border-radius: var(--radio); }
  .controles input { width: 100px; padding: 0; background: none; border: 0; }
  .escenario:fullscreen { display: grid; place-items: center; border: 0; border-radius: 0; background: #000; }
  .escenario:fullscreen video { max-height: none; height: 100%; }
  /* Pegada abajo, justo arriba del dock, aunque haya pocas tarjetas o muchas (sticky al scrollear). */
  .pie-musica { margin-top: auto; position: sticky; bottom: 0; }
  .pie-musica:empty { display: none; }
  .propia { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .previa { width: 240px; max-width: 100%; aspect-ratio: 16 / 9; background: var(--hondo); border-radius: var(--radio); }
  .chatSala { position: relative; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--borde); background: var(--fondo); }
  .chatSala :global(.chat) { flex: 1; }
  .chatSala :global(.titulo) { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--tenue); }
  .plegar { position: absolute; top: 8px; right: 8px; z-index: 1; }
  .menu { position: fixed; inset: auto; margin: 0; padding: 8px; min-width: 220px; flex-direction: column; gap: 4px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde); border-radius: var(--radio-menu); }
  .menu:popover-open { display: flex; }
  .menu input { padding: 0; background: none; border: 0; }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
  .menu button { justify-content: flex-start; }
</style>
