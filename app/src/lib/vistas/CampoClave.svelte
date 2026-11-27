<script lang="ts">
  import { Eye, EyeOff } from '@lucide/svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  // Campo de contraseña con el ojito para ver lo escrito. Va dentro del <label> de cada formulario.
  let { value = $bindable(''), autocomplete = 'current-password' }: { value?: string; autocomplete?: HTMLInputAttributes['autocomplete'] } = $props();
  let ver = $state(false);
</script>

<span class="campo-clave">
  <input type={ver ? 'text' : 'password'} bind:value required {autocomplete} autocapitalize="off" spellcheck="false" />
  <button type="button" class="plano ojo" aria-label={ver ? 'Ocultar la clave' : 'Mostrar la clave'} aria-pressed={ver}
    title={ver ? 'Ocultar' : 'Mostrar'} onclick={() => (ver = !ver)}>
    {#if ver}<EyeOff size={18} strokeWidth={1.75} />{:else}<Eye size={18} strokeWidth={1.75} />{/if}
  </button>
</span>

<style>
  .campo-clave { position: relative; display: flex; }
  .campo-clave input { flex: 1; min-width: 0; padding-right: 44px; }
  .ojo { position: absolute; top: 50%; right: 4px; transform: translateY(-50%); min-height: 32px; padding: 0 8px; color: var(--tenue); }
  .ojo:hover:not(:disabled) { color: var(--texto); }
  .ojo[aria-pressed='true'] { background: none; color: var(--texto); }
</style>
