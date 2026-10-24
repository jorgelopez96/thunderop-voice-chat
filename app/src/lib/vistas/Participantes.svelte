<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { MicOff, HeadphoneOff, Monitor } from '@lucide/svelte';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { echar, banear, salirDe, enVoz } from '../grupos.svelte';
  import { voz, volumen, bloquearVoz } from '../voz.svelte';
  import { leerPrefs } from '../prefs';
  import { abrirEnPunto } from '../menu';
  import { enLinea } from '../presencia.svelte';
  import { amigos, solicitarA } from '../amigos.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';
  import Confirmar from './Confirmar.svelte';

  let { grupo }: { grupo: RecordModel } = $props();
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  // Conectados arriba; el orden de cada mitad es el del grupo.
  const secciones = $derived([miembros.filter((m) => enLinea(m)), miembros.filter((m) => !enLinea(m))].filter((l) => l.length));
  /** En mi sala de voz: si habla, si transmite. */
  const enMiSala = (id: string) => (voz.grupoId === grupo.id ? voz.participantes.find((p) => p.id === id) : undefined);
  let vol = $state(100);
  let perfil = $state<HTMLDialogElement>();
  let viendo = $state<RecordModel | null>(null);
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  let aEchar = $state<RecordModel | null>(null);
  let aBanear = $state<RecordModel | null>(null);
  let error = $state('');
  let menu = $state<HTMLElement>();
  let elegido = $state<RecordModel | null>(null);

  /** Micrófono apagado de quien está en voz en este grupo: mi sala por LiveKit, las otras por la presencia del servidor. */
  function micApagado(id: string): boolean {
    const mia = voz.grupoId === grupo.id ? voz.participantes.find((p) => p.id === id) : undefined;
    if (mia) return mia.silenciado;
    if (enVoz.grupo !== grupo.id) return false;
    return Object.values(enVoz.salas).some((s) => s.some((p) => p.id === id && p.silenciado));
  }
  /** Agregar amigo: no a uno mismo, ni a un amigo, ni con una solicitud en cualquier sentido. */
  const puedoAgregar = (id: string) => id !== sesion.usuario?.id
    && ![...amigos.lista.map((a) => a.usuario), ...amigos.recibidas.map((s) => s.usuario), ...amigos.enviadas.map((s) => s.usuario)].some((u) => u.id === id);
  const puedoEchar = (id: string) => soyDueno && id !== grupo.owner;

  function abrirMenu(e: MouseEvent, m: RecordModel) {
    e.preventDefault();
    elegido = m;
    vol = Math.round((leerPrefs().volumenes[m.id] ?? 1) * 100);
    void abrirEnPunto(menu, e.clientX, e.clientY);
  }
  async function hacer(f: () => Promise<unknown>) {
    menu?.hidePopover();
    error = '';
    try { const r = await f(); if (typeof r === 'string') error = r; } catch (e) { error = mensajeError(e); }
  }
</script>

