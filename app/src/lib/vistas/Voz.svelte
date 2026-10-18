<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { mensajeError } from '../sesion.svelte';
  import { voz, volumen, silenciar } from '../voz.svelte';
  import { leerPrefs } from '../prefs';

  let { grupo, soyDueno, sala }: { grupo: RecordModel; soyDueno: boolean; sala: string } = $props();
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  const miembro = (id: string) => miembros.find((m) => m.id === id);
  // Silencios recién pedidos, hasta que el grupo se refresque con el valor del servidor.
  let pedidos = $state<Record<string, boolean>>({});
  const silenciado = (id: string) => pedidos[id] ?? ((grupo.silenciados ?? []) as string[]).includes(id);
  let vols = $state<Record<string, number>>({ ...leerPrefs().volumenes });
  let error = $state('');

  async function alternar(id: string) {
    error = '';
    const nuevo = !silenciado(id);
    try { await silenciar(grupo.id, id, nuevo); pedidos[id] = nuevo; } catch (e) { error = mensajeError(e); }
  }
  function cambiar(id: string, pct: number) { vols[id] = pct / 100; volumen(id, pct / 100); }
</script>

<section class="voz">
  <h2>🔊 {sala}</h2>
  {#if voz.conectando}<p role="status">Conectando…</p>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  <ul>
    {#each voz.participantes as p (p.id)}
      {@const m = miembro(p.id)}
      <li class="tarjeta" class:hablando={p.hablando}>
        {#if m?.avatar}<img class="avatar" alt="" src={pb.files.getURL(m, m.avatar, { thumb: '64x64' })} />
        {:else}<span class="avatar" style="background:{m?.color || ''}"></span>{/if}
        <strong style="color:{m?.color || 'inherit'}">{p.nombre}{p.local ? ' (vos)' : ''}</strong>
        {#if p.silenciado}<span title="Sin micrófono" aria-label="Silenciado">🔇</span>{/if}
        {#if !p.local}
          <input type="range" min="0" max="200" step="5" value={Math.round((vols[p.id] ?? 1) * 100)}
            aria-label={`Volumen de ${p.nombre}`} oninput={(e) => cambiar(p.id, +e.currentTarget.value)} />
          {#if soyDueno}<button class="plano" onclick={() => alternar(p.id)}>{silenciado(p.id) ? 'Quitar silencio' : 'Silenciar'}</button>{/if}
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .voz { padding: 16px; overflow-y: auto; }
  h2 { font-size: 16px; margin-bottom: 12px; }
  ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .tarjeta { flex-direction: row; align-items: center; padding: 12px; gap: 8px; border: 2px solid transparent; flex-wrap: wrap; }
  .tarjeta.hablando { border-color: var(--ok); }
  .tarjeta strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  input[type='range'] { flex-basis: 100%; padding: 0; background: none; }
</style>
