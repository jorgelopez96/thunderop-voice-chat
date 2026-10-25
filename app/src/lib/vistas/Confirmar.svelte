<script lang="ts">
  let { texto, confirmar, cancelar, accion = 'Confirmar', clase = 'peligro' }: { texto: string; confirmar: () => void; cancelar: () => void; accion?: string; clase?: string } = $props();
  let d: HTMLDialogElement;
  $effect(() => { if (!d.open) d.showModal(); });
</script>

<dialog bind:this={d} oncancel={cancelar}>
  <p>{texto}</p>
  <div class="fila" style="justify-content:flex-end">
    <button onclick={cancelar}>Cancelar</button>
    <button class={clase} onclick={confirmar}>{accion}</button>
  </div>
</dialog>
