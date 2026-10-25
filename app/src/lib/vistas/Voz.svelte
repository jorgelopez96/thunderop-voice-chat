<script lang="ts">
  import { lleno } from '../rango';
  import Insignia from './Insignia.svelte';
  import type { RecordModel } from 'pocketbase';
  import { MicOff, Users, Link, ChevronRight, MessageSquare, Eye, Volume2 } from '@lucide/svelte';
  import { foto } from '../foto';
  import { mensajeError, sesion } from '../sesion.svelte';
  import { crearInvitacion, grupos } from '../grupos.svelte';
  import { abrirChat, enviar, borrar } from '../chat.svelte';
  import AhoraSuena from './AhoraSuena.svelte';
  import Chat from './Chat.svelte';
  import { voz, volumen, silenciar, desconectar, moverA, bloquearVoz, ver, pistaPantallaPropia, vistaPrevia } from '../voz.svelte';
  import Pantalla from './Pantalla.svelte';
  import Video from './Video.svelte';
  import { leerPrefs } from '../prefs';
  import { abrirEnPunto } from '../menu';
  import { mirar as mirarSala } from '../noLeidos.svelte';

  let { grupo, soyDueno, sala, verParticipantes, salasVoz = [] }: { grupo: RecordModel; soyDueno: boolean; sala: string; verParticipantes: () => void; salasVoz?: RecordModel[] } = $props();
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
  async function moderar(f: () => Promise<void>) {
    menu?.hidePopover();
    error = '';
    try { await f(); } catch (e) { error = mensajeError(e); }
  }
  async function copiarLink() {
    error = '';
    try {
      const link = await crearInvitacion(grupo.id);
      await navigator.clipboard.writeText(link).then(() => (aviso = 'Link de invitación copiado.'), () => (aviso = link));
    } catch (e) { error = mensajeError(e); }
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
  function plegarChat(a: boolean) { chatAbierto = a; try { localStorage.setItem('dm.chatSala', a ? '1' : '0'); } catch { /* sin almacenamiento */ } }
</script>

{#snippet espectadores(n: number)}
  <span class="espectadores num" title={`${n} ${n === 1 ? 'persona mirando' : 'personas mirando'}`}><Eye size={14} strokeWidth={1.75} />{n}</span>
{/snippet}

<section class="voz" class:conChat={chatAbierto}>
  <div class="centro">
    <header>
      <Volume2 size={18} strokeWidth={1.75} color="var(--icono)" />
      <h2>{sala}</h2>
      <span class="en-voz num">{voz.participantes.length} en voz</span>
      <button class="plano" onclick={verParticipantes}><Users size={16} strokeWidth={1.75} /> Participantes · {miembros.length}</button>
      <button class="icono" onclick={copiarLink} aria-label="Copiar link de invitación" title="Copiar link de invitación"><Link size={16} strokeWidth={1.75} /></button>
      {#if !chatAbierto}<button class="icono" onclick={() => plegarChat(true)} aria-label="Abrir chat de la sala" title="Chat de la sala"><MessageSquare size={16} strokeWidth={1.75} /></button>{/if}
    </header>
    {#if voz.conectando}<p role="status">Conectando…</p>{/if}
    {#if aviso}<p role="status">{aviso}</p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}

    {#if voz.viendo.length}
      <!-- Una sola: grande. Varias: lado a lado si entran a un tamaño que se distinga, si no una abajo de la otra. -->
      <div class="escenarios" class:varias={voz.viendo.length > 1}>
        {#each voz.viendo as sid (sid)}<Pantalla {sid} />{/each}
      </div>
    {/if}
    <ul class="franja">
      {#each voz.participantes as p, i (p.id)}
        {@const m = miembro(p.id)}
        <li style:--i={Math.min(i, 5)} class:hablando={p.hablando} class:transmite={p.transmite} style="background:{fondo(m?.color, p.nombre)}" oncontextmenu={(e) => abrirMenu(e, p)}>
          <img class="avatar" alt="" src={foto(m, '256x256')} />
          {#if p.transmite}<span class="chips-vivo"><span class="vivo"><span class="punto-vivo"></span>EN VIVO</span>{@render espectadores(p.espectadores)}</span>
            {#if !p.local && p.pantalla}{@const sid = p.pantalla}{@const viendo = voz.viendo.includes(sid)}
              <button class="primario ver" aria-pressed={viendo} onclick={() => ver(sid, !viendo)}>{viendo ? 'Dejar de ver' : 'Ver'}</button>{/if}{/if}
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

  {#if chatAbierto && voz.salaId}
    {@const id = voz.salaId}
    <aside class="chatSala">
      <button class="icono plegar" onclick={() => plegarChat(false)} aria-label="Plegar chat de la sala" title="Plegar"><ChevronRight size={16} strokeWidth={1.75} /></button>
      {#key id}<Chat titulo="Chat de la sala" miembros={grupos.lista.find((g) => g.id === voz.grupoId)?.expand?.members ?? []} abrir={() => abrirChat(id)} enviar={(t, f, r) => enviar(id, t, f, r)} {borrar} silencio={id}
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
  .centro { padding: 0 16px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 8px; height: 52px; flex: none; margin: 0 -16px; padding: 0 12px 0 16px;
    background: var(--fondo); border-bottom: 1px solid var(--borde); }
  h2 { font-size: 15px; font-weight: 650; letter-spacing: 0; }
  .en-voz { margin-right: auto; padding: 2px 8px; border-radius: var(--radio-pildora); font-size: 12px; font-weight: 600; color: var(--ok); background: var(--ok-suave); }
  /* Una tarjeta por persona (como Discord); la pantalla que mirás va arriba, a todo el ancho. */
  .franja { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
  .franja li { position: relative; aspect-ratio: 16 / 9; display: grid; place-items: center; border: 2px solid var(--borde); border-radius: var(--radio-grande);
    overflow: hidden; transition: border-color var(--dur-media); }
  .franja li.hablando { border-color: color-mix(in srgb, var(--ok) 70%, transparent); }
  .franja li.transmite:not(.hablando) { border-color: color-mix(in srgb, var(--cian) 45%, transparent); }
  /* Modo moderno: al entrar a la llamada las tarjetas aparecen escalonadas (tope de 6). */
  :global([data-modo='moderno']) .franja li { animation: entra 240ms var(--curva-salida) backwards; animation-delay: calc(var(--i) * 40ms); }
  @keyframes entra { from { opacity: 0; transform: scale(.92); } }
  .franja .avatar { width: 80px; height: 80px; }
  .etiqueta-nombre { position: absolute; left: 8px; bottom: 8px; max-width: calc(100% - 16px); display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px;
    border-radius: var(--radio-pildora); font-size: 13px; background: rgb(8 9 13 / .75); }
  .nombre { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mic { color: var(--tenue); display: grid; }
  .chips-vivo { position: absolute; top: 8px; left: 8px; display: flex; gap: 6px; }
  .vivo, .espectadores { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: var(--radio); font-size: 11.5px; font-weight: 750; }
  .vivo { color: #07210F; background: var(--ok); letter-spacing: .03em; }
  .punto-vivo { width: 6px; height: 6px; border-radius: 50%; background: #07210F; }
  :global([data-modo='moderno']) .punto-vivo { animation: latido 2s ease-in-out infinite; }
  @keyframes latido { 50% { opacity: .35; } }
  .espectadores { color: #fff; background: rgb(8 9 13 / .75); font-weight: 650; }
  .ver { position: absolute; bottom: 8px; right: 8px; }
  /* Cada pantalla mide al menos 520 px de ancho (se distingue lo que muestra); si no entran, bajan a otra fila. */
  .escenarios { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr)); }
  .escenarios.varias { --alto: 46vh; }
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
  .menu button { justify-content: flex-start; color: var(--texto); }
</style>
