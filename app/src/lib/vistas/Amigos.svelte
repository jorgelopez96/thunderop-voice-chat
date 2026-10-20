<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { sesion } from '../sesion.svelte';
  import { amigos, solicitarPorNombre, quitar } from '../amigos.svelte';
  import { noLeidos, abrirPrivado, enviarPrivado, borrarPrivado, marcarLeido } from '../privados.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';
  import Chat from './Chat.svelte';
  import Confirmar from './Confirmar.svelte';
  import { UserPlus } from '@lucide/svelte';
  import { enLinea } from '../presencia.svelte';

  // `enVoz(id)`: nombre del grupo donde está en voz ese amigo (la portada lo sabe por la presencia).
  let { enVoz = () => undefined }: { enVoz?: (id: string) => string | undefined } = $props();
  let agregando = $state(false);

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

<section>
  <div class="titulo"><h3>Amigos</h3>
    {#if amigos.lista.length}<button onclick={() => (agregando = !agregando)}><UserPlus size={16} strokeWidth={1.75} /> Agregar amigo</button>{/if}
  </div>
  <ul>
    {#each amigos.lista as a (a.amistad)}
      {@const grupo = enVoz(a.usuario.id)}
      <li class:apagado={!enLinea(a.usuario)}><button class="plano amigo" onclick={() => abrir(a.usuario)}>
        <Avatar usuario={a.usuario} tam={28} />
        <span class="nombre">{a.usuario.name}<Insignia usuario={a.usuario} /></span>
        {#if noLeidos[a.usuario.id]}<span class="contador" aria-label="{noLeidos[a.usuario.id]} sin leer">{noLeidos[a.usuario.id]}</span>
        {:else if grupo}<small class="verde">En voz · {grupo}</small>{/if}
      </button></li>
    {:else}
      {#if amigos.cargado}<li class="vacio"><p>Todavía no tenés amigos. Agregalos por su nombre para hablarles por privado y ver cuándo están conectados.</p>
        {#if !agregando}<button onclick={() => (agregando = true)}><UserPlus size={16} strokeWidth={1.75} /> Agregar amigo</button>{/if}</li>{/if}
    {/each}
  </ul>
  {#if agregando}<form class="fila" onsubmit={agregar}>
    <input bind:value={nombre} required maxlength="32" placeholder="Nombre exacto" aria-label="Nombre del amigo" />
    <button type="submit">Agregar amigo</button>
  </form>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  {#if ok}<p role="status">{ok}</p>{/if}
</section>

<dialog class="privado" bind:this={d} onclose={() => (abierto = null)}>
  {#if abierto}
    {@const u = abierto}
    {#key u.id}
      <Chat titulo={u.name} abrir={() => abrirPrivado(u.id)} enviar={(t, f, r) => enviarPrivado(u.id, t, f, r)} borrar={borrarPrivado}
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
  .titulo { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; min-height: 32px; }
  .titulo h3 { margin: 0; }
  ul { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
  .apagado { opacity: .5; }
  .amigo { width: 100%; min-height: 44px; justify-content: flex-start; gap: 12px; text-align: left; color: var(--texto); }
  .nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  .verde { color: var(--ok); font-size: 12px; }
  .contador { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--acento); color: #fff; font-size: 11px; font-weight: 600; display: grid; place-items: center; }
  .vacio { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; color: var(--tenue); font-size: 13px; }
  .vacio p { margin: 0; }
  form input { flex: 1; }
  .privado { width: min(640px, 90vw); height: 80vh; max-width: none; padding: 0; flex-direction: column; }
  .privado[open] { display: flex; }
  .privado :global(.chat) { flex: 1; }
  .pie { justify-content: flex-end; padding: 0 16px 12px; }
</style>
