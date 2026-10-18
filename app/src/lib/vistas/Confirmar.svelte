<script lang="ts">
  let { texto, confirmar, cancelar }: { texto: string; confirmar: () => void; cancelar: () => void } = $props();
  let d: HTMLDialogElement;
  $effect(() => { if (!d.open) d.showModal(); });
</script>

<dialog bind:this={d} oncancel={cancelar}>
  <p>{texto}</p>
  <div class="fila" style="justify-content:flex-end">
    <button onclick={cancelar}>Cancelar</button>
    <button class="peligro" onclick={confirmar}>Confirmar</button>
  </div>
</dialog>
