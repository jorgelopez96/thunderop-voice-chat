<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { Search, X } from '@lucide/svelte';
  import { amigos } from '../amigos.svelte';
  import { enviarPrivado } from '../privados.svelte';
  import { crearInvitacion } from '../grupos.svelte';
  import { mensajeError } from '../sesion.svelte';
  import Avatar from './Avatar.svelte';

  // Invitar al grupo: a un amigo se le manda el link por privado; abajo, el link para copiar y pasarlo por otro lado.
  let { grupo, cerrar }: { grupo: RecordModel; cerrar: () => void } = $props();
  let d = $state<HTMLDialogElement>();
  $effect(() => { d?.showModal(); });

  let link = $state('');
  let error = $state('');
  let buscar = $state('');
  let copiado = $state(false);
  const enviadas = $state<Record<string, 'enviando' | 'enviada'>>({});
  $effect(() => { crearInvitacion(grupo.id).then((l) => (link = l), (e) => (error = mensajeError(e))); });

  const miembros = $derived(new Set<string>(grupo.members ?? []));
  const lista = $derived.by(() => {
    const q = buscar.trim().toLowerCase();
    return amigos.lista.map((a) => a.usuario)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q));
  });

  async function invitar(id: string) {
    enviadas[id] = 'enviando';
    try { await enviarPrivado(id, link); enviadas[id] = 'enviada'; }
    catch (e) { delete enviadas[id]; error = mensajeError(e); }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(link); copiado = true; setTimeout(() => (copiado = false), 2000); }
    catch { /* sin permiso: el link queda a la vista para copiarlo a mano */ }
  }
</script>

<dialog class="invitar" bind:this={d} onclose={cerrar} onclick={(e) => e.target === d && d.close()}>
  <header>
    <h3>Invitá a tus amigos a {grupo.name}</h3>
    <button class="icono" aria-label="Cerrar" onclick={() => d?.close()}><X size={18} strokeWidth={1.75} /></button>
  </header>
  <label class="buscar"><Search size={16} strokeWidth={1.75} /><input bind:value={buscar} placeholder="Buscar amigos" aria-label="Buscar amigos" /></label>
  <ul>
    {#each lista as u (u.id)}
      <li>
        <span class="quien"><Avatar usuario={u} tam={36} /><span>{u.name}{#if u.username}<small>{u.username}</small>{/if}</span></span>
        {#if miembros.has(u.id)}<button disabled>Ya está</button>
        {:else}<button disabled={!link || !!enviadas[u.id]} onclick={() => invitar(u.id)}>{enviadas[u.id] === 'enviada' ? 'Enviada' : 'Invitar'}</button>{/if}
      </li>
    {:else}
      <li class="vacio">{amigos.lista.length ? 'Nadie con ese nombre' : 'Todavía no tenés amigos agregados'}</li>
    {/each}
  </ul>
  <footer>
    <p>O mandale el link de invitación a un amigo</p>
    <div class="link">
      <input readonly value={link} aria-label="Link de invitación" data-testid="link-invitacion" onfocus={(e) => e.currentTarget.select()} />
      <button class="primario" disabled={!link} onclick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
    </div>
    <small>El link vence en 7 días.</small>
    {#if error}<p role="alert">{error}</p>{/if}
  </footer>
</dialog>

<style>
  .invitar { width: min(440px, 92vw); max-width: none; padding: 0; }
  .invitar[open] { display: flex; flex-direction: column; max-height: min(640px, 85vh); }
  header { display: flex; align-items: center; justify-content: space-between; padding: 20px 20px 12px; }
  header h3 { margin: 0; font-size: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .buscar { display: flex; flex-direction: row; align-items: center; gap: 8px; margin: 0 20px 8px; padding: 0 10px; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--hondo); color: var(--tenue); }
  .buscar input { flex: 1; border: 0; background: none; padding: 8px 0; }
  .buscar input:focus-visible { outline: none; }
  ul { flex: 1; min-height: 120px; overflow-y: auto; padding: 0 12px; }
  li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border-radius: var(--radio); }
  li:hover { background: var(--hover); }
  .quien { display: flex; align-items: center; gap: 10px; min-width: 0; font-size: 14px; font-weight: 600; }
  .quien > span { display: flex; flex-direction: column; min-width: 0; }
  .quien small { font-weight: 400; font-size: 12px; color: var(--tenue); }
  .vacio { justify-content: center; color: var(--tenue); padding: 24px; }
  .vacio:hover { background: none; }
  footer { border-top: 1px solid var(--borde); padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 8px; }
  footer p { margin: 0; font-weight: 600; }
  footer small { color: var(--tenue); }
  .link { display: flex; gap: 6px; padding: 4px; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--hondo); }
  .link input { flex: 1; min-width: 0; border: 0; background: none; padding: 6px 8px; }
</style>
