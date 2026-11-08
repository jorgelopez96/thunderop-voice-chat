<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { amigos, solicitarPorUsuario } from '../amigos.svelte';
  import { noLeidos, privado } from '../privados.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';
  import { UserPlus } from '@lucide/svelte';
  import { irA } from '../ir.svelte';
  import { estado } from '../presencia.svelte';

  // Panel fijo a la derecha de la portada. Solo se muestra el estado elegido, nunca en qué grupo o sala está.
  let agregando = $state(false);
  const TEXTOS = { disponible: 'Disponible', ausente: 'Ausente', ocupado: 'Ocupado', desconectado: 'Desconectado' };
  const enLineaYa = $derived(amigos.lista.filter((a) => estado(a.usuario) !== 'desconectado'));
  const desconectados = $derived(amigos.lista.filter((a) => estado(a.usuario) === 'desconectado'));

  let usuario = $state('');
  let error = $state('');
  let ok = $state('');

  async function agregar(e: SubmitEvent) {
    e.preventDefault();
    ok = '';
    error = await solicitarPorUsuario(usuario);
    if (!error) { ok = `Le mandaste una solicitud a ${usuario.trim()}.`; usuario = ''; }
  }
  const abrir = (u: RecordModel) => (privado.con = u);
  // Una notificación pidió abrir el privado de este amigo.
  $effect(() => { const id = irA.privado; const a = id ? amigos.lista.find((x) => x.usuario.id === id) : undefined; if (a) { irA.privado = null; abrir(a.usuario); } });
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

<style>
  .amigos { flex: 1; display: flex; flex-direction: column; min-height: 0; background: var(--panel); border-left: 1px solid var(--borde); --anillo: var(--panel); }
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
</style>
