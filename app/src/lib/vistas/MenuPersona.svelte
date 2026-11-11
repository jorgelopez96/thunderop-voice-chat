<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { MessageSquare, Volume2, Video } from '@lucide/svelte';
  import { lleno } from '../rango';
  import { leerPrefs } from '../prefs';
  import { voz, volumen, silenciar, desconectar, moverA, bloquearVoz, calidadCamaraDe } from '../voz.svelte';
  import { asignarRol } from '../grupos.svelte';
  import { puedo, rolesDe, rolesDeMiembro, type Permiso } from '../permisos';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { amigos } from '../amigos.svelte';
  import { privado } from '../privados.svelte';
  import { abrirEnPunto } from '../menu';

  // Clic derecho (o mantener apretado) sobre alguien de la voz, en la llamada o en la lista de salas: mensaje privado,
  // su volumen, sus roles (solo el admin) y lo que mis permisos me dejan hacerle. A mí mismo y al admin, nada de moderar.
  let { grupo, salasVoz = [], alError }: { grupo: RecordModel; salasVoz?: RecordModel[]; alError: (m: string) => void } = $props();

  let menu = $state<HTMLElement>();
  let elegido = $state<{ id: string; nombre: string } | null>(null);
  let vols = $state<Record<string, number>>({ ...leerPrefs().volumenes });
  let calCam = $state(leerPrefs().calidadCam);
  // Silencios recién pedidos, hasta que el grupo se refresque con el valor del servidor.
  let pedidos = $state<Record<string, boolean>>({});
  const silenciado = (id: string) => pedidos[id] ?? ((grupo.silenciados ?? []) as string[]).includes(id);
  const pp = (x: Permiso) => puedo(grupo, sesion.usuario?.id, x);
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  const moderable = (id: string) => id !== grupo.owner && id !== sesion.usuario?.id;

  /** Abre el menú de `p` donde se hizo clic. Para uno mismo no hay menú. */
  export function abrir(x: number, y: number, p: { id: string; nombre: string }) {
    if (p.id === sesion.usuario?.id) return;
    elegido = p;
    vols = { ...leerPrefs().volumenes };
    calCam = leerPrefs().calidadCam;
    void abrirEnPunto(menu, x, y);
  }

  function cambiar(id: string, pct: number) { vols[id] = pct / 100; volumen(id, pct / 100); }
  async function hacer(f: () => Promise<void>, cerrar = true) {
    if (cerrar) menu?.hidePopover();
    try { await f(); } catch (e) { alError(mensajeError(e)); }
  }
  const alternar = (id: string) => hacer(async () => { const nuevo = !silenciado(id); await silenciar(grupo.id, id, nuevo); pedidos[id] = nuevo; });
</script>

<div popover bind:this={menu} class="menu menu-persona">
  {#if elegido}
    {@const p = elegido}
    {@const amigo = amigos.lista.find((a) => a.usuario.id === p.id)?.usuario}
    {@const roles = rolesDe(grupo).slice(1)}
    <strong class="quien">{p.nombre}</strong>
    {#if amigo}<button class="plano" onclick={() => { menu?.hidePopover(); privado.con = amigo; }}><MessageSquare size={15} strokeWidth={1.75} /> Enviar mensaje</button>{/if}
    <div class="volumen" title="Volumen de {p.nombre} (solo para vos)">
      <Volume2 size={15} strokeWidth={1.75} />
      <input type="range" min="0" max="200" step="5" value={Math.round((vols[p.id] ?? 1) * 100)} style={lleno((vols[p.id] ?? 1) * 100, 0, 200)}
        aria-label={`Volumen de ${p.nombre}`} oninput={(e) => cambiar(p.id, +e.currentTarget.value)} />
      <small class="num">{Math.round((vols[p.id] ?? 1) * 100)}%</small>
    </div>
    {#if voz.participantes.some((x) => x.id === p.id && x.camara)}
      <label class="volumen" title="Calidad en la que ves su cámara (solo para vos)">
        <Video size={15} strokeWidth={1.75} />
        <select aria-label={`Calidad de la cámara de ${p.nombre}`} value={calCam[p.id] ?? ''}
          onchange={(e) => { const v = (e.currentTarget.value || null) as 'media' | 'baja' | null; calidadCamaraDe(p.id, v); calCam = leerPrefs().calidadCam; }}>
          <option value="">Cámara: automática</option><option value="media">Cámara: media (720p)</option><option value="baja">Cámara: baja (360p)</option>
        </select>
      </label>
    {/if}
    {#if soyDueno && moderable(p.id) && roles.length}
      <hr /><small class="titulo">Roles</small>
      <div class="roles" role="group" aria-label={`Roles de ${p.nombre}`}>
        {#each roles as r (r.id)}
          <label class="rol"><input type="checkbox" checked={rolesDeMiembro(grupo, p.id).some((x) => x.id === r.id)}
            onchange={(e) => { const si = e.currentTarget.checked; hacer(() => asignarRol(grupo, p.id, r.id, si), false); }} />
            <span class="punto" style:background={r.color}></span><span class="nombre-rol">{r.nombre}</span></label>
        {/each}
      </div>
    {/if}
    {#if moderable(p.id) && (pp('silenciar') || pp('desconectar') || pp('bloquearVoz'))}<hr />
      {#if pp('silenciar')}<button class="plano peligro" onclick={() => alternar(p.id)}>{silenciado(p.id) ? 'Quitar silencio' : 'Silenciar'}</button>{/if}
      {#if pp('desconectar')}
        {#each salasVoz.filter((s) => s.id !== voz.salaId) as s (s.id)}
          <button class="plano" onclick={() => hacer(() => moverA(grupo.id, p.id, s.id))}>Mover a {s.name}</button>
        {/each}
        <button class="plano peligro" onclick={() => hacer(() => desconectar(grupo.id, p.id))}>Desconectar de la llamada</button>
      {/if}
      {#if pp('bloquearVoz')}<button class="plano peligro" onclick={() => hacer(() => bloquearVoz(grupo.id, p.id, true))}>Desconectar y no dejar volver</button>{/if}
    {/if}
  {/if}
</div>

<style>
  .menu { position: fixed; inset: auto; margin: 0; padding: 6px; width: 232px; flex-direction: column; gap: 2px;
    background: var(--elevado); border: 1px solid var(--borde); border-radius: var(--radio-menu); box-shadow: var(--sombra-3); }
  .menu:popover-open { display: flex; }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
  .menu button { justify-content: flex-start; min-height: 30px; padding: 4px 8px; font-size: 13px; gap: 8px; }
  .menu button:not(.peligro) { color: var(--texto); }
  .quien { padding: 2px 8px 4px; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .volumen { display: flex; align-items: center; gap: 8px; padding: 4px 8px; color: var(--icono); }
  .volumen select { flex: 1; min-width: 0; font-size: 13px; }
  .volumen input { flex: 1; min-width: 0; padding: 0; background: none; border: 0; }
  .volumen small { width: 36px; text-align: right; color: var(--tenue); font-size: 12px; }
  .titulo { padding: 0 8px; color: var(--tenue); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .roles { display: flex; flex-direction: column; max-height: 168px; overflow-y: auto; }
  /* Cada rol en su renglón: casilla, color y nombre (antes salían apilados en columna). */
  .rol { display: flex; flex-direction: row; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px; font-size: 13px; color: var(--texto); cursor: pointer; }
  .rol:hover { background: var(--hover); }
  .rol input { flex: none; margin: 0; }
  .punto { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .nombre-rol { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
