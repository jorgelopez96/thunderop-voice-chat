<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { Plus, Trash2, ChevronDown, ChevronRight } from '@lucide/svelte';
  import { PERMISOS, COLORES_ROL, MAX_ROLES, MAX_NOMBRE, rolesDe, resumen, nuevoId, type Permiso, type Rol } from '../permisos';
  import { guardarRoles } from '../grupos.svelte';
  import { mensajeError } from '../sesion.svelte';
  import Confirmar from './Confirmar.svelte';

  // Solapa Roles (solo la ve el admin): una tarjeta por rol con su resumen; al tocarla se despliegan nombre, color y
  // permisos. "Todos" es de cualquier miembro: solo se le cambian los permisos. Cada cambio se guarda al momento.
  let { grupo }: { grupo: RecordModel } = $props();
  // Cada cambio manda la lista entera: se arma sobre lo último que guardamos y no sobre lo que todavía no volvió
  // del servidor (si no, renombrar y enseguida tocar un permiso pisaba el nombre). Cuando llega el grupo y no queda
  // ningún guardado en camino, manda el servidor.
  let propios = $state<Rol[] | null>(null);
  let enCamino = 0;
  $effect(() => { void grupo.roles; if (!enCamino) propios = null; });
  const roles = $derived(propios ?? rolesDe(grupo));
  const asignaciones = $derived((grupo.asignaciones ?? {}) as Record<string, string[]>);
  const cuantos = (id: string) => Object.values(asignaciones).filter((l) => l.includes(id)).length;
  const grupos = [...new Set(PERMISOS.map((p) => p.grupo))];
  let abierto = $state<string | null>(null);
  let aBorrar = $state<Rol | null>(null);
  let error = $state('');

  async function guardar(nuevos: Rol[], asig?: Record<string, string[]>) {
    error = '';
    propios = nuevos;
    enCamino++;
    try { await guardarRoles(grupo.id, nuevos, asig); } catch (e) { propios = null; error = mensajeError(e); } finally { enCamino--; }
  }
  const cambiar = (id: string, cambio: Partial<Rol>) => guardar(roles.map((r) => (r.id === id ? { ...r, ...cambio } : r)));
  function permiso(r: Rol, p: Permiso, si: boolean) {
    cambiar(r.id, { permisos: si ? [...r.permisos.filter((x) => x !== p), p] : r.permisos.filter((x) => x !== p) });
  }
  function renombrar(r: Rol, nombre: string) {
    nombre = nombre.trim();
    if (nombre && nombre !== r.nombre) cambiar(r.id, { nombre });
  }
  async function crear() {
    const usados = new Set(roles.map((r) => r.nombre.toLowerCase()));
    let n = roles.length, nombre = 'Rol nuevo';
    while (usados.has(nombre.toLowerCase())) nombre = `Rol nuevo ${n++}`;
    const rol: Rol = { id: nuevoId(), nombre, color: COLORES_ROL[(roles.length - 1) % COLORES_ROL.length], permisos: [] };
    await guardar([...roles, rol]);
    abierto = rol.id;
  }
  function borrar(r: Rol) {
    const asig = Object.fromEntries(Object.entries(asignaciones).map(([u, l]) => [u, l.filter((x) => x !== r.id)]));
    guardar(roles.filter((x) => x.id !== r.id), asig);
  }
</script>

<section class="roles">
  <h3>Roles — {roles.length - 1}</h3>
  <ul>
    {#each roles as r (r.id)}
      {@const todos = r.id === 'todos'}
      <li class="tarjeta" class:abierta={abierto === r.id}>
        <button class="plano cabeza" aria-expanded={abierto === r.id} onclick={() => (abierto = abierto === r.id ? null : r.id)}>
          <span class="punto" style:background={todos ? 'var(--tenue)' : r.color}></span>
          <b>{r.nombre}</b>
          <span class="resumen">{todos ? resumen(r) : abierto === r.id ? `${cuantos(r.id)} ${cuantos(r.id) === 1 ? 'persona' : 'personas'}` : resumen(r)}</span>
          {#if abierto === r.id}<ChevronDown size={16} strokeWidth={1.75} />{:else}<ChevronRight size={16} strokeWidth={1.75} />{/if}
        </button>
        {#if abierto === r.id}
          <div class="cuerpo">
            {#if todos}<p class="tenue">Lo tiene cualquier miembro del grupo. Sin permisos igual pueden hablar, chatear, tocar sonidos e invitar.</p>
            {:else}
              <div class="fila">
                <input value={r.nombre} maxlength={MAX_NOMBRE} aria-label="Nombre del rol" onchange={(e) => renombrar(r, e.currentTarget.value)} />
                <div class="colores" role="radiogroup" aria-label="Color del rol">
                  {#each COLORES_ROL as c (c)}
                    <button class="color" role="radio" aria-checked={r.color === c} aria-label={`Color ${c}`} style:background={c} onclick={() => cambiar(r.id, { color: c })}></button>
                  {/each}
                </div>
              </div>
            {/if}
            {#each grupos as g (g)}
              <span class="grupo">{g}</span>
              <div class="permisos">
                {#each PERMISOS.filter((p) => p.grupo === g) as p (p.clave)}
                  <label class="casilla"><input type="checkbox" class="switch" checked={r.permisos.includes(p.clave)}
                    onchange={(e) => permiso(r, p.clave, e.currentTarget.checked)} /> {p.texto}</label>
                {/each}
              </div>
            {/each}
            {#if !todos}<button class="plano peligro borrar" onclick={() => (aBorrar = r)}><Trash2 size={14} strokeWidth={1.75} /> Borrar rol</button>{/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  {#if roles.length - 1 < MAX_ROLES}<button class="centro" onclick={crear}><Plus size={16} strokeWidth={1.75} /> Crear rol</button>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
</section>
{#if aBorrar}<Confirmar texto={`¿Borrar el rol "${aBorrar.nombre}"? Se les saca a todos los que lo tienen.`}
  cancelar={() => (aBorrar = null)} confirmar={() => { const r = aBorrar!; aBorrar = null; borrar(r); }} />{/if}

<style>
  h3 { margin: 0 0 8px; }
  ul { display: flex; flex-direction: column; gap: 6px; max-height: 52vh; overflow-y: auto; }
  .tarjeta { background: var(--superficie); border-radius: var(--radio-tarjeta); border: 1px solid transparent; }
  .tarjeta.abierta { border-color: var(--acento-borde); }
  .cabeza { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; text-align: left; }
  .punto { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .resumen { margin-left: auto; color: var(--tenue); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .cuerpo { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 6px; }
  .fila { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .fila input { flex: 1; min-width: 140px; }
  .colores { display: flex; gap: 6px; }
  .color { width: 20px; height: 20px; min-height: 0; padding: 0; border-radius: 50%; border: 2px solid transparent; }
  .color[aria-checked='true'] { border-color: var(--texto); }
  .grupo { color: var(--tenue); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; margin-top: 6px; }
  .permisos { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 16px; }
  .borrar { align-self: flex-start; margin-top: 6px; }
  .centro { display: flex; width: fit-content; margin: 8px auto 0; }
  .tenue { color: var(--tenue); font-size: 13px; margin: 0; }
</style>
