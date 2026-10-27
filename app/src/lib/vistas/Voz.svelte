<script lang="ts">
  import { lleno } from '../rango';
  import Insignia from './Insignia.svelte';
  import type { RecordModel } from 'pocketbase';
  import { MicOff, Users, ChevronRight, MessageSquare, Eye, EyeOff, Volume2, Menu, ChevronLeft } from '@lucide/svelte';
  import { pantalla } from '../plataforma.svelte';
  import { mantener } from '../mantener';
  import { navMovil, cerrarCapa } from '../navMovil.svelte';
  import { foto } from '../foto';
  import { mensajeError, sesion } from '../sesion.svelte';
  import { grupos } from '../grupos.svelte';
  import { abrirChat, enviar, borrar } from '../chat.svelte';
  import AhoraSuena from './AhoraSuena.svelte';
  import Chat from './Chat.svelte';
  import { voz, volumen, silenciar, desconectar, moverA, bloquearVoz, ver, pistaPantallaPropia, vistaPrevia } from '../voz.svelte';
  import Pantalla from './Pantalla.svelte';
  import { completa } from '../pantallaCompleta.svelte';
  import Video from './Video.svelte';
  import { leerPrefs } from '../prefs';
  import { abrirEnPunto } from '../menu';
  import { mirar as mirarSala } from '../noLeidos.svelte';

  let { grupo, soyDueno, sala, salasVoz = [], abrirSalas, volver }: { grupo: RecordModel; soyDueno: boolean; sala: string; salasVoz?: RecordModel[]; abrirSalas?: () => void; volver?: () => void } = $props();
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  const miembro = (id: string) => miembros.find((m) => m.id === id);
  // Silencios recién pedidos, hasta que el grupo se refresque con el valor del servidor.
  let pedidos = $state<Record<string, boolean>>({});
  const silenciado = (id: string) => pedidos[id] ?? ((grupo.silenciados ?? []) as string[]).includes(id);
  let vols = $state<Record<string, number>>({ ...leerPrefs().volumenes });
  let error = $state('');

  async function alternar(id: string) {
    menu?.hidePopover();
    error = '';
    const nuevo = !silenciado(id);
    try { await silenciar(grupo.id, id, nuevo); pedidos[id] = nuevo; } catch (e) { error = mensajeError(e); }
  }
  async function moderar(f: () => Promise<void>) {
    menu?.hidePopover();
    error = '';
    try { await f(); } catch (e) { error = mensajeError(e); }
  }


  // Vista previa propia; se recalcula cuando cambian los participantes (llega o se va la pista).
  const propia = $derived((void voz.participantes, voz.transmitiendo && voz.vistaPrevia ? pistaPantallaPropia() : undefined));

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
  // Celular: el navegador puede cortar el audio con la pantalla bloqueada; se avisa una vez por sesión.
  const esIphone = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  let avisoLlamada = $state(pantalla.movil && (() => { try { return !sessionStorage.getItem('dm.avisoLlamada'); } catch { return true; } })());
  function entendido() { avisoLlamada = false; try { sessionStorage.setItem('dm.avisoLlamada', '1'); } catch { /* sin almacenamiento: dura esta vista */ } }
  let ocultarGente = $state(false); // mientras se mira una transmisión, las tarjetas de la gente se pueden esconder
  // En el celular el chat de la sala se abre a pantalla completa desde el dock (navMovil.chatSala).
  const verChat = $derived(pantalla.movil ? navMovil.chatSala : chatAbierto);
  function plegarChat(a: boolean) { chatAbierto = a; try { localStorage.setItem('dm.chatSala', a ? '1' : '0'); } catch { /* sin almacenamiento */ } }
</script>

