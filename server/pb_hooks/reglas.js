// Reglas de cuentas compartidas por los hooks: usuario, contraseña, edad, términos, invitación y qué le falta a una cuenta.

const MSG_USUARIO = "El usuario tiene que tener de 3 a 20 caracteres: letras sin acentos, números, punto o guion bajo.";
const MSG_CLAVE = "La contraseña necesita 8 caracteres, una mayúscula, un número y un carácter especial.";
const MSG_EDAD = "Tenés que tener al menos 13 años para usar Thunderop.";
const MSG_FECHA = "La fecha de nacimiento no es válida.";
const MSG_TERMINOS = "Tenés que aceptar los términos y la política de privacidad.";
const MSG_OAUTH_SIN_MAIL = "Tu cuenta de Google o Microsoft no comparte un mail. Probá con otra o creá la cuenta con mail y contraseña.";

function normalizarUsuario(s) {
  return String(s || "").trim().toLowerCase();
}

function errorUsuario(s) {
  return /^[a-z0-9._]{3,20}$/.test(s) ? "" : MSG_USUARIO;
}

function errorClave(s) {
  s = String(s || "");
  return s.length >= 8 && /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s) ? "" : MSG_CLAVE;
}

// Años cumplidos entre dos fechas YYYY-MM-DD; NaN si `nacimiento` no es una fecha real que ya pasó.
function edad(nacimiento, hoy) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  if (!m) return NaN;
  const [a, mes, dia] = [+m[1], +m[2], +m[3]];
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return NaN;
  if (nacimiento > hoy) return NaN;
  const [ha, hm, hd] = hoy.split("-").map(Number);
  return ha - a - (hm < mes || (hm === mes && hd < dia) ? 1 : 0);
}

function errorEdad(nacimiento, hoy) {
  const e = edad(nacimiento, hoy);
  if (isNaN(e)) return MSG_FECHA;
  return e < 13 ? MSG_EDAD : "";
}

// Versión de términos vigente (TERMINOS_VERSION); 0 si no está configurada, y entonces nadie la cumple.
function terminosVigente() {
  const v = parseInt($os.getenv("TERMINOS_VERSION"), 10);
  return v > 0 ? v : 0;
}

function errorTerminos(t) {
  const v = terminosVigente();
  return v > 0 && t === v ? "" : MSG_TERMINOS;
}

// Código de invitación (THUNDEROP_CODIGO), sin distinguir mayúsculas y sin espacios alrededor.
function codigoValido(codigo) {
  const esperado = String($os.getenv("THUNDEROP_CODIGO")).trim().toUpperCase();
  return !!esperado && String(codigo || "").trim().toUpperCase() === esperado;
}

// Lo que le falta a una cuenta para usar la API, en el orden en que la app lo pide.
function falta(u) {
  const f = [];
  if (!u.verified()) f.push("verificar");
  if (!u.getBool("invitado")) f.push("invitacion");
  const v = terminosVigente();
  if (!v || u.getInt("terminos") !== v) f.push("terminos");
  if (!u.getBool("perfilCompleto")) f.push("perfil");
  return f;
}

// Datos de una cuenta nueva que entra por Google/Microsoft: usuario al azar (lo elige al completar el perfil),
// sin invitación ni términos, y el nombre del proveedor o, si no da uno, lo que va antes de la @ del mail
// (recortado a 32, el largo máximo del nombre).
function datosOAuth(nombre, email) {
  return {
    username: "u" + $security.randomStringWithAlphabet(12, "abcdefghijklmnopqrstuvwxyz0123456789"),
    perfilCompleto: false,
    invitado: false,
    terminos: 0,
    name: String(nombre || "").trim().slice(0, 32) || String(email || "").split("@")[0].slice(0, 32),
  };
}

// Una cuenta nueva por Google/Microsoft necesita el mail del proveedor.
function errorOAuthMail(email) {
  return String(email || "").trim() ? "" : MSG_OAUTH_SIN_MAIL;
}

/** ¿Alguno de los dos bloqueó al otro? Lee `bloqueados` (oculto) de ambos. */
function bloqueo(app, a, b) {
  const tiene = (de, a2) => {
    try {
      const lista = JSON.parse(app.findRecordById("users", de).getString("bloqueados") || "[]") || [];
      return lista.some((x) => x.id === a2);
    } catch { return false; }
  };
  return tiene(a, b) || tiene(b, a);
}

module.exports = { bloqueo, normalizarUsuario, datosOAuth, errorOAuthMail, errorUsuario, errorClave, edad, errorEdad, errorTerminos, terminosVigente, codigoValido, falta, MSG_TERMINOS };
