<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { sesion } from '../sesion.svelte';
  import { amigos, solicitarPorUsuario, quitar } from '../amigos.svelte';
  import { noLeidos, abrirPrivado, enviarPrivado, borrarPrivado, marcarLeido } from '../privados.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';
  import Chat from './Chat.svelte';
  import Confirmar from './Confirmar.svelte';
  import { UserPlus } from '@lucide/svelte';
  import { estado } from '../presencia.svelte';

  // Panel fijo a la derecha de la portada. Solo se muestra el estado elegido, nunca en qué grupo o sala está.
  let agregando = $state(false);
  const TEXTOS = { disponible: 'Disponible', ausente: 'Ausente', ocupado: 'Ocupado', desconectado: 'Desconectado' };
  const enLineaYa = $derived(amigos.lista.filter((a) => estado(a.usuario) !== 'desconectado'));
  const desconectados = $derived(amigos.lista.filter((a) => estado(a.usuario) === 'desconectado'));

  let usuario = $state('');
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
    error = await solicitarPorUsuario(usuario);
    if (!error) { ok = `Le mandaste una solicitud a ${usuario.trim()}.`; usuario = ''; }
  }
  function abrir(u: RecordModel) { abierto = u; queueMicrotask(() => d?.showModal()); }
</script>

{#snippet lista(titulo: string, gente: typeof amigos.lista)}
  {#if gente.length}
    <h3>{titulo} — {gente.length}</h3>
    <ul>
      {#each gente as a (a.amistad)}
        {@const e = estado(a.usuario)}
        <li class:apagado={e === 'desconectado'}><button class="plano amigo" onclick={() => abrir(a.usuario)}>
          <Avatar usuario={a.usuario} tam={32} />
          <span class="texto"><span class="nombre">{a.usuario.name}<Insignia usuario={a.usuario} /></span><small>{TEXTOS[e]}</small></span>
          {#if noLeidos[a.usuario.id]}<span class="contador num" aria-label="{noLeidos[a.usuario.id]} sin leer">{noLeidos[a.usuario.id]}</span>{/if}
        </button></li>
      {/each}
    </ul>
  {/if}
{/snippet}

<aside class="amigos">
  <div class="cabecera"><h2>Amigos</h2>
    <button onclick={() => (agregando = !agregando)}><UserPlus size={16} strokeWidth={1.75} /> Agregar amigo</button>
  </div>
  <div class="cuerpo">
  {#if agregando}<form class="fila" onsubmit={agregar}>
    <input bind:value={usuario} required maxlength="20" placeholder="Usuario exacto" aria-label="Usuario del amigo" />
    <button type="submit">Agregar</button>
  </form>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  {#if ok}<p role="status">{ok}</p>{/if}
  {@render lista('En línea', enLineaYa)}
  {@render lista('Desconectados', desconectados)}
  {#if amigos.cargado && !amigos.lista.length}<p class="vacio">Todavía no tenés amigos. Agregalos por su usuario para hablarles por privado.</p>{/if}
  </div>
</aside>

<dialog class="privado" bind:this={d} onclose={() => (abierto = null)}>
  {#if abierto}
    {@const u = abierto}
    {#key u.id}
      <Chat titulo={u.name} miembros={[sesion.usuario, u].filter((x) => !!x).map((x) => ({ id: x.id, name: x.name }))} abrir={() => abrirPrivado(u.id)} enviar={(t, f, r) => enviarPrivado(u.id, t, f, r)} borrar={borrarPrivado}
        puedeBorrar={(m) => m.author === sesion.usuario?.id} alVer={(m) => marcarLeido(u.id, m.created)}
        soloLectura={amistad ? '' : 'Ya no son amigos: no se pueden mandar mensajes.'} silencio={u.id}>
        {#snippet acciones(cerrar: () => void)}
          {#if amistad}<button class="plano peligro" onclick={() => { cerrar(); eliminar = true; }}>Eliminar amigo</button>{/if}
        {/snippet}
      </Chat>
    {/key}
    <div class="fila pie">
      <button class="plano" onclick={() => d?.close()}>Cerrar</button>
    </div>
  {/if}
</dialog>

{#if eliminar && amistad && abierto}
  <Confirmar texto={`¿Eliminar a ${abierto.name} de tus amigos? El historial queda, pero no van a poder escribirse.`}
    cancelar={() => (eliminar = false)} confirmar={() => { eliminar = false; void quitar(amistad.amistad); }} />
{/if}

<style>
  .amigos { display: flex; flex-direction: column; min-height: 0; background: var(--panel); border-left: 1px solid var(--borde); --anillo: var(--panel); }
  .cabecera { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 52px; padding: 0 12px 0 16px; flex: none; border-bottom: 1px solid var(--borde); }
  .cabecera h2 { font-size: 15px; font-weight: 700; letter-spacing: 0; }
  .cuerpo { flex: 1; overflow-y: auto; padding: 4px 8px 16px; }
  h3 { margin: 16px 8px 4px; }
  ul { display: flex; flex-direction: column; gap: 2px; }
  .amigo { width: 100%; min-height: 48px; justify-content: flex-start; gap: 12px; padding: 6px 8px; text-align: left; color: var(--texto); border-radius: var(--radio-menu); }
  .texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .texto small { font-size: 12px; color: var(--tenue); }
  .apagado :global(.caja) { opacity: .55; }
  .apagado .nombre { color: var(--tenue); }
  .contador { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--acento); color: var(--sobre-acento); font-size: 11px; font-weight: 650; display: grid; place-items: center; }
  .vacio { margin: 16px 8px; color: var(--tenue); font-size: 13px; }
  form { margin: 12px 8px 0; flex-wrap: nowrap; }
  form input { flex: 1; min-width: 0; }
  [role='alert'], [role='status'] { margin: 8px; font-size: 13px; }
  .privado { width: min(640px, 90vw); height: 80vh; max-width: none; padding: 0; flex-direction: column; }
  .privado[open] { display: flex; }
  .privado :global(.chat) { flex: 1; }
  .pie { justify-content: flex-end; padding: 0 16px 12px; }
</style>
