<script lang="ts">
  import { Bell } from '@lucide/svelte';
  import { amigos, aceptar, quitar } from '../amigos.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';

  let error = $state('');
  const n = $derived(amigos.recibidas.length);
  const hacer = async (f: Promise<string>) => { error = await f; };
</script>

<button class="plano icono" popovertarget="campanita" aria-label={n ? `Solicitudes de amistad: ${n}` : 'Solicitudes de amistad'} title="Solicitudes de amistad">
  <Bell size={20} strokeWidth={1.75} />
  {#if n}<span class="contador">{n}</span>{/if}
</button>
<div id="campanita" popover>
  <h3>Solicitudes de amistad</h3>
  {#if error}<p role="alert">{error}</p>{/if}
  {#each amigos.recibidas as s (s.id)}
    <div class="fila">
      <Avatar usuario={s.usuario} tam={28} />
      <span class="nombre" style="color:{s.usuario.color || 'inherit'}">{s.usuario.name}<Insignia usuario={s.usuario} /></span>
      <button onclick={() => hacer(aceptar(s.id))}>Aceptar</button>
      <button class="plano" onclick={() => hacer(quitar(s.id))}>Rechazar</button>
    </div>
  {:else}
    <p class="tenue">No tenés solicitudes.</p>
  {/each}
</div>

<style>
  .icono { position: relative; display: grid; place-items: center; padding: 6px; }
  .contador { position: absolute; top: 0; right: 0; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
    background: var(--acento); color: #fff; font-size: 11px; line-height: 16px; }
  [popover] { position: fixed; inset: 48px 12px auto auto; margin: 0; padding: 12px; width: 320px;
    background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 10px; }
  h3 { font-size: 14px; margin: 0 0 8px; }
  .fila { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
  .nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .tenue { color: var(--tenue); }
</style>