{#snippet espectadores(n: number)}
  <span class="espectadores num" title={`${n} ${n === 1 ? 'persona mirando' : 'personas mirando'}`}><Eye size={14} strokeWidth={1.75} />{n}</span>
{/snippet}

<section class="voz" class:conChat={chatAbierto && !pantalla.movil} class:movil={pantalla.movil}>
  <div class="centro">
    <header>
      {#if volver}<button class="icono" aria-label="Volver" title="Volver" onclick={volver}><ChevronLeft size={22} strokeWidth={1.75} /></button>{/if}
      {#if abrirSalas}<button class="icono" aria-label="Abrir salas" title="Salas" onclick={abrirSalas}><Menu size={20} strokeWidth={1.75} /></button>{/if}
      <Volume2 size={18} strokeWidth={1.75} color="var(--icono)" />
      <h2>{sala}</h2>
      <span class="en-voz num">{voz.participantes.length} en voz</span>
      {#if voz.viendo.length}<button class="plano" onclick={() => (ocultarGente = !ocultarGente)}>{#if ocultarGente}<Eye size={16} strokeWidth={1.75} /> Mostrar participantes{:else}<EyeOff size={16} strokeWidth={1.75} /> Ocultar participantes{/if}</button>{/if}
      <!-- popovertarget: abre y cierra con el mismo botón (con onclick, el clic la cerraba y la volvía a abrir) -->
      <button class="plano" popovertarget="capa-participantes"><Users size={16} strokeWidth={1.75} /> Participantes · {miembros.length}</button>
      {#if !chatAbierto && !pantalla.movil}<button class="icono" onclick={() => plegarChat(true)} aria-label="Abrir chat de la sala" title="Chat de la sala"><MessageSquare size={16} strokeWidth={1.75} /></button>{/if}
    </header>
    {#if avisoLlamada}<p class="aviso-celular">{esIphone ? 'En iPhone, la llamada se corta si bloqueás la pantalla o cambiás de app.' : 'Si bloqueás la pantalla o cambiás de app, la llamada puede cortarse.'}
      <button class="plano" onclick={entendido}>Entendido</button></p>{/if}
    {#if voz.conectando}<p role="status">Conectando…</p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}

    {#if voz.viendo.length}
      <!-- Una sola: grande. Varias: lado a lado si entran a un tamaño que se distinga, si no una abajo de la otra. -->
      <!-- Todas las que se miran entran en el espacio que hay, sin scroll: 1 = entera, 2 = mitad y mitad, 3-4 = de a dos. -->
      <div class="escenarios" class:completa={completa.sid === 'todas'} data-n={Math.min(voz.viendo.length, 5)}>
        {#each voz.viendo as sid (sid)}<Pantalla {sid} />{/each}
      </div>
    {/if}
    <ul class="franja" class:oculta={ocultarGente && voz.viendo.length > 0}>
      {#each voz.participantes as p, i (p.id)}
        {@const m = miembro(p.id)}
        <li style:--i={Math.min(i, 5)} class:hablando={p.hablando} class:transmite={p.transmite} style="background:{fondo(m?.color, p.nombre)};--habla:{m?.color || 'var(--acento)'}" oncontextmenu={(e) => abrirMenu(e, p)} use:mantener={(x, y) => abrirMenu({ clientX: x, clientY: y, preventDefault() {} } as MouseEvent, p)}>
          {#if p.transmite}<span class="chips-vivo"><span class="vivo"><span class="punto-vivo"></span>EN VIVO</span>{@render espectadores(p.espectadores)}</span>{/if}
          <img class="avatar" alt="" src={foto(m, '256x256')} />
          {#if p.transmite && !p.local && p.pantalla}{@const sid = p.pantalla}{@const viendo = voz.viendo.includes(sid)}
            <button class="primario ver" aria-pressed={viendo} onclick={() => ver(sid, !viendo)}>{viendo ? 'Dejar de ver' : 'Ver'}</button>{/if}
          <span class="etiqueta-nombre">
            {#if p.silenciado}<span class="mic" title="Sin micrófono" aria-label="Silenciado"><MicOff size={16} strokeWidth={1.75} /></span>{/if}
            <span class="nombre">{p.nombre}{p.local ? ' (vos)' : ''}</span><Insignia usuario={m} />
          </span>
        </li>
      {/each}
    </ul>
    {#if voz.transmitiendo}<div class="propia">
      {#if voz.vistaPrevia}
        {#if propia}<Video pista={propia} clase="previa" etiqueta="Vista previa de tu transmisión" />{/if}
        <button class="plano" onclick={() => vistaPrevia(false)}>Ocultar vista previa</button>
      {:else}<button class="plano" onclick={() => vistaPrevia(true)}>Mostrar vista previa</button>{/if}
    </div>{/if}

    <div class="pie-musica"><AhoraSuena /></div>
  </div>

  {#if verChat && voz.salaId}
    {@const id = voz.salaId}
    <aside class="chatSala">
      {#if !pantalla.movil}<button class="icono plegar" onclick={() => plegarChat(false)} aria-label="Plegar chat de la sala" title="Plegar"><ChevronRight size={16} strokeWidth={1.75} /></button>{/if}
      {#key id}<Chat titulo="Chat de la sala" cerrar={pantalla.movil ? cerrarCapa : undefined} miembros={grupos.lista.find((g) => g.id === voz.grupoId)?.expand?.members ?? []} abrir={() => abrirChat(id)} enviar={(t, f, r) => enviar(id, t, f, r)} {borrar} silencio={id}
        puedeBorrar={(m) => m.author === sesion.usuario?.id || soyDueno} />{/key}
    </aside>
  {/if}
</section>

<div popover bind:this={menu} class="menu">
  {#if elegido}
    {@const p = elegido}
    <label>Volumen · {Math.round((vols[p.id] ?? 1) * 100)} %
      <input type="range" min="0" max="200" step="5" value={Math.round((vols[p.id] ?? 1) * 100)} style={lleno((vols[p.id] ?? 1) * 100, 0, 200)}
        aria-label={`Volumen de ${p.nombre}`} oninput={(e) => cambiar(p.id, +e.currentTarget.value)} />
    </label>
    {#if soyDueno}<hr /><button class="plano peligro" onclick={() => alternar(p.id)}>{silenciado(p.id) ? 'Quitar silencio' : 'Silenciar'}</button>
      {#each salasVoz.filter((s) => s.id !== voz.salaId) as s (s.id)}
        <button class="plano" onclick={() => moderar(() => moverA(grupo.id, p.id, s.id))}>Mover a {s.name}</button>
      {/each}
      <button class="plano peligro" onclick={() => moderar(() => desconectar(grupo.id, p.id))}>Desconectar de la llamada</button>
      <button class="plano peligro" onclick={() => moderar(() => bloquearVoz(grupo.id, p.id, true))}>Desconectar y no dejar volver</button>{/if}
  {/if}
</div>

<style>
  .voz { display: grid; grid-template-columns: 1fr; min-height: 0; min-width: 0; }
  .voz.conChat { grid-template-columns: minmax(0, 1fr) 296px; }
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
  .menu { position: fixed; inset: auto; margin: 0; padding: 8px; min-width: 220px; flex-direction: column; gap: 4px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); }
  .menu:popover-open { display: flex; }
  .menu input { padding: 0; background: none; border: 0; }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
  .menu button { justify-content: flex-start; }
  .menu button:not(.peligro) { color: var(--texto); }
</style>
