<script lang="ts">
  import { lleno } from '../rango';
  import { User, Mic, Monitor, Bell, Palette, Trash2, Check, X } from '@lucide/svelte';
  import { voz, vistaPrevia, dispositivos, elegirEntrada, elegirSalida, cambiarSupresion, cambiarGanancia } from '../voz.svelte';
  import { leerPrefs, guardarPrefs } from '../prefs';
  import { dbDePorcentaje, porcentajeDeDb } from '../ganancia';
  import MedidorMic from './MedidorMic.svelte';
  import Requisitos from './Requisitos.svelte';
  import Confirmar from './Confirmar.svelte';
  import { TEMAS, aplicarModo, aplicarTema, modoGuardado, temaGuardado, type Modo } from '../tema';
  import { formatoHora, cambiarFormatoHora } from '../hora.svelte';
  import { pb } from '../pb';
  import { sesion, salir, mensajeError } from '../sesion.svelte';
  import { pedirCodigo, restablecer } from '../cuenta.svelte';
  import { errorClave, soloDigitos } from '../reglasCuenta';

  // Configuración de la app, por solapas como las del grupo.
  let { cerrar }: { cerrar: () => void } = $props();
  let d: HTMLDialogElement;
  let error = $state('');
  type Solapa = 'cuenta' | 'audio' | 'transmision' | 'notificaciones' | 'apariencia';
  let solapa = $state<Solapa>('cuenta');
  let tema = $state(temaGuardado());
  let modo = $state<Modo>(modoGuardado());
  const MODOS = [['basico', 'Básico', 'Estático y liviano: sin animaciones ni brillos. Rinde más mientras jugás y transmitís.'],
    ['moderno', 'Moderno', 'Sombras, brillos en tu color y animaciones cortas. Para PCs con resto.']] as const;
  let lista = $state<Awaited<ReturnType<typeof dispositivos>>>({ entradas: [], salidas: [] });
  const prefs = leerPrefs();
  let pctMic = $state(porcentajeDeDb(prefs.gananciaDb));
  let entrada = $state(prefs.entrada);
  $effect(() => { if (!d.open) d.showModal(); dispositivos().then((x) => (lista = x)).catch(() => (error = 'No se pudieron listar los dispositivos de audio.')); });
  const SOLAPAS = [['cuenta', 'Cuenta', User], ['audio', 'Audio', Mic], ['transmision', 'Transmisión', Monitor],
    ['notificaciones', 'Notificaciones', Bell], ['apariencia', 'Apariencia y rendimiento', Palette]] as const;

  const u = $derived(sesion.usuario);
  let ocupado = $state(false);
  async function hacer(f: () => Promise<unknown>) {
    error = ''; ocupado = true;
    try { await f(); } catch (e) { error = mensajeError(e); } finally { ocupado = false; }
  }

  // Cambiar la contraseña con un código por mail (sirve también para quien entró con Google y nunca puso una).
  let clave = $state<'nada' | 'codigo' | 'lista'>('nada');
  let codigo = $state('');
  let nueva = $state('');
  let repetida = $state('');
  const pedir = () => hacer(async () => { await pedirCodigo(u!.email, 'restablecer'); clave = 'codigo'; });
  function guardarClave(e: SubmitEvent) {
    e.preventDefault();
    error = errorClave(nueva) || (nueva !== repetida ? 'Las contraseñas no coinciden.' : '');
    if (error) return;
    const email = u!.email;
    hacer(async () => {
      await restablecer(email, codigo, nueva);
      await pb.collection('users').authWithPassword(email, nueva); // la contraseña nueva cierra las sesiones abiertas
      clave = 'lista'; codigo = nueva = repetida = '';
    });
  }

  let desactivar = $state(false);
  let borrar = $state<0 | 1 | 2>(0);
  let escrito = $state('');
</script>

