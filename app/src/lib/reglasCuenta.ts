// Reglas de cuenta: espejo de server/pb_hooks/reglas.js (mismas reglas y mensajes).

const MSG_USUARIO = 'El usuario tiene que tener de 3 a 20 caracteres: letras sin acentos, números, punto o guion bajo.';
const MSG_CLAVE = 'La contraseña necesita 8 caracteres, una mayúscula, un número y un carácter especial.';
const MSG_EDAD = 'Tenés que tener al menos 13 años para usar Thunderop.';
const MSG_FECHA = 'La fecha de nacimiento no es válida.';

/** Deja solo los dígitos (un código pegado como "123 456"). */
export const soloDigitos = (s: string) => s.replace(/\D/g, '').slice(0, 6);

export const normalizarUsuario = (s: string) => String(s || '').trim().toLowerCase();

export const errorUsuario = (s: string) => (/^[a-z0-9._]{3,20}$/.test(s) ? '' : MSG_USUARIO);

export function requisitosClave(s: string) {
  s = String(s || '');
  return { largo: s.length >= 8, mayuscula: /[A-Z]/.test(s), numero: /[0-9]/.test(s), especial: /[^A-Za-z0-9]/.test(s) };
}

export const errorClave = (s: string) => (Object.values(requisitosClave(s)).every(Boolean) ? '' : MSG_CLAVE);

/** Años cumplidos a `hoy` (fecha UTC, como el servidor); NaN si `nacimiento` no es una fecha real que ya pasó. */
export function edad(nacimiento: string, hoy: Date): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  if (!m) return NaN;
  const [a, mes, dia] = [+m[1], +m[2], +m[3]];
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return NaN;
  const [ha, hm, hd] = [hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, hoy.getUTCDate()];
  if (a > ha || (a === ha && (mes > hm || (mes === hm && dia > hd)))) return NaN;
  return ha - a - (hm < mes || (hm === mes && hd < dia) ? 1 : 0);
}

export function errorEdad(nacimiento: string, hoy: Date): string {
  const e = edad(nacimiento, hoy);
  if (isNaN(e)) return MSG_FECHA;
  return e < 13 ? MSG_EDAD : '';
}
