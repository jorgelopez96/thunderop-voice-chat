<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { sesion } from '../sesion.svelte';
  import { amigos, solicitarPorNombre, quitar } from '../amigos.svelte';
  import { noLeidos, abrirPrivado, enviarPrivado, borrarPrivado, marcarLeido } from '../privados.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';
  import Chat from './Chat.svelte';
  import Confirmar from './Confirmar.svelte';

  let nombre = $state('');
  let error = $state('');
  let ok = $state('');
  let abierto = $state<RecordModel | null>(null);
  let eliminar = $state(false);
  let d = $state<HTMLDialogElement>();
  // La amistad puede desaparecer con el chat abierto (el otro la eliminó): el historial queda en solo lectura.
  const amistad = $derived(abierto ? amigos.lista.find((a) => a.usuario.id === abierto!.id) : undefined);

  async function agregar(e: SubmitEvent) {
    e.preventDefault();
    ok = '';
    error = await solicitarPorNombre(nombre);
    if (!error) { ok = `Le mandaste una solicitud a ${nombre.trim()}.`; nombre = ''; }
  }
  function abrir(u: RecordModel) { abierto = u; queueMicrotask(() => d?.showModal()); }
</script>

<section class="tarjeta">
  <h3>Amigos</h3>
  <ul>
    {#each amigos.lista as a (a.amistad)}
      <li><button class="plano amigo" onclick={() => abrir(a.usuario)}>
        <Avatar usuario={a.usuario} tam={28} />
        <span class="nombre" style="color:{a.usuario.color || 'inherit'}">{a.usuario.name}<Insignia usuario={a.usuario} /></span>
        {#if noLeidos[a.usuario.id]}<span class="contador" aria-label="{noLeidos[a.usuario.id]} sin leer">{noLeidos[a.usuario.id]}</span>{/if}
      </button></li>
    {:else}
      {#if amigos.cargado}<li class="tenue">Todavía no tenés amigos agregados.</li>{/if}
    {/each}
  </ul>
  <form class="fila" onsubmit={agregar}>
    <input bind:value={nombre} required maxlength="32" placeholder="Nombre exacto" aria-label="Nombre del amigo" />
    <button type="submit">Agregar amigo</button>
  </form>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if ok}<p role="status">{ok}</p>{/if}
</section>

<dialog class="privado" bind:this={d} onclose={() => (abierto = null)}>
  {#if abierto}
    {@const u = abierto}
    {#key u.id}
      <Chat titulo={u.name} abrir={() => abrirPrivado(u.id)} enviar={(t, f) => enviarPrivado(u.id, t, f)} borrar={borrarPrivado}
        puedeBorrar={(m) => m.author === sesion.usuario?.id} alVer={(m) => marcarLeido(u.id, m.created)}
        soloLectura={amistad ? '' : 'Ya no son amigos: no se pueden mandar mensajes.'} />
    {/key}
    <div class="fila pie">
      {#if amistad}<button class="plano peligro" onclick={() => (eliminar = true)}>Eliminar amigo</button>{/if}
      <button class="plano" onclick={() => d?.close()}>Cerrar</button>
    </div>
  {/if}
</dialog>

{#if eliminar && amistad && abierto}
  <Confirmar texto={`¿Eliminar a ${abierto.name} de tus amigos? El historial queda, pero no van a poder escribirse.`}
    cancelar={() => (eliminar = false)} confirmar={() => { eliminar = false; void quitar(amistad.amistad); }} />
{/if}

<style>
  h3 { margin: 0 0 8px; font-size: 15px; }
  ul { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
  .amigo { width: 100%; display: flex; align-items: center; gap: 8px; text-align: left; }
  .nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .contador { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--acento); color: #fff; font-size: 11px; line-height: 18px; text-align: center; }
  .tenue { color: var(--tenue); }
  form input { flex: 1; }
  .privado { width: min(640px, 90vw); height: 80vh; max-width: none; padding: 0; flex-direction: column; }
  .privado[open] { display: flex; }
  .privado :global(.chat) { flex: 1; }
  .pie { justify-content: flex-end; padding: 0 16px 12px; }
</style>
