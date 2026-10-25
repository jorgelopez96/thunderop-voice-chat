<script lang="ts">
  import { Bell, RefreshCw } from '@lucide/svelte';
  import { amigos, aceptar, quitar } from '../amigos.svelte';
  import { actualizacion, reiniciarParaActualizar } from '../actualizacion.svelte';
  import { avisos, borrarAvisos, marcarAvisosLeidos } from '../notificaciones.svelte';
  import { horaDe } from '../hora.svelte';
  import { voz } from '../voz.svelte';
  import Avatar from './Avatar.svelte';
  import Confirmar from './Confirmar.svelte';
  import Insignia from './Insignia.svelte';

  let error = $state('');
  let preguntar = $state(false);
  const n = $derived(amigos.recibidas.length + (actualizacion.pendiente ? 1 : 0) + avisos.lista.filter((a) => !a.leido).length);
  const nada = $derived(!actualizacion.pendiente && !amigos.recibidas.length && !avisos.lista.length);
  async function reiniciar() {
    preguntar = false;
    try { await reiniciarParaActualizar(); } catch (e) { console.error(e); error = 'No se pudo instalar la actualización. Probá de nuevo más tarde.'; }
  }
  const hacer = async (f: Promise<string>) => { error = await f; };
</script>

<button class="plano icono" popovertarget="campanita" aria-label={n ? `Notificaciones: ${n}` : 'Notificaciones'} title="Notificaciones">
  <!-- El #key vuelve a montar la campana cuando cambia el número: en modo moderno se balancea al llegar algo. -->
  {#key n}<span class="campana"><Bell size={20} strokeWidth={1.75} /></span>{/key}
  {#if n}<span class="contador num">{n}</span>{/if}
</button>
<!-- Lo nuevo queda resaltado mientras está abierta; al cerrarla pasa a leído. -->
<div id="campanita" popover ontoggle={(e) => { if (e.newState === 'closed') marcarAvisosLeidos(); }}>
  <div class="cabecera"><h3>Notificaciones</h3>
    {#if avisos.lista.length}<button class="plano" onclick={borrarAvisos}>Borrar todas</button>{/if}</div>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if actualizacion.pendiente}
    <div class="actualizacion">
      <RefreshCw size={18} strokeWidth={1.75} />
      <div class="texto"><strong>Thunderop {actualizacion.pendiente} está lista</strong><small>Reiniciá para aplicar la actualización.</small></div>
      <button class="primario" onclick={() => (preguntar = true)}>Reiniciar</button>
    </div>
  {/if}
  {#each amigos.recibidas as s (s.id)}
    <div class="fila">
      <Avatar usuario={s.usuario} tam={28} />
      <span class="nombre" style="color:{s.usuario.color || 'inherit'}">{s.usuario.name}<Insignia usuario={s.usuario} /></span>
      <button onclick={() => hacer(aceptar(s.id))}>Aceptar</button>
      <button class="plano" onclick={() => hacer(quitar(s.id))}>Rechazar</button>
    </div>
  {/each}
  <ul>
    {#each avisos.lista as a (a.id)}
      <li class:nuevo={!a.leido}><strong>{a.titulo}</strong><small>{horaDe(a.fecha)}</small><p>{a.texto}</p></li>
    {/each}
  </ul>
  {#if nada}<p class="tenue">No tenés notificaciones.</p>{/if}
</div>
{#if preguntar}
  <Confirmar accion="Reiniciar ahora" clase="primario" cancelar={() => (preguntar = false)} confirmar={reiniciar}
    texto={`Thunderop se va a cerrar y abrir de nuevo con la versión ${actualizacion.pendiente}.${voz.salaId ? ' Vas a salir de la llamada.' : ''} ¿Reiniciar ahora?`} />
{/if}

<style>
  .icono { position: relative; display: grid; place-items: center; padding: 6px; }
  .campana { display: grid; transform-origin: 50% 12%; }
  .contador { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
    background: var(--acento); color: var(--sobre-acento); font-size: 11px; font-weight: 650; line-height: 16px; box-shadow: 0 0 0 2px var(--fondo); }
  :global([data-modo='moderno']) .campana { animation: balanceo 520ms var(--curva-salida); }
  :global([data-modo='moderno']) .icono:hover .campana { animation: balanceo-hover 520ms var(--curva-salida); }
  :global([data-modo='moderno']) .contador { animation: pop 300ms var(--curva-resorte); }
  @keyframes balanceo { 25% { transform: rotate(14deg); } 55% { transform: rotate(-10deg); } 80% { transform: rotate(5deg); } }
  @keyframes balanceo-hover { 25% { transform: rotate(14deg); } 55% { transform: rotate(-10deg); } 80% { transform: rotate(5deg); } }
  @keyframes pop { from { transform: scale(.4); opacity: 0; } }
  [popover] { position: fixed; inset: 48px 12px auto auto; margin: 0; padding: 12px; width: 320px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); }
  h3 { font-size: 14px; margin: 0; }
  .cabecera { display: flex; align-items: center; justify-content: space-between; min-height: 28px; margin-bottom: 8px; }
  ul { max-height: 360px; overflow-y: auto; }
  li { display: grid; grid-template-columns: 1fr auto; gap: 0 8px; padding: 8px; border-radius: var(--radio); }
  li.nuevo { background: var(--hover); }
  li strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li p { grid-column: 1 / -1; margin: 2px 0 0; color: var(--tenue); overflow-wrap: anywhere; }
  .fila { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
  .nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .tenue { color: var(--tenue); }
  .actualizacion { display: flex; align-items: center; gap: 10px; padding: 10px; margin-bottom: 12px;
    background: var(--acento-suave); border-radius: var(--radio-menu); color: var(--acento-texto); }
  .texto { flex: 1; min-width: 0; display: flex; flex-direction: column; color: var(--texto); }
</style>
