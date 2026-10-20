<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { MicOff } from '@lucide/svelte';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { echar, salirDe, enVoz } from '../grupos.svelte';
  import { voz } from '../voz.svelte';
  import { enLinea } from '../presencia.svelte';
  import { amigos, solicitarA } from '../amigos.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';
  import Confirmar from './Confirmar.svelte';

  let { grupo }: { grupo: RecordModel } = $props();
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  // Conectados arriba; el orden de cada mitad es el del grupo.
  const ordenados = $derived([...miembros.filter((m) => enLinea(m)), ...miembros.filter((m) => !enLinea(m))]);
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  let aEchar = $state<RecordModel | null>(null);
  let error = $state('');
  let menu = $state<HTMLElement>();
  let elegido = $state<RecordModel | null>(null);
  let pos = $state({ x: 0, y: 0 });

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
    pos = { x: e.clientX, y: e.clientY };
    menu?.showPopover();
  }
  async function hacer(f: () => Promise<unknown>) {
    menu?.hidePopover();
    error = '';
    try { const r = await f(); if (typeof r === 'string') error = r; } catch (e) { error = mensajeError(e); }
  }
</script>

<aside class="participantes">
  <h3>Participantes — {miembros.length}</h3>
  <ul>
    {#each ordenados as m (m.id)}
      <li class:apagado={!enLinea(m)} oncontextmenu={(e) => abrirMenu(e, m)}>
        <Avatar usuario={m} />
        <div class="quien">
          <strong style="color:{m.color || 'inherit'}">{m.name}{m.id === grupo.owner ? ' 👑' : ''}<Insignia usuario={m} /></strong>
          {#if m.status}<small>{m.status}</small>{/if}
        </div>
        {#if micApagado(m.id)}<span class="mic" aria-label="Micrófono apagado" title="Micrófono apagado"><MicOff size={16} strokeWidth={1.75} /></span>{/if}
      </li>
    {/each}
  </ul>
  {#if !soyDueno}<button class="plano" onclick={() => hacer(() => salirDe(grupo.id))}>Salir del grupo</button>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
</aside>

<!-- Menú del clic derecho (popover nativo: se cierra con Esc o tocando afuera). -->
<div popover bind:this={menu} style="left:{pos.x}px;top:{pos.y}px">
  {#if elegido}
    {@const m = elegido}
    {#if puedoAgregar(m.id)}<button class="plano" onclick={() => hacer(() => solicitarA(m.id))}>Agregar amigo</button>{/if}
    {#if puedoEchar(m.id)}<button class="plano peligro" onclick={() => { menu?.hidePopover(); aEchar = m; }}>Echar</button>{/if}
    {#if !puedoAgregar(m.id) && !puedoEchar(m.id)}<span class="tenue">Sin acciones</span>{/if}
  {/if}
</div>

{#if aEchar}
  <Confirmar texto={`¿Echar a ${aEchar.name}?`} cancelar={() => (aEchar = null)}
    confirmar={() => { const m = aEchar!; aEchar = null; hacer(() => echar(grupo.id, m.id)); }} />
{/if}

<style>
  .participantes { background: var(--panel); padding: 0 8px 12px; overflow-y: auto; }
  li { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: var(--radio); }
  li:hover { background: var(--hover); }
  .apagado { opacity: .5; }
  .quien { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .quien > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mic { color: var(--tenue); display: grid; }
  [popover] { position: fixed; inset: auto; margin: 0; padding: 6px; flex-direction: column; gap: 2px;
    background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 10px; }
  [popover]:popover-open { display: flex; }
  [popover] button { text-align: left; }
  .tenue { color: var(--tenue); padding: 4px 8px; }
</style>
