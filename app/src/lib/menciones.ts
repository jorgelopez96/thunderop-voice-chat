// Menciones con @ en el chat: se guardan como texto ("@Jorge López") y se resaltan al mostrarlas
// si coinciden con alguien del grupo. Los nombres pueden tener espacios: gana el más largo que coincida.

/** Lo que se está escribiendo después de un @ justo antes del cursor, o null si no hay mención en curso. */
export function mencionEnCurso(texto: string, cursor: number): { inicio: number; consulta: string } | null {
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(texto.slice(0, cursor));
  return m ? { inicio: cursor - m[2].length - 1, consulta: m[2] } : null;
}

/** Nombres que empiezan con la consulta (o la contienen), sin distinguir mayúsculas; como mucho `max`. */
export function sugerencias(nombres: string[], consulta: string, max = 6): string[] {
  const q = consulta.toLocaleLowerCase();
  const empiezan = nombres.filter((n) => n.toLocaleLowerCase().startsWith(q));
  const contienen = nombres.filter((n) => !empiezan.includes(n) && n.toLocaleLowerCase().includes(q));
  return [...empiezan, ...contienen].slice(0, max);
}

/** Reemplaza "@consulta" (desde `inicio` hasta el cursor) por "@Nombre ". Devuelve el texto y dónde queda el cursor. */
export function completar(texto: string, inicio: number, cursor: number, nombre: string): { texto: string; cursor: number } {
  const puesto = `@${nombre} `;
  return { texto: texto.slice(0, inicio) + puesto + texto.slice(cursor), cursor: inicio + puesto.length };
}

/** Parte un texto en pedazos normales y menciones a `nombres` (el nombre exacto, sin distinguir mayúsculas). */
export function partirMenciones(texto: string, nombres: string[]): { texto: string; nombre?: string }[] {
  const largos = [...nombres].sort((a, b) => b.length - a.length);
  const partes: { texto: string; nombre?: string }[] = [];
  let suelto = '';
  for (let i = 0; i < texto.length; i++) {
    // un @ al principio o después de un espacio, seguido de un nombre que termina en un borde (no a mitad de palabra)
    if (texto[i] === '@' && (i === 0 || /\s/.test(texto[i - 1]))) {
      const resto = texto.slice(i + 1).toLocaleLowerCase();
      const nombre = largos.find((n) => resto.startsWith(n.toLocaleLowerCase()) && !/[\p{L}\p{N}_]/u.test(resto[n.length] ?? ''));
      if (nombre) {
        if (suelto) partes.push({ texto: suelto });
        partes.push({ texto: texto.slice(i, i + 1 + nombre.length), nombre });
        suelto = '';
        i += nombre.length;
        continue;
      }
    }
    suelto += texto[i];
  }
  if (suelto) partes.push({ texto: suelto });
  return partes;
}

/** ¿El texto menciona a `nombre`? */
export const menciona = (texto: unknown, nombre: string | undefined) =>
  typeof texto === 'string' && !!nombre && partirMenciones(texto, [nombre]).some((p) => p.nombre);
