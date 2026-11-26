<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { abrirLink } from '../links';
  import { REDES, cumpleTexto, desdeCuando, type Redes } from '../perfil';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';

  // Tarjeta de perfil: la ven los demás en "Ver perfil" y uno mismo, en vivo, al editar. `foto`/`portada`: vista previa de lo elegido.
  let { u, foto, portada, dueno = false }: { u: RecordModel; foto?: string; portada?: string; dueno?: boolean } = $props();
  const fondo = $derived(portada || (u.portada ? pb.files.getURL(u, u.portada, { thumb: '600x200' }) : ''));
  const juegos = $derived(((u.juegos ?? []) as string[]).filter(Boolean));
  const redes = $derived(REDES.filter(([k]) => (u.redes as Redes | null)?.[k]));
</script>

<article class="tarjeta-perfil">
  <div class="portada" style:background-image={fondo ? `url("${fondo}")` : undefined}></div>
  <div class="cuerpo">
    <Avatar usuario={u} tam={64} src={foto} />
    <strong class="nombre" style:color={u.color || undefined}>{u.name || 'Sin apodo'}<Insignia usuario={u} {dueno} /></strong>
    <span class="usuario">@{u.username}</span>
    {#if u.actividad}<span class="actividad">{u.actividad}</span>{/if}
    {#if u.status}<p class="descripcion">{u.status}</p>{/if}
    {#if juegos.length}<ul class="juegos" aria-label="Juegos favoritos">{#each juegos as j, i (i)}<li>{j}</li>{/each}</ul>{/if}
    {#if redes.length || u.cumple || u.created}
      <div class="meta">
        {#each redes as [k, nombre, link] (k)}{@const usuario = (u.redes as Redes)[k]!}
          <a href={link(usuario)} rel="noopener noreferrer" onclick={(e) => { e.preventDefault(); abrirLink(link(usuario)); }}>{nombre}: {usuario}</a>{/each}
        {#if u.cumple}<span>🎂 {cumpleTexto(u.cumple)}</span>{/if}
        {#if u.created}<span>En Thunderop desde {desdeCuando(u.created)}</span>{/if}
      </div>
    {/if}
  </div>
</article>

<style>
  .tarjeta-perfil { width: 100%; background: var(--panel); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); overflow: hidden; --anillo: var(--panel); }
  .portada { height: 64px; background: var(--superficie) center / cover no-repeat; }
  .cuerpo { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 0 12px 12px; margin-top: -32px; min-width: 0; }
  .cuerpo > :global(.caja) { border-radius: 50%; box-shadow: 0 0 0 4px var(--panel); }
  .nombre { display: flex; align-items: center; gap: 4px; font-size: 16px; font-weight: 650; max-width: 100%; overflow-wrap: anywhere; }
  .usuario { margin-top: -6px; font-size: 12.5px; color: var(--tenue); }
  .actividad { align-self: stretch; padding: 5px 8px; font-size: 12.5px; background: var(--superficie); border-radius: var(--radio); overflow-wrap: anywhere; }
  .descripcion { margin: 0; font-size: 13px; overflow-wrap: anywhere; }
  .juegos { display: flex; flex-wrap: wrap; gap: 6px; }
  .juegos li { font-size: 11.5px; padding: 2px 8px; border-radius: var(--radio-pildora); background: var(--superficie); border: 1px solid var(--borde); }
  .meta { align-self: stretch; display: flex; flex-direction: column; gap: 2px; padding-top: 6px; border-top: 1px solid var(--borde); font-size: 12px; color: var(--apagado); }
  .meta a { color: var(--acento-texto); text-decoration: none; overflow-wrap: anywhere; }
  .meta a:hover { text-decoration: underline; }
</style>
