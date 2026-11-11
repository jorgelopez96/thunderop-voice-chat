<script lang="ts">
  import { Users } from '@lucide/svelte';
  import { pb } from '../pb';
  import { grupos, grupoActual, unirse } from '../grupos.svelte';
  import { mensajeError } from '../sesion.svelte';

  // Una invitación que llegó en un chat: el grupo con su foto y cuántos son, y Unirme. Si ya sos parte, Abrir el grupo.
  let { codigo }: { codigo: string } = $props();
  type Vista = { grupo: { id: string; name: string; miembros: number; foto: string }; miembro: boolean };
  let vista = $state<Vista | null>(null);
  let error = $state('');
  let uniendo = $state(false);

  $effect(() => {
    const c = codigo;
    pb.send(`/api/invites/${c}/vista`, { requestKey: null }).then((v: Vista) => { if (c === codigo) vista = v; }, (e) => { error = mensajeError(e); });
  });
  // Si entraste por otro lado (u otra tarjeta igual), también figura que ya sos parte.
  const soyParte = $derived(!!vista && (vista.miembro || grupos.lista.some((g) => g.id === vista!.grupo.id)));

  async function unirme() {
    uniendo = true; error = '';
    try { await unirse(codigo); } catch (e) { error = mensajeError(e); } finally { uniendo = false; }
  }
</script>

<div class="tarjeta-invitacion">
  {#if vista}
    {@const g = vista.grupo}
    {#if g.foto}<img class="foto" alt="" src={`${pb.baseURL.replace(/\/$/, '')}${g.foto}?thumb=480x270`} />
    {:else}<span class="foto inicial" aria-hidden="true">{g.name.slice(0, 1).toUpperCase()}</span>{/if}
    <div class="datos">
      <strong>{soyParte ? `Invitación a ${g.name}` : `Te invitaron a ${g.name}`}</strong>
      <small><Users size={13} strokeWidth={1.75} /> {g.miembros} {g.miembros === 1 ? 'miembro' : 'miembros'}{soyParte ? ' · Ya sos parte' : ''}</small>
    </div>
    {#if soyParte}<button class="plano" onclick={() => (grupoActual.id = g.id)}>Abrir el grupo</button>
    {:else}<button class="primario" onclick={unirme} disabled={uniendo}>{uniendo ? 'Uniéndote…' : 'Unirme'}</button>{/if}
  {:else if error}<span class="tenue">{error}</span>
  {:else}<span class="tenue">Cargando la invitación…</span>{/if}
</div>

<style>
  .tarjeta-invitacion { display: flex; align-items: center; gap: 12px; max-width: 380px; margin-top: 6px; padding: 10px 12px;
    background: var(--superficie); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-tarjeta); }
  .foto { flex: none; width: 48px; height: 48px; border-radius: 12px; object-fit: cover; background: var(--hondo); }
  .inicial { display: grid; place-items: center; font-weight: 700; font-size: 20px; color: var(--acento-texto); background: var(--acento-suave); }
  .datos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .datos strong { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .datos small { display: inline-flex; align-items: center; gap: 4px; color: var(--tenue); font-size: 12px; }
  button { flex: none; }
  .tenue { color: var(--tenue); font-size: 13px; }
</style>
