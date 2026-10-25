<script lang="ts">
  import { lleno } from '../rango';
  import type { RecordModel } from 'pocketbase';
  import { ImagePlus, Plus, Trash2, X } from '@lucide/svelte';
  import { pb } from '../pb';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { borrarGrupo, banear } from '../grupos.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';
  import BotonEmoji from './BotonEmoji.svelte';
  import SubirSonido from './SubirSonido.svelte';
  import Confirmar from './Confirmar.svelte';
  import { sonidos, editar, borrar } from '../botonera.svelte';

  // Configuraciones del grupo, por solapas. General: nombre, descripción y foto (los cambia el dueño).
  // Sonidos: cada uno edita los que subió; el dueño, todos. Participantes, Baneados y Borrar: Baneados y Borrar solo el dueño.
  // Borrar pide dos pasos: confirmar y escribir el nombre del grupo.
  let { grupo, cerrar }: { grupo: RecordModel; cerrar: () => void } = $props();
  let d = $state<HTMLDialogElement>();
  $effect(() => { d?.showModal(); });
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  const ingresos = $derived((grupo.ingresos ?? {}) as Record<string, string>);
  const baneados = $derived((grupo.baneados ?? []) as { id: string; name: string; username: string; fecha: string }[]);
  let paso = $state<0 | 1 | 2>(0); // 0: nada, 1: ¿seguro?, 2: escribir el nombre
  let escrito = $state('');
  let error = $state('');
  let ocupado = $state(false);
  type Solapa = 'general' | 'sonidos' | 'participantes' | 'baneados' | 'borrar';
  let solapa = $state<Solapa>('general');
  const solapas = $derived<[Solapa, string][]>([['general', 'General'], ['sonidos', 'Sonidos'], ['participantes', 'Participantes'],
    ...(soyDueno ? [['baneados', 'Baneados'], ['borrar', 'Borrar grupo']] as [Solapa, string][] : [])]);
  // svelte-ignore state_referenced_locally
  const lista = sonidos(grupo.id);
  $effect(() => lista.parar);
  let nuevo = $state(false);
  let aBorrar = $state<RecordModel | null>(null);
  let aBanear = $state<RecordModel | null>(null);
  const puedeEditar = (x: RecordModel) => soyDueno || x.owner === sesion.usuario?.id;
  const fecha = (f?: string) => (f ? new Date(f.replace(' ', 'T')).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  function renombrar(x: RecordModel, name: string) {
    name = name.trim();
    if (name && name !== x.name) hacer(() => editar(x.id, { name }));
  }
  function guardarGrupo(campo: 'name' | 'descripcion', valor: string) {
    valor = valor.trim();
    if ((campo === 'name' && !valor) || valor === (grupo[campo] ?? '')) return;
    hacer(() => pb.collection('groups').update(grupo.id, { [campo]: valor }));
  }

  async function hacer(f: () => Promise<unknown>) {
    error = ''; ocupado = true;
    try { await f(); } catch (e) { error = mensajeError(e); } finally { ocupado = false; }
  }
  async function cambiarFoto(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { error = 'La foto debe ser una imagen.'; return; }
    if (f.size > 2 * 1024 * 1024) { error = 'La foto supera los 2 MB.'; return; }
    const datos = new FormData();
    datos.append('foto', f);
    await hacer(() => pb.collection('groups').update(grupo.id, datos));
  }
</script>

<dialog class="config" bind:this={d} onclose={cerrar} onclick={(e) => e.target === d && d.close()}>
  <div class="cabecera-modal"><h2>Configuraciones de {grupo.name}</h2><button class="icono cerrar-modal" aria-label="Cerrar" title="Cerrar (Esc)" onclick={() => d?.close()}><X size={20} strokeWidth={1.75} /></button></div>
  <div class="solapas" role="tablist">
    {#each solapas as [id, texto] (id)}
      <button role="tab" class="plano" class:rojo={id === 'borrar'} aria-selected={solapa === id} onclick={() => { solapa = id; error = ''; }}>
        {#if id === 'borrar'}<Trash2 size={16} strokeWidth={1.75} />{/if}{texto}</button>
    {/each}
  </div>

  {#if solapa === 'general'}
    <section class="general">
      <div class="datos">
        <label>Nombre del grupo
          <input value={grupo.name} maxlength="40" disabled={!soyDueno} onchange={(e) => guardarGrupo('name', e.currentTarget.value)} /></label>
        <label>Descripción
          <textarea rows="4" maxlength="300" disabled={!soyDueno} value={grupo.descripcion ?? ''}
            placeholder="Contanos de qué va este grupo… o cuántas horas de vicio llevan."
            onchange={(e) => guardarGrupo('descripcion', e.currentTarget.value)}></textarea></label>
      </div>
      <div class="foto">
        <span class="titulo">Foto del grupo</span>
        {#if grupo.foto}<img alt="" src={pb.files.getURL(grupo, grupo.foto, { thumb: '480x270' })} />
        {:else}<span class="sin-foto">Sin foto</span>{/if}
        {#if soyDueno}
          <label class="boton"><ImagePlus size={16} strokeWidth={1.75} /> Cambiar foto
            <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onchange={cambiarFoto} /></label>
        {:else}<small>Solo el dueño puede cambiarla.</small>{/if}
      </div>
    </section>

  {:else if solapa === 'sonidos'}
    <section>
      <h3>Sonidos — {lista.estado.lista.length}</h3>
      <ul class="sonidos">
        {#each lista.estado.lista as x (x.id)}
          {@const puede = puedeEditar(x)}
          <li>
            {#if puede}
              <input value={x.name} maxlength="30" aria-label="Nombre del sonido" onchange={(e) => renombrar(x, e.currentTarget.value)} />
              <BotonEmoji elegir={(e) => renombrar(x, x.name + e)} />
              <input type="range" min="5" max="200" step="5" value={x.volumen || 100} style={lleno(x.volumen || 100, 5, 200)} aria-label={`Volumen de ${x.name}`} title={`${x.volumen || 100}%`}
                onchange={(e) => hacer(() => editar(x.id, { volumen: +e.currentTarget.value }))} />
              <small>{x.volumen || 100}%</small>
              <button class="icono" title="Borrar" aria-label={`Borrar ${x.name}`} onclick={() => (aBorrar = x)}><Trash2 size={14} strokeWidth={1.75} /></button>
            {:else}<span>{x.name}</span><small>{x.volumen || 100}%</small>{/if}
          </li>
        {:else}<li class="tenue">Todavía no hay sonidos en este grupo.</li>{/each}
      </ul>
      <button class="centro" onclick={() => (nuevo = true)}><Plus size={16} strokeWidth={1.75} /> Nuevo sonido</button>
    </section>
    {#if nuevo}<SubirSonido grupoId={grupo.id} cerrar={() => (nuevo = false)} />{/if}
    {#if aBorrar}{@const x = aBorrar}<Confirmar texto={`¿Borrar el sonido "${x.name}"?`} cancelar={() => (aBorrar = null)}
      confirmar={() => { aBorrar = null; hacer(() => borrar(x.id)); }} />{/if}

  {:else if solapa === 'participantes'}
    <section>
      <h3>Participantes — {miembros.length}</h3>
      <ul class="tabla">
        <li class="cabeza"><span>Miembro</span><span>Cuenta creada</span><span>En el grupo desde</span><span></span></li>
        {#each miembros as m (m.id)}
          <li>
            <span class="quien"><Avatar usuario={m} tam={28} /><span>{m.name}{#if m.username}<small>@{m.username}</small>{/if}</span>
              <Insignia usuario={m} dueno={m.id === grupo.owner} /></span>
            <span>{fecha(m.created)}</span>
            <span>{fecha(m.id === grupo.owner ? ingresos[m.id] ?? grupo.created : ingresos[m.id])}</span>
            <span>{#if soyDueno && m.id !== grupo.owner}<button class="plano peligro chico" onclick={() => (aBanear = m)}>Banear</button>{/if}</span>
          </li>
        {/each}
      </ul>
    </section>
    {#if aBanear}{@const m = aBanear}<Confirmar texto={`¿Banear a ${m.name}? Sale del grupo y no puede volver hasta que lo desbanees.`}
      cancelar={() => (aBanear = null)} confirmar={() => { aBanear = null; hacer(() => banear(grupo.id, m.id, true)); }} />{/if}

  {:else if solapa === 'baneados'}
    <section>
      <h3>Baneados — {baneados.length}</h3>
      <ul class="tabla">
        {#each baneados as b (b.id)}
          <li class="baneado">
            <span class="quien"><span>{b.name}{#if b.username}<small>@{b.username}</small>{/if}</span></span>
            <span>Baneado el {fecha(b.fecha)}</span>
            <span><button class="plano chico" disabled={ocupado} onclick={() => hacer(() => banear(grupo.id, b.id, false))}>Desbanear</button></span>
          </li>
        {:else}<li class="tenue">No hay nadie baneado.</li>{/each}
      </ul>
    </section>

  {:else}
    <section class="peligroso">
      <h3>Borrar el grupo</h3>
      {#if paso === 0}
        <p>Se borran todas las salas, los mensajes y los sonidos de <strong>{grupo.name}</strong>. Una vez borrado no se puede recuperar.</p>
        <button class="peligro" onclick={() => (paso = 1)}><Trash2 size={16} strokeWidth={1.75} /> Borrar grupo</button>
      {:else if paso === 1}
        <p>¿Seguro que querés borrar <strong>{grupo.name}</strong>?</p>
        <div class="fila"><button class="peligro" onclick={() => (paso = 2)}>Sí, quiero borrarlo</button><button class="plano" onclick={() => (paso = 0)}>No</button></div>
      {:else}
        <label>Escribí <strong>{grupo.name}</strong> tal cual para confirmar
          <input bind:value={escrito} autocomplete="off" aria-label="Nombre del grupo para confirmar" /></label>
        <div class="fila">
          <button class="peligro" disabled={escrito !== grupo.name || ocupado} onclick={() => hacer(() => borrarGrupo(grupo.id))}>Borrar para siempre</button>
          <button class="plano" onclick={() => { paso = 0; escrito = ''; }}>Cancelar</button>
        </div>
      {/if}
    </section>
  {/if}

  {#if error}<p role="alert">{error}</p>{/if}
</dialog>

<style>
  h3 { margin: 0 0 8px; }
  .solapas .rojo { color: var(--peligro); }
  .general { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start; }
  .datos { display: flex; flex-direction: column; gap: 14px; }
  textarea { resize: vertical; min-height: 96px; font: inherit; }
  .foto { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .titulo { align-self: flex-start; color: var(--tenue); font-size: 13px; }
  .foto img, .sin-foto { width: 192px; height: 108px; object-fit: cover; border-radius: var(--radio-menu); background: var(--hondo); }
  .sin-foto { display: grid; place-items: center; color: var(--apagado); font-size: 12px; border: 1px dashed var(--punteado); }
  label.boton { flex-direction: row; color: var(--texto); font-size: 14px; }
  ul { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
  li { display: flex; align-items: center; gap: 8px; }
  .tabla { max-height: 52vh; }
  .tabla li { display: grid; grid-template-columns: minmax(0, 2fr) 1fr 1fr 80px; gap: 12px; padding: 6px 4px; border-bottom: 1px solid var(--borde); font-size: 13px; }
  .tabla li.baneado { grid-template-columns: minmax(0, 2fr) 1fr 100px; }
  .tabla li.tenue { display: block; border: 0; }
  .tabla .cabeza { color: var(--tenue); font-size: 12px; }
  .quien { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 14px; }
  .quien small { margin-left: 6px; color: var(--tenue); }
  .chico { padding: 4px 8px; min-height: 0; font-size: 13px; }
  .peligroso { border: 1px solid var(--peligro); border-radius: var(--radio-tarjeta); padding: 16px; }
  .peligroso h3 { color: var(--peligro); }
  .peligroso p { margin: 0 0 8px; color: var(--tenue); font-size: 13px; }
  .peligroso label { margin-bottom: 8px; }
  .sonidos { max-height: 50vh; margin-bottom: 8px; }
  .sonidos li > input:first-child, .sonidos li > span { flex: 1; min-width: 0; }
  .sonidos input[type='range'] { width: 96px; }
  .sonidos small { width: 36px; color: var(--tenue); text-align: right; font-variant-numeric: tabular-nums; }
  .centro { display: flex; width: fit-content; margin: 0 auto; }
  .tenue { color: var(--tenue); font-size: 13px; }
</style>
