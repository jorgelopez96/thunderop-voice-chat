<script lang="ts">
  import { sesion } from '../sesion.svelte';
  import { amigos, quitar, bloquear } from '../amigos.svelte';
  import { privado, abrirPrivado, enviarPrivado, borrarPrivado, marcarLeido } from '../privados.svelte';
  import Chat from './Chat.svelte';
  import Confirmar from './Confirmar.svelte';
  import { Ban, UserMinus } from '@lucide/svelte';
  import { foto } from '../foto';

  // Modal del chat privado con `privado.con`; se monta una vez en Principal.
  let eliminar = $state(false);
  let bloqueando = $state(false);
  let d = $state<HTMLDialogElement>();
  // La amistad puede desaparecer con el chat abierto (el otro la eliminó): el historial queda en solo lectura.
  const amistad = $derived(privado.con ? amigos.lista.find((a) => a.usuario.id === privado.con!.id) : undefined);
  $effect(() => { if (privado.con && !d?.open) d?.showModal(); });
</script>

<dialog class="privado" bind:this={d} onclose={() => (privado.con = null)} onclick={(e) => e.target === d && d.close()}>
  {#if privado.con}
    {@const u = privado.con}
    {#key u.id}
      <Chat titulo={u.name} foto={foto(u)} cerrar={() => d?.close()} miembros={[sesion.usuario, u].filter((x) => !!x)} abrir={() => abrirPrivado(u.id)} enviar={(t, f, r) => enviarPrivado(u.id, t, f, r)} borrar={borrarPrivado}
        puedeBorrar={(m) => m.author === sesion.usuario?.id} alVer={(m) => marcarLeido(u.id, m.created)}
        soloLectura={amistad ? '' : 'Ya no son amigos: no se pueden mandar mensajes.'} silencio={u.id}>
        {#snippet acciones(cerrar: () => void)}
          <button class="plano" onclick={() => { cerrar(); bloqueando = true; }}><Ban size={16} strokeWidth={1.75} /> Bloquear</button>
          {#if amistad}<button class="plano peligro" onclick={() => { cerrar(); eliminar = true; }}><UserMinus size={16} strokeWidth={1.75} /> Eliminar amigo</button>{/if}
        {/snippet}
      </Chat>
    {/key}
  {/if}
</dialog>

{#if bloqueando && privado.con}{@const u = privado.con}
  <Confirmar texto={`¿Bloquear a ${u.name}? Deja de ser tu amigo, no puede escribirte ni mandarte solicitudes y no ve si estás conectado. Lo podés desbloquear desde Configuración → Cuenta.`}
    accion="Bloquear" cancelar={() => (bloqueando = false)} confirmar={() => { bloqueando = false; d?.close(); void bloquear(u.id); }} />
{/if}
{#if eliminar && amistad && privado.con}
  <Confirmar texto={`¿Eliminar a ${privado.con.name} de tus amigos? El historial queda, pero no van a poder escribirse.`}
    cancelar={() => (eliminar = false)} confirmar={() => { eliminar = false; void quitar(amistad.amistad); }} />
{/if}

<style>
  .privado { width: min(640px, 90vw); height: 80vh; max-width: none; padding: 0; flex-direction: column; }
  .privado[open] { display: flex; }
  .privado :global(.chat) { flex: 1; }
</style>
