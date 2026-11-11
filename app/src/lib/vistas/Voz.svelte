<script lang="ts">
  import MenuPersona from './MenuPersona.svelte';
  import EstadoVoz from './EstadoVoz.svelte';
  import { lleno } from '../rango';
  import Insignia from './Insignia.svelte';
  import type { RecordModel } from 'pocketbase';
  import { MicOff, Users, ChevronRight, MessageSquare, Eye, EyeOff, Volume2, Menu, ChevronLeft } from '@lucide/svelte';
  import { pantalla } from '../plataforma.svelte';
  import { mantener } from '../mantener';
  import { navMovil, cerrarCapa } from '../navMovil.svelte';
  import { foto } from '../foto';
  import { mensajeError, sesion } from '../sesion.svelte';
  import { grupos, asignarRol } from '../grupos.svelte';
  import { puedo, rolesDe, rolesDeMiembro, type Permiso } from '../permisos';
  import { abrirChat, enviar, borrar } from '../chat.svelte';
  import AhoraSuena from './AhoraSuena.svelte';
  import Chat from './Chat.svelte';
  import { voz, volumen, silenciar, desconectar, moverA, bloquearVoz, ver, pistaPantallaPropia, pistaCamara, vistaPrevia, moverCamEnPantalla } from '../voz.svelte';
  import Pantalla from './Pantalla.svelte';
  import EscenarioYoutube from './EscenarioYoutube.svelte';
  import { youtube } from '../youtube/youtube.svelte';
  import { completa } from '../pantallaCompleta.svelte';
  import Video from './Video.svelte';
  import { leerPrefs } from '../prefs';
  import { abrirEnPunto } from '../menu';
  import { mirar as mirarSala } from '../noLeidos.svelte';
  import { amigos } from '../amigos.svelte';
  import { privado } from '../privados.svelte';

  let { grupo, soyDueno, sala, salasVoz = [], abrirSalas, volver }: { grupo: RecordModel; soyDueno: boolean; sala: string; salasVoz?: RecordModel[]; abrirSalas?: () => void; volver?: () => void } = $props();
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  const miembro = (id: string) => miembros.find((m) => m.id === id);
  let error = $state('');
  // Lo que se le puede hacer a alguien de la llamada depende de mis permisos (permisos.ts); al admin, nada.
  const pp = (x: Permiso) => puedo(grupo, sesion.usuario?.id, x);
  const moderable = (id: string) => id !== grupo.owner && id !== sesion.usuario?.id;



  // "Pantalla + cámara": en la vista previa, la ventanita de la cámara se arrastra (mover) o desde la esquina (tamaño).
  let previaEl = $state<HTMLElement>();
  function acomodar(e: PointerEvent, que: 'mover' | 'tamano') {
    const c = voz.camEnPantalla, caja = previaEl?.getBoundingClientRect();
    if (!c || !caja) return;
    e.preventDefault(); e.stopPropagation();
    const desde = { x: e.clientX, y: e.clientY }, inicio = { ...c };
    const mover = (ev: PointerEvent) => {
      const dx = (ev.clientX - desde.x) / caja.width, dy = (ev.clientY - desde.y) / caja.height;
      moverCamEnPantalla(que === 'mover' ? { ...inicio, x: inicio.x + dx, y: inicio.y + dy } : { ...inicio, w: inicio.w + dx });
    };
    const soltar = () => { for (const [t, f] of [['pointermove', mover], ['pointerup', soltar], ['pointercancel', soltar]] as const) window.removeEventListener(t, f as EventListener); };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  }
  // Con el teclado: flechas mueven la ventanita y + / − le cambian el tamaño.
  function acomodarConTeclas(e: KeyboardEvent) {
    const c = voz.camEnPantalla;
    if (!c) return;
    const paso = 0.02;
    const d: Record<string, Partial<typeof c>> = { ArrowLeft: { x: c.x - paso }, ArrowRight: { x: c.x + paso }, ArrowUp: { y: c.y - paso }, ArrowDown: { y: c.y + paso },
      '+': { w: c.w + paso }, '=': { w: c.w + paso }, '-': { w: c.w - paso } };
    if (!d[e.key]) return;
    e.preventDefault();
    moverCamEnPantalla({ ...c, ...d[e.key] });
  }
  // Celular: mantener apretada una tarjeta abre su menú; el toque que termina ese gesto no agranda la cámara.
  let mantuvo = 0;
  // Vista previa propia; se recalcula cuando cambian los participantes (llega o se va la pista).
  const propia = $derived((void voz.participantes, voz.transmitiendo && voz.vistaPrevia ? pistaPantallaPropia() : undefined));

  // Fondo de la tarjeta: el color del usuario, o un tono derivado del nombre.
  const fondo = (color: string | undefined, nombre: string) =>
    `color-mix(in srgb, ${color || `hsl(${[...nombre].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 45% 40%)`} 35%, var(--panel))`;

  // Clic derecho en una tarjeta: el menú de esa persona (MenuPersona, el mismo de la lista de salas).
  let menuPersona = $state<ReturnType<typeof MenuPersona>>();
  function abrirMenu(e: MouseEvent, p: { id: string; nombre: string; local: boolean }) {
    e.preventDefault();
    if (!p.local) menuPersona?.abrir(e.clientX, e.clientY, p);
  }

  // Chat de la sala, plegable y recordado.
  let chatAbierto = $state((() => { try { return localStorage.getItem('dm.chatSala') !== '0'; } catch { return true; } })());
  $effect(() => { if (chatAbierto && voz.salaId) return mirarSala(voz.salaId); });
  // Celular: qué pasa con la pantalla y al cambiar de app (ver segundoPlano.ts y volverALaLlamada); se avisa una vez por sesión.
  const AVISO_ANDROID = 'Mientras estés en la llamada, la pantalla no se apaga sola.';
  const AVISO_IPHONE = 'En iPhone, si cambiás de app la llamada se corta, pero cuando volvés entra sola de nuevo.';
  const esIphone = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  let avisoLlamada = $state(pantalla.movil && (() => { try { return !sessionStorage.getItem('dm.avisoLlamada'); } catch { return true; } })());
  function entendido() { avisoLlamada = false; try { sessionStorage.setItem('dm.avisoLlamada', '1'); } catch { /* sin almacenamiento: dura esta vista */ } }
  let ocultarGente = $state(false); // mientras se mira una transmisión, las tarjetas de la gente se pueden esconder
  const enEscena = $derived(voz.viendo.length + (youtube.actual ? 1 : 0)); // transmisiones que se miran + el video de YouTube juntos
  // En el celular el chat de la sala se abre a pantalla completa desde el dock (navMovil.chatSala).
  const verChat = $derived(pantalla.movil ? navMovil.chatSala : chatAbierto);
  function plegarChat(a: boolean) { chatAbierto = a; try { localStorage.setItem('dm.chatSala', a ? '1' : '0'); } catch { /* sin almacenamiento */ } }

  // Ancho del chat de la sala: se arrastra el borde izquierdo (o flechas con el foco), se guarda en esta PC; doble clic vuelve al de siempre.
  // El de siempre es también el mínimo: más angosto se rompe el chat (Jorge, 2026-11-08).
  const ANCHO = 296, MIN = ANCHO, MAX = 720;
  const limitar = (a: number) => Math.round(Math.min(MAX, Math.max(MIN, a)));
  let anchoChat = $state((() => { try { const a = Number(localStorage.getItem('dm.anchoChatSala')); return a ? limitar(a) : ANCHO; } catch { return ANCHO; } })());
  function fijarAncho(a: number) { anchoChat = limitar(a); try { localStorage.setItem('dm.anchoChatSala', String(anchoChat)); } catch { /* sin almacenamiento */ } }
  function arrastrar(e: PointerEvent) {
    e.preventDefault(); // sin seleccionar texto al arrastrar
    const borde = e.currentTarget as HTMLElement, x0 = e.clientX, a0 = anchoChat;
    borde.setPointerCapture(e.pointerId);
    const mover = (m: PointerEvent) => fijarAncho(a0 + x0 - m.clientX);
    borde.addEventListener('pointermove', mover);
    borde.addEventListener('lostpointercapture', () => borde.removeEventListener('pointermove', mover), { once: true });
  }
</script>

{#snippet espectadores(n: number)}
  <span class="espectadores num" title={`${n} ${n === 1 ? 'persona mirando' : 'personas mirando'}`}><Eye size={14} strokeWidth={1.75} />{n}</span>
{/snippet}

<section class="voz entra" class:conChat={chatAbierto && !pantalla.movil} class:movil={pantalla.movil} style:--ancho-chat="{anchoChat}px">
  <div class="centro">
    <header>
      {#if volver}<button class="icono" aria-label="Volver" title="Volver" onclick={volver}><ChevronLeft size={22} strokeWidth={1.75} /></button>{/if}
      {#if abrirSalas}<button class="icono" aria-label="Abrir salas" title="Salas" onclick={abrirSalas}><Menu size={20} strokeWidth={1.75} /></button>{/if}
      <Volume2 size={18} strokeWidth={1.75} color="var(--icono)" />
      <h2>{sala}</h2>
      <span class="en-voz num">{voz.participantes.length} en voz</span>
      {#if enEscena}<button class="plano" onclick={() => (ocultarGente = !ocultarGente)}>{#if ocultarGente}<Eye size={16} strokeWidth={1.75} /> Mostrar participantes{:else}<EyeOff size={16} strokeWidth={1.75} /> Ocultar participantes{/if}</button>{/if}
      <!-- popovertarget: abre y cierra con el mismo botón (con onclick, el clic la cerraba y la volvía a abrir) -->
      <button class="plano" popovertarget="capa-participantes"><Users size={16} strokeWidth={1.75} /> Participantes · {miembros.length}</button>
      {#if !chatAbierto && !pantalla.movil}<button class="icono" onclick={() => plegarChat(true)} aria-label="Abrir chat de la sala" title="Chat de la sala"><MessageSquare size={16} strokeWidth={1.75} /></button>{/if}
    </header>
    {#if avisoLlamada}<p class="aviso-celular">{esIphone ? AVISO_IPHONE : AVISO_ANDROID}
      <button class="plano" onclick={entendido}>Entendido</button></p>{/if}
    {#if voz.conectando}<p role="status">Conectando…</p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}

    {#if enEscena}
      <!-- Una sola: grande. Varias: lado a lado si entran a un tamaño que se distinga, si no una abajo de la otra. -->
      <!-- Todas las que se miran entran en el espacio que hay, sin scroll: 1 = entera, 2 = mitad y mitad, 3-4 = de a dos. -->
      <div class="escenarios" class:completa={completa.sid === 'todas'} data-n={Math.min(enEscena, 5)}>
        {#each voz.viendo as sid (sid)}<Pantalla {sid} />{/each}
        {#if youtube.actual}<EscenarioYoutube />{/if}
      </div>
    {/if}
    <ul class="franja" class:oculta={ocultarGente && enEscena > 0}>
      {#each voz.participantes as p, i (p.id)}
        {@const m = miembro(p.id)}
        <li style:--i={Math.min(i, 5)} class:hablando={p.hablando} class:transmite={p.transmite} style="background:{fondo(m?.color, p.nombre)};--habla:{m?.color || 'var(--acento)'}" oncontextmenu={(e) => abrirMenu(e, p)} use:mantener={(x, y) => { mantuvo = Date.now(); abrirMenu({ clientX: x, clientY: y, preventDefault() {} } as MouseEvent, p); }}>
          {#if p.transmite}<span class="chips-vivo"><span class="vivo"><span class="punto-vivo"></span>EN VIVO</span>{@render espectadores(p.espectadores)}</span>{/if}
          {#if p.camara && pistaCamara(p.id)}<!-- Clic (o tocar) agranda la cámara a pantalla completa; de nuevo, vuelve. -->
            <button class="plano cam" aria-label={`Agrandar la cámara de ${m?.name || p.nombre}`}
              onclick={(e) => { if (Date.now() - mantuvo < 800) return; (document.fullscreenElement ? document.exitFullscreen() : e.currentTarget.requestFullscreen()).catch(() => {}); }}>
              <Video pista={pistaCamara(p.id)!} clase="video-cam" etiqueta={`Cámara de ${m?.name || p.nombre}`} /></button>
          {:else}<img class="avatar" alt="" src={foto(m, '256x256')} />{/if}
          {#if p.transmite && !p.local && p.pantalla}{@const sid = p.pantalla}{@const viendo = voz.viendo.includes(sid)}
            <button class="primario ver" aria-pressed={viendo} onclick={() => ver(sid, !viendo)}>{viendo ? 'Dejar de ver' : 'Ver'}</button>{/if}
          <span class="etiqueta-nombre">
            <span class="mic"><EstadoVoz silenciado={p.silenciado} ensordecido={p.ensordecido} tam={16} /></span>
            <span class="nombre">{m?.name || p.nombre}{p.local ? ' (vos)' : ''}</span><Insignia usuario={m} />
          </span>
        </li>
      {/each}
    </ul>
    {#if voz.transmitiendo}<div class="propia">
      {#if voz.vistaPrevia}
        <div class="previa-caja" bind:this={previaEl}>
          {#if propia}<Video pista={propia} clase="previa" etiqueta="Vista previa de tu transmisión" />{/if}
          {#if voz.camEnPantalla && voz.camara && sesion.usuario}{@const c = voz.camEnPantalla}
            <div class="cam-mover" role="slider" tabindex="0" aria-label="Mover la cámara sobre tu pantalla" aria-valuenow={Math.round(c.x * 100)}
              style:left="{c.x * 100}%" style:top="{c.y * 100}%" style:width="{c.w * 100}%" onpointerdown={(e) => acomodar(e, 'mover')} onkeydown={acomodarConTeclas}>
              {#if pistaCamara(sesion.usuario.id)}<Video pista={pistaCamara(sesion.usuario.id)!} clase="video-cam" etiqueta="Tu cámara" />{/if}
              <span class="tamano" aria-hidden="true" onpointerdown={(e) => acomodar(e, 'tamano')}></span>
            </div>
          {/if}
        </div>
        <button class="plano" onclick={() => vistaPrevia(false)}>Ocultar vista previa</button>
      {:else}<button class="plano" onclick={() => vistaPrevia(true)}>Mostrar vista previa</button>{/if}
    </div>{/if}

    <!-- En la compu va en el dock. -->
    {#if pantalla.movil}<div class="pie-musica"><AhoraSuena /></div>{/if}
  </div>

  {#if verChat && voz.salaId}
    {@const id = voz.salaId}
    <aside class="chatSala">
      {#if !pantalla.movil}<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div class="borde-chat" role="separator" aria-orientation="vertical" aria-label="Ancho del chat" aria-valuenow={anchoChat} aria-valuemin={MIN} aria-valuemax={MAX} tabindex="0"
          title="Arrastrá para cambiar el ancho · doble clic: el de siempre" onpointerdown={arrastrar} ondblclick={() => fijarAncho(ANCHO)}
          onkeydown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); fijarAncho(anchoChat + (e.key === 'ArrowLeft' ? 16 : -16)); } }}></div>
        <button class="icono plegar" onclick={() => plegarChat(false)} aria-label="Plegar chat de la sala" title="Plegar"><ChevronRight size={16} strokeWidth={1.75} /></button>{/if}
      {#key id}<Chat titulo="Chat de la sala" cerrar={pantalla.movil ? cerrarCapa : undefined} miembros={grupos.lista.find((g) => g.id === voz.grupoId)?.expand?.members ?? []} abrir={() => abrirChat(id)} enviar={(t, f, r) => enviar(id, t, f, r)} {borrar} silencio={id}
        puedeBorrar={(m) => m.author === sesion.usuario?.id || pp('mensajes')} />{/key}
    </aside>
  {/if}
</section>

<MenuPersona bind:this={menuPersona} {grupo} {salasVoz} alError={(m) => (error = m)} />

<style>
  .previa-caja { position: relative; display: inline-block; max-width: 100%; }
  .cam-mover { position: absolute; aspect-ratio: 16 / 9; border-radius: 6px; overflow: hidden; outline: 2px solid var(--acento); cursor: grab; touch-action: none; background: #000; }
  .cam-mover :global(.video-cam) { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .tamano { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; background: var(--acento); cursor: nwse-resize; border-top-left-radius: 4px; }
  .cam { position: absolute; inset: 0; padding: 0; border-radius: inherit; overflow: hidden; background: #000; }
  /* Con la cámara de fondo, el nombre, el EN VIVO y "Ver" van encima (son ítems de la grilla: z-index anda sin position). */
  .franja li > .etiqueta-nombre, .franja li > .chips-vivo, .franja li > .ver { z-index: 1; }
  .cam :global(.video-cam) { width: 100%; height: 100%; object-fit: cover; }
  .cam:fullscreen :global(.video-cam) { object-fit: contain; }
  .voz { display: grid; grid-template-columns: 1fr; min-height: 0; min-width: 0; }
  .voz.conChat { grid-template-columns: minmax(0, 1fr) clamp(296px, var(--ancho-chat), 60%); }
  .borde-chat { position: absolute; inset: 0 auto 0 -4px; width: 8px; z-index: 2; cursor: col-resize; touch-action: none; }
  .borde-chat:hover, .borde-chat:focus-visible, .borde-chat:active { background: linear-gradient(to right, transparent 3px, var(--acento) 3px 5px, transparent 5px); outline: none; }
  /* Celular: tarjetas de a 2 y el chat de la sala encima de todo, a pantalla completa. */
  .aviso-celular { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; font-size: 13px; border-radius: var(--radio-menu);
    background: color-mix(in srgb, var(--ausente) 12%, transparent); border: 1px solid color-mix(in srgb, var(--ausente) 35%, transparent); }
  .aviso-celular button { margin-left: auto; flex: none; color: var(--texto); }
  .voz.movil .franja { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .voz.movil header { height: calc(52px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); }
  .voz.movil .chatSala { position: fixed; inset: 0; z-index: 15; padding-top: env(safe-area-inset-top); border: 0; }
  .centro { padding: 0 16px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 8px; height: 52px; flex: none; margin: 0 -16px; padding: 0 12px 0 16px;
    background: var(--fondo); border-bottom: 1px solid var(--borde); }
  h2 { font-size: 15px; font-weight: 650; letter-spacing: 0; }
  .en-voz { margin-right: auto; padding: 2px 8px; border-radius: var(--radio-pildora); font-size: 12px; font-weight: 600; color: var(--ok); background: var(--ok-suave); }
  /* Una tarjeta por persona (como Discord); la pantalla que mirás va arriba, a todo el ancho. */
  .franja.oculta { display: none; }
  .franja { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
  /* Tres filas fijas: chips (EN VIVO, espectadores) / foto / nombre y botón. La foto se achica con la tarjeta. */
  .franja li { position: relative; aspect-ratio: 16 / 9; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: 24px minmax(0, 1fr) 28px;
    gap: 6px; padding: 8px; border: 2px solid var(--borde); border-radius: var(--radio-grande);
    overflow: hidden; transition: border-color var(--dur-media); }
  /* El borde de quien habla, con el color que eligió esa persona (sin color, el del tema). */
  .franja li.hablando { border-color: color-mix(in srgb, var(--habla) 85%, transparent); }
  :global([data-modo='moderno']) .franja li.hablando { box-shadow: 0 0 14px -2px color-mix(in srgb, var(--habla) 60%, transparent), 0 0 24px -4px color-mix(in srgb, var(--habla) 35%, transparent); }
  .franja li.transmite:not(.hablando) { border-color: color-mix(in srgb, var(--cian) 45%, transparent); }
  /* Modo moderno: al entrar a la llamada las tarjetas aparecen escalonadas (tope de 6). */
  :global([data-modo='moderno']) .franja li { animation: entra 240ms var(--curva-salida) backwards; animation-delay: calc(var(--i) * 40ms); }
  @keyframes entra { from { opacity: 0; transform: scale(.92); } }
  /* La foto se achica con la tarjeta (container query): nunca pisa los chips de arriba ni el nombre y el botón de abajo. */
  .franja .avatar { grid-column: 1 / -1; grid-row: 2; place-self: center; height: 100%; max-height: 80px; width: auto; aspect-ratio: 1; min-height: 28px; }
  .etiqueta-nombre { grid-column: 1; grid-row: 3; justify-self: start; align-self: end; max-width: 100%; min-width: 0; display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px;
    border-radius: var(--radio-pildora); font-size: 13px; background: rgb(8 9 13 / .75); }
  .nombre { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mic { color: var(--tenue); display: grid; }
  .chips-vivo { grid-column: 1 / -1; grid-row: 1; display: flex; gap: 6px; }
  .vivo, .espectadores { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: var(--radio); font-size: 11.5px; font-weight: 750; }
  .vivo { color: #07210F; background: var(--ok); letter-spacing: .03em; }
  .punto-vivo { width: 6px; height: 6px; border-radius: 50%; background: #07210F; }
  :global([data-modo='moderno']) .punto-vivo { animation: latido 2s ease-in-out infinite; }
  @keyframes latido { 50% { opacity: .35; } }
  .espectadores { color: #fff; background: rgb(8 9 13 / .75); font-weight: 650; }
  .ver { grid-column: 2; grid-row: 3; align-self: end; min-height: 28px; height: 28px; padding: 0 12px; font-size: 13px; }
  /* Cada pantalla mide al menos 520 px de ancho (se distingue lo que muestra); si no entran, bajan a otra fila. */
  /* Las transmisiones ocupan el espacio libre (el centro es una columna flex): nada de scroll para ver la segunda. */
  .escenarios { flex: 1 0 280px; min-height: 0; display: grid; gap: 8px; grid-template-columns: 1fr; grid-auto-rows: minmax(0, 1fr); }
  .escenarios[data-n='2'] { grid-template-columns: 1fr 1fr; }
  .escenarios[data-n='3'], .escenarios[data-n='4'] { grid-template-columns: 1fr 1fr; }
  .escenarios[data-n='5'] { grid-template-columns: repeat(3, 1fr); }
  .voz.movil .escenarios { grid-template-columns: 1fr; }
  .escenarios.completa { position: fixed; inset: 0; z-index: 100; padding: 4px; gap: 4px; background: #000; }
  /* Pegada abajo, justo arriba del dock, aunque haya pocas tarjetas o muchas (sticky al scrollear). */
  .pie-musica { margin-top: auto; position: sticky; bottom: 0; }
  .pie-musica:empty { display: none; }
  .pie-musica :global(.titulo) { flex: 1; max-width: none; }
  .propia { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .propia :global(.previa) { width: 240px; max-width: 100%; aspect-ratio: 16 / 9; background: var(--hondo); border-radius: var(--radio); }
  .chatSala { position: relative; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--borde); background: var(--fondo); }
  .chatSala :global(.chat) { flex: 1; }
  .chatSala :global(.titulo) { padding-right: 52px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--tenue); }
  /* Chat compacto: avatar de 28 y texto de 13,5. */
  .chatSala :global(.msg) { font-size: 13.5px; gap: 10px; padding: 4px 8px; margin-inline: 4px; }
  .chatSala :global(.msg > .avatar) { width: 28px; height: 28px; }
  .chatSala :global(.hora-lado) { width: 28px; }
  .chatSala :global(.composer) { margin: 8px; }
  .plegar { position: absolute; top: 8px; right: 8px; z-index: 1; }
</style>