<dialog class="config" bind:this={d} oncancel={cerrar} onclose={cerrar} onclick={(e) => e.target === d && d.close()}>
  <div class="cabecera-modal"><h2>Configuración</h2><button class="icono cerrar-modal" aria-label="Cerrar" title="Cerrar (Esc)" onclick={() => d.close()}><X size={20} strokeWidth={1.75} /></button></div>
  <div class="solapas" role="tablist">
    {#each SOLAPAS as [id, texto, Icono] (id)}
      <button role="tab" class="plano" aria-selected={solapa === id} onclick={() => { solapa = id; error = ''; }}><Icono size={16} strokeWidth={1.75} />{texto}</button>
    {/each}
  </div>
  {#if error}<p role="alert">{error}</p>{/if}

  {#if solapa === 'cuenta' && u}
    <section>
      <h3>Información de la cuenta</h3>
      <dl>
        <dt>Usuario</dt><dd>@{u.username}</dd>
        <dt>Correo electrónico</dt><dd>{u.email}</dd>
        <dt>Teléfono</dt><dd class="pronto">Próximamente</dd>
      </dl>
    </section>
    <section>
      <h3>Contraseña y seguridad</h3>
      {#if clave === 'codigo'}
        <form onsubmit={guardarClave}>
          <label>Código que te llegó a {u.email}
            <input value={codigo} inputmode="numeric" autocomplete="one-time-code" required oninput={(e) => (codigo = e.currentTarget.value = soloDigitos(e.currentTarget.value))} /></label>
          <label>Contraseña nueva <input type="password" bind:value={nueva} required autocomplete="new-password" /></label>
          <Requisitos clave={nueva} />
          <label>Repetí la contraseña <input type="password" bind:value={repetida} required autocomplete="new-password" /></label>
          <div class="fila"><button type="submit" disabled={ocupado}>Guardar contraseña</button><button type="button" class="plano" onclick={() => (clave = 'nada')}>Cancelar</button></div>
        </form>
      {:else}
        <div class="fila"><button disabled={ocupado} onclick={pedir}>Cambiar contraseña</button>{#if clave === 'lista'}<span class="ok">Contraseña cambiada.</span>{/if}</div>
      {/if}
      <div class="item"><span>Dispositivos con la sesión iniciada</span><span class="pronto">Próximamente</span></div>
    </section>
    <section class="peligroso">
      <h3>Desactivar o borrar la cuenta</h3>
      <div class="item"><span>Desactivar la cuenta<small>Te ven desconectado y se cierra la sesión en todos lados. Volvés a activarla entrando de nuevo.</small></span>
        <button onclick={() => (desactivar = true)}>Desactivar</button></div>
      <div class="item"><span>Borrar la cuenta<small>Se borra para siempre, junto con el grupo que creaste.</small></span>
        {#if borrar === 0}<button class="peligro" onclick={() => (borrar = 1)}><Trash2 size={15} strokeWidth={1.75} />Borrar</button>{/if}</div>
      {#if borrar === 1}
        <p>¿Seguro? No se puede recuperar.</p>
        <div class="fila"><button class="peligro" onclick={() => (borrar = 2)}>Sí, quiero borrarla</button><button class="plano" onclick={() => (borrar = 0)}>No</button></div>
      {:else if borrar === 2}
        <label>Escribí <strong>{u.username}</strong> para confirmar <input bind:value={escrito} autocomplete="off" /></label>
        <div class="fila">
          <button class="peligro" disabled={escrito !== u.username || ocupado} onclick={() => hacer(async () => { await pb.collection('users').delete(u.id); salir(); })}>Borrar para siempre</button>
          <button class="plano" onclick={() => { borrar = 0; escrito = ''; }}>Cancelar</button>
        </div>
      {/if}
    </section>
    {#if desactivar}<Confirmar texto="¿Desactivar tu cuenta? Se cierra la sesión en todos tus dispositivos." cancelar={() => (desactivar = false)}
      confirmar={() => { desactivar = false; hacer(async () => { await pb.send('/api/cuenta/desactivar', { method: 'POST' }); salir(); }); }} />{/if}

  {:else if solapa === 'audio'}
    <section>
      <label>Entrada
        <select value={prefs.entrada ?? 'default'} onchange={(e) => { entrada = e.currentTarget.value; elegirEntrada(entrada); }}>
          <option value="default">Predeterminado</option>
          {#each lista.entradas.filter((x) => x.deviceId !== 'default') as x (x.deviceId)}<option value={x.deviceId}>{x.label || 'Micrófono'}</option>{/each}
        </select>
      </label>
      <label>Salida
        <select value={prefs.salida ?? 'default'} onchange={(e) => elegirSalida(e.currentTarget.value)}>
          <option value="default">Predeterminado</option>
          {#each lista.salidas.filter((x) => x.deviceId !== 'default') as x (x.deviceId)}<option value={x.deviceId}>{x.label || 'Altavoz'}</option>{/each}
        </select>
      </label>
      <label class="casilla"><input type="checkbox" class="switch" checked={voz.supresion} onchange={(e) => cambiarSupresion(e.currentTarget.checked)} /> Supresión de ruido</label>
      <label>Volumen del micrófono: <span class="num">{pctMic}%</span>
        <input type="range" min="0" max="100" step="1" bind:value={pctMic} style={lleno(pctMic, 0, 100)} oninput={() => cambiarGanancia(dbDePorcentaje(pctMic))} />
      </label>
      <MedidorMic {entrada} gananciaDb={dbDePorcentaje(pctMic)} />
    </section>

  {:else if solapa === 'transmision'}
    <section>
      <label class="casilla"><input type="checkbox" class="switch" checked={voz.vistaPrevia} onchange={(e) => vistaPrevia(e.currentTarget.checked)} /> Mostrar vista previa de mi transmisión</label>
    </section>

  {:else if solapa === 'notificaciones'}
    <section>
      <label class="casilla"><input type="checkbox" class="switch" checked={prefs.notificaciones} onchange={(e) => guardarPrefs({ notificaciones: e.currentTarget.checked })} /> Notificaciones de escritorio</label>
      <label class="casilla"><input type="checkbox" class="switch" checked={prefs.sonidoMensajes} onchange={(e) => guardarPrefs({ sonidoMensajes: e.currentTarget.checked })} /> Sonido de las notificaciones</label>
      <label class="casilla"><input type="checkbox" class="switch" checked={prefs.avisoMensajes} onchange={(e) => guardarPrefs({ avisoMensajes: e.currentTarget.checked })} /> Avisar los mensajes nuevos</label>
      <label class="casilla"><input type="checkbox" class="switch" checked={prefs.avisoMenciones} onchange={(e) => guardarPrefs({ avisoMenciones: e.currentTarget.checked })} /> Avisar cuando me mencionan con @</label>
    </section>

  {:else if solapa === 'apariencia'}
    <section>
      <h3>Modo visual</h3>
      <div class="modos" role="radiogroup" aria-label="Modo visual">
        {#each MODOS as [id, nombre, texto] (id)}
          <button class="plano modo {id}" role="radio" aria-checked={modo === id} onclick={() => { modo = id; aplicarModo(id); }}>
            <span class="mini" aria-hidden="true"><span></span><span></span><span></span></span>
            <strong>{nombre}</strong><small>{texto}</small>
            {#if modo === id}<span class="tilde"><Check size={14} strokeWidth={2.5} /></span>{/if}
          </button>
        {/each}
      </div>
    </section>
    <section>
      <h3>Color de la app</h3>
      <div class="temas" role="radiogroup" aria-label="Color de la app">
        {#each TEMAS as t (t.id)}
          <button class="plano tema" role="radio" aria-checked={tema === t.id} onclick={() => { tema = t.id; aplicarTema(t.id); }}>
            <span class="muestra" style="--c:{t.color}"><span></span></span>{t.nombre}</button>
        {/each}
      </div>
    </section>
    <section>
      <div class="item"><span>Idioma</span><span class="pronto">Español · otros próximamente</span></div>
      <div class="item"><span>Formato de hora</span>
        <span class="opciones" role="radiogroup" aria-label="Formato de hora">
          <button class="plano" role="radio" aria-checked={formatoHora.h24} onclick={() => cambiarFormatoHora(true)}>24 h</button>
          <button class="plano" role="radio" aria-checked={!formatoHora.h24} onclick={() => cambiarFormatoHora(false)}>12 h</button>
        </span></div>
      <div class="item"><span>Movimiento</span><span class="pronto">Si en Windows desactivás «Efectos de animación», el modo Moderno deja de animar.</span></div>
    </section>
  {/if}
</dialog>

<style>
  h3 { margin: 0; }
  section { display: flex; flex-direction: column; gap: 12px; }
  form { display: flex; flex-direction: column; gap: 10px; max-width: 360px; }
  .casilla { flex-direction: row; align-items: center; gap: 8px; }
  small { display: block; color: var(--tenue); font-size: 12px; margin-top: 2px; }
  input[type='range'] { padding: 0; background: none; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 24px; margin: 0; }
  dt { color: var(--tenue); }
  dd { margin: 0; user-select: text; }
  .pronto { color: var(--apagado); font-size: 13px; }
  .ok { color: var(--ok); font-size: 13px; }
  .item { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .peligroso { border: 1px solid var(--peligro); border-radius: var(--radio-tarjeta); padding: 16px; }
  .peligroso h3 { color: var(--peligro); }
  .peligroso p { margin: 0; color: var(--tenue); font-size: 13px; }
  .temas { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }
  .tema { flex-direction: column; gap: 6px; padding: 8px; color: var(--texto); font-size: 13px; }
  .tema:hover:not(:disabled) { background: none; }
  .muestra { position: relative; width: 100%; height: 52px; border-radius: var(--radio-menu);
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 85%, #fff), color-mix(in srgb, var(--c) 70%, #000)); }
  .muestra span { position: absolute; inset: auto 8px 8px 8px; height: 30%; border-radius: 4px; background: rgb(0 0 0 / .28); }
  .tema[aria-checked='true'] .muestra { outline: 2px solid var(--texto); outline-offset: 3px; }
  :global([data-modo='moderno']) .muestra { transition: transform 180ms var(--curva-salida); }
  :global([data-modo='moderno']) .tema:hover .muestra { transform: translateY(-2px); }
  .modos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .modo { position: relative; flex-direction: column; align-items: stretch; gap: 4px; padding: 12px; text-align: left; white-space: normal;
    background: var(--superficie); border: 1px solid var(--borde); border-radius: var(--radio-tarjeta); }
  .modo:hover:not(:disabled) { background: var(--superficie); border-color: var(--borde-fuerte); }
  .modo[aria-checked='true'] { border-color: var(--acento); box-shadow: 0 0 0 1px var(--acento), var(--brillo); }
  .modo strong { font-size: 14.5px; font-weight: 650; color: var(--texto); margin-top: 8px; }
  .modo small { font-size: 12.5px; line-height: 1.4; }
  .mini { display: grid; grid-template-columns: 28% 1fr; grid-template-rows: 1fr 30%; gap: 6px; height: 108px; padding: 8px;
    background: var(--hondo); border-radius: var(--radio-menu); }
  .mini span { background: var(--panel); border-radius: 4px; }
  .mini span:first-child { grid-row: 1 / 3; }
  .mini span:last-child { background: var(--acento-medio); }
  .moderno .mini span { box-shadow: 0 4px 12px rgb(0 0 0 / .5); }
  .moderno .mini span:last-child { background: var(--acento); box-shadow: 0 0 14px -2px var(--acento-brillo); }
  .tilde { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 22px; height: 22px;
    border-radius: 50%; background: var(--acento); color: var(--sobre-acento); }
  :global([data-modo='moderno']) .tilde { animation: pop 260ms var(--curva-resorte); }
  @keyframes pop { from { transform: scale(.5); opacity: 0; } }
  .opciones { display: flex; gap: 4px; }
  .opciones button { padding: 4px 12px; border: 1px solid var(--borde); }
  .opciones [aria-checked='true'] { border-color: var(--acento); background: var(--acento-suave); }
</style>
