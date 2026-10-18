<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { mensajeError } from '../sesion.svelte';
  import { voz, volumen, silenciar, ver, pistaPantalla, pistaPantallaPropia, vistaPrevia, volumenPantalla } from '../voz.svelte';
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
  let vid = $state<HTMLVideoElement>();
  let pctPantalla = $state(100);
  // Se recalcula con cada cambio de `voz.participantes` (así se entera de que llegó la pista), pero solo
  // avisa si cambia la pista: hablar o silenciarse no re-engancha el video.
  const pista = $derived((void voz.participantes, voz.viendo ? pistaPantalla(voz.viendo) : undefined));
  $effect(() => {
    const t = pista;
    if (!t || !vid) return;
    const el = vid;
    t.attach(el);
    return () => { t.detach(el); };
  });
  // Vista previa de la propia transmisión: misma regla, solo reacciona a la referencia de la pista.
  let prev = $state<HTMLVideoElement>();
  const pistaPropia = $derived((void voz.participantes, voz.transmitiendo && voz.vistaPrevia ? pistaPantallaPropia() : undefined));
  $effect(() => {
    const t = pistaPropia;
    if (!t || !prev) return;
    const el = prev;
    t.attach(el);
    return () => { t.detach(el); };
  });
  const mirar = (id: string | null) => { pctPantalla = 100; if (id) volumenPantalla(id, 1); ver(id); };
  const quien = $derived(voz.participantes.find((p) => p.id === voz.viendo)?.nombre ?? '');
  function cambiar(id: string, pct: number) { vols[id] = pct / 100; volumen(id, pct / 100); }
</script>

<section class="voz">
  <h2>🔊 {sala}</h2>
  {#if voz.conectando}<p role="status">Conectando…</p>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  {#if voz.viendo}
    <div class="pantalla">
      <video bind:this={vid} autoplay playsinline muted aria-label={`Pantalla de ${quien}`}></video>
      <div class="fila">
        <button onclick={() => vid?.requestFullscreen().catch(() => {})}>Pantalla completa</button>
        <input type="range" min="0" max="200" step="5" bind:value={pctPantalla} aria-label="Volumen de la transmisión"
          oninput={() => voz.viendo && volumenPantalla(voz.viendo, pctPantalla / 100)} />
      </div>
    </div>
  {/if}
  <ul>
    {#each voz.participantes as p (p.id)}
      {@const m = miembro(p.id)}
      <li class="tarjeta" class:hablando={p.hablando}>
        {#if m?.avatar}<img class="avatar" alt="" src={pb.files.getURL(m, m.avatar, { thumb: '64x64' })} />
        {:else}<span class="avatar" style="background:{m?.color || ''}"></span>{/if}
        <strong style="color:{m?.color || 'inherit'}">{p.nombre}{p.local ? ' (vos)' : ''}</strong>
        {#if p.transmite}<span class="vivo">📺 En vivo</span>
          {#if !p.local}<button class="plano" onclick={() => mirar(voz.viendo === p.id ? null : p.id)}>{voz.viendo === p.id ? 'Dejar de ver' : 'Ver'}</button>{/if}{/if}
        {#if p.local && voz.transmitiendo}<div class="propia">
          {#if voz.vistaPrevia}
            <video class="previa" bind:this={prev} autoplay playsinline muted aria-label="Vista previa de tu transmisión"></video>
            <button class="plano" onclick={() => vistaPrevia(false)}>Ocultar vista previa</button>
          {:else}<button class="plano" onclick={() => vistaPrevia(true)}>Mostrar vista previa</button>{/if}
        </div>{/if}
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
  .vivo { font-size: 12px; color: var(--ok); }
  .pantalla { margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
  video { width: 100%; max-height: 60vh; object-fit: contain; background: var(--hondo); border-radius: var(--radio); }
  .propia { flex-basis: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .previa { width: 240px; max-width: 100%; max-height: none; aspect-ratio: 16 / 9; }
  .pantalla input[type='range'] { flex: 1; min-width: 120px; }
</style>