<aside class="participantes">
  <h3>Participantes — {miembros.length}</h3>
  {#each secciones as lista, i (i)}
  <ul class:separada={i > 0}>
    {#each lista as m (m.id)}
      {@const p = enMiSala(m.id)}
      <li class:apagado={!enLinea(m)} oncontextmenu={(e) => abrirMenu(e, m)}>
        <Avatar usuario={m} hablando={p?.hablando} />
        <div class="quien">
          <strong>{m.name}<Insignia usuario={m} dueno={m.id === grupo.owner} /></strong>
          {#if m.status}<small>{m.status}</small>{/if}
        </div>
        <span class="estados">
          {#if micApagado(m.id)}<span aria-label="Micrófono apagado" title="Micrófono apagado"><MicOff size={16} strokeWidth={1.75} /></span>{/if}
          {#if p?.local && voz.ensordecido}<span aria-label="Sonido apagado" title="Sonido apagado"><HeadphoneOff size={16} strokeWidth={1.75} /></span>{/if}
          {#if p?.transmite}<span class="vivo" aria-label="Compartiendo pantalla" title="Compartiendo pantalla"><Monitor size={16} strokeWidth={1.75} /></span>{/if}
        </span>
      </li>
    {/each}
  </ul>
  {/each}
  {#if !soyDueno}<button class="plano" onclick={() => hacer(() => salirDe(grupo.id))}>Salir del grupo</button>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
</aside>

<!-- Menú del clic derecho (popover nativo: se cierra con Esc o tocando afuera). -->
<div popover bind:this={menu}>
  {#if elegido}
    {@const m = elegido}
    <button class="plano" onclick={() => { menu?.hidePopover(); viendo = m; perfil?.showModal(); }}>Ver perfil</button>
    {#if puedoAgregar(m.id)}<button class="plano" onclick={() => hacer(() => solicitarA(m.id))}>Agregar amigo</button>{/if}
    {#if m.id !== sesion.usuario?.id}
      <label class="vol">Volumen · {vol} %
        <input type="range" min="0" max="200" step="5" bind:value={vol} aria-label={`Volumen de ${m.name}`} oninput={() => volumen(m.id, vol / 100)} /></label>
    {/if}
    {#if puedoEchar(m.id) && ((grupo.bloqueados ?? []) as string[]).includes(m.id)}
      <hr /><button class="plano" onclick={() => { menu?.hidePopover(); hacer(() => bloquearVoz(grupo.id, m.id, false)); }}>Permitir volver a la voz</button>
    {/if}
    {#if puedoEchar(m.id)}<hr /><button class="plano peligro" onclick={() => { menu?.hidePopover(); aEchar = m; }}>Expulsar del grupo</button>
      <button class="plano peligro" onclick={() => { menu?.hidePopover(); aBanear = m; }}>Banear del grupo</button>{/if}
  {/if}
</div>

<dialog class="perfil" bind:this={perfil} onclose={() => (viendo = null)}>
  {#if viendo}
    <Avatar usuario={viendo} tam={72} />
    <h2>{viendo.name}<Insignia usuario={viendo} dueno={viendo.id === grupo.owner} /></h2>
    {#if viendo.status}<p class="tenue">{viendo.status}</p>{/if}
    <small>{enLinea(viendo) ? 'En línea' : 'Desconectado'}</small>
    <button onclick={() => perfil?.close()}>Cerrar</button>
  {/if}
</dialog>

{#if aBanear}
  <Confirmar texto={`¿Banear a ${aBanear.name}? Sale del grupo y no puede volver hasta que lo desbanees.`} cancelar={() => (aBanear = null)}
    confirmar={() => { const m = aBanear!; aBanear = null; hacer(() => banear(grupo.id, m.id, true)); }} />
{/if}
{#if aEchar}
  <Confirmar texto={`¿Expulsar a ${aEchar.name} del grupo?`} cancelar={() => (aEchar = null)}
    confirmar={() => { const m = aEchar!; aEchar = null; hacer(() => echar(grupo.id, m.id)); }} />
{/if}

<style>
  .participantes { background: var(--panel); padding: 8px 12px 16px; overflow-y: auto; border-left: 1px solid var(--borde); }
  .separada { border-top: 1px solid var(--borde); margin-top: 8px; padding-top: 8px; }
  li { display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 4px 8px; border-radius: var(--radio); }
  li:hover { background: var(--hover); }
  .apagado { opacity: .45; }
  .quien { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .quien > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .quien strong { font-weight: 500; }
  .quien small { font-size: 12px; }
  .estados { display: flex; gap: 4px; color: var(--peligro); }
  .estados span { display: grid; }
  .estados .vivo { color: var(--ok); }
  [popover] { position: fixed; inset: auto; margin: 0; padding: 8px; min-width: 220px; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde); border-radius: var(--radio-menu); }
  [popover]:popover-open { display: flex; }
  [popover] button { justify-content: flex-start; }
  [popover] hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
  .vol { padding: 4px 8px; }
  .vol input { padding: 0; background: none; border: 0; }
  .perfil[open] { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 280px; text-align: center; }
  .perfil h2 { font-size: 20px; }
  .tenue { color: var(--tenue); margin: 0; }
</style>
