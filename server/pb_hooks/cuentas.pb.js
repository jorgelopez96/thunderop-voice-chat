/// <reference path="../pb_data/types.d.ts" />
// Cuentas: registro (valida usuario, contraseña, edad y términos, y fuerza los campos que el cliente no decide),
// códigos por mail, estado, invitación, completar perfil, términos nuevos, validar descarga y la guardia global.

// Guardia: una cuenta de usuario a la que le falta algo (ver reglas.falta) solo puede usar las rutas para
// completarse; todo lo demás (colecciones, realtime, archivos, batch, rutas propias) responde 403 con `falta`.
// Se decide por el patrón de la ruta que encontró el router, no por la URL cruda, así no hay forma de colarse
// con barras, mayúsculas o caracteres escapados. Sin sesión o con superusuario pasa: las reglas siguen valiendo.
routerUse((e) => {
  if (!e.auth || e.auth.isSuperuser()) return e.next();
  const falta = require(`${__hooks}/reglas.js`).falta(e.auth);
  if (!falta.length) return e.next();

  const ruta = e.request.pattern.replace(/^[A-Z]+ /, "");
  const col = e.request.pathValue("collection");
  const esUsers = col === "users" || col === e.auth.collection().id;
  const sinExpand = !e.request.url.query().has("expand");
  const permitida = /^\/api\/cuenta\/[a-z]+$/.test(ruta)
    || ruta === "/api/descarga/validar"
    || (esUsers && sinExpand && /^\/api\/collections\/\{collection\}\/auth-[a-z0-9-]+$/.test(ruta))
    || (esUsers && sinExpand && e.request.method === "GET"
      && ruta === "/api/collections/{collection}/records/{id}" && e.request.pathValue("id") === e.auth.id);
  if (permitida) return e.next();
  return e.json(403, { message: "Tu cuenta no está completa.", falta });
});

// Las rutas de mail que trae PocketBase (en inglés, con links) no existen para `users`: confirmar, restablecer y
// cambiar el mail van por /api/cuenta/* con códigos de 6 números. Un superusuario las sigue teniendo.
routerUse((e) => {
  const RUTAS_MAIL_PB = ["request-verification", "confirm-verification", "request-password-reset", "confirm-password-reset",
    "request-otp", "auth-with-otp", "request-email-change", "confirm-email-change"];
  const m = /^[A-Z]+ \/api\/collections\/\{collection\}\/([a-z-]+)$/.exec(e.request.pattern || "");
  if (!m || !RUTAS_MAIL_PB.includes(m[1]) || e.hasSuperuserAuth()) return e.next();
  let col = null;
  try { col = e.app.findCachedCollectionByNameOrId(e.request.pathValue("collection")); } catch (_) {}
  if (col && col.name !== "users") return e.next();
  throw new NotFoundError();
});

// PocketBase saca del body los campos hidden que manda un cliente antes de llegar al hook de creación:
// se guardan acá, en el evento de la request, para que el hook los lea.
routerUse((e) => {
  if (e.request.method === "POST" && e.request.url.path === "/api/collections/users/records") {
    const b = e.requestInfo().body;
    e.set("registro", { nacimiento: b.nacimiento, terminos: b.terminos });
  }
  return e.next();
});

onRecordCreateRequest((e) => {
  // la cuenta nueva de Google/Microsoft ya viene armada por onRecordAuthWithOAuth2Request
  if (e.hasSuperuserAuth() || /\/auth-with-oauth2$/.test(e.requestEvent.request.pattern || "")) return e.next();
  const r = require(`${__hooks}/reglas.js`);

  const body = e.requestInfo().body;
  const hidden = e.get("registro") || {};
  const nacimiento = String(hidden.nacimiento || "").slice(0, 10);
  const terminos = hidden.terminos;

  const usuario = r.normalizarUsuario(e.record.getString("username"));
  e.record.set("username", usuario);
  e.record.set("email", e.record.getString("email").toLowerCase());

  const mal = r.errorUsuario(usuario)
    || r.errorClave(body.password)
    || r.errorEdad(nacimiento, new Date().toISOString().slice(0, 10))
    || r.errorTerminos(terminos);
  if (mal) throw new BadRequestError(mal);

  e.record.set("nacimiento", nacimiento);
  e.record.set("terminos", terminos);
  e.record.set("invitado", false);
  e.record.set("verified", false);
  e.record.set("perfilCompleto", true);
  e.record.set("terminosFecha", new Date().toISOString().replace("T", " "));
  e.next();
}, "users");

// Cambiar la contraseña con PATCH (oldPassword) pide la misma fuerza que el registro.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  const body = e.requestInfo().body;
  if (body.password !== undefined) {
    const mal = require(`${__hooks}/reglas.js`).errorClave(body.password);
    if (mal) throw new BadRequestError(mal);
  }
  e.next();
}, "users");

// Google/Microsoft: una cuenta sin confirmar con ese mail se descarta y se crea otra (nadie probó que el mail
// fuera suyo); una confirmada se vincula. La nueva ignora lo que mande el cliente y arranca con datosOAuth.
onRecordAuthWithOAuth2Request((e) => {
  const r = require(`${__hooks}/reglas.js`);
  // sin mail del proveedor no se crea nada (y una sin confirmar no se descarta)
  const mal = (e.isNewRecord || (e.record && !e.record.verified())) && r.errorOAuthMail(e.oAuth2User.email);
  if (mal) throw new BadRequestError(mal);
  if (e.record && !e.record.verified()) {
    e.app.delete(e.record);
    e.record = null;
    e.isNewRecord = true;
  }
  if (e.isNewRecord) e.createData = r.datosOAuth(e.oAuth2User.name, e.oAuth2User.email);
  e.next();
}, "users");

// Cuentas sin confirmar más viejas que CUENTAS_SIN_CONFIRMAR_HORAS (24 si no está). Los `codigos` no se tocan:
// guardan el tope de emisiones; los de las cuentas borradas se van en cascada.
cronAdd("cuentas-sin-confirmar", "0 * * * *", () => {
  const h = parseFloat($os.getenv("CUENTAS_SIN_CONFIRMAR_HORAS"));
  const limite = new Date(Date.now() - (h >= 0 ? h : 24) * 60 * 60 * 1000).toISOString().replace("T", " ");
  for (const u of $app.findRecordsByFilter("users", "verified = false && created < {:l}", "", 0, 0, { l: limite })) {
    try { $app.delete(u); } catch (err) { $app.logger().error("cuentas-sin-confirmar", "user", u.id, "error", String(err)); }
  }
});

// Responde siempre igual exista o no la cuenta, para no revelar qué mails están registrados.
routerAdd("POST", "/api/cuenta/codigo", (e) => {
  const ASUNTOS = {
    verificar: "Tu código para confirmar tu cuenta de Thunderop",
    restablecer: "Tu código para cambiar la contraseña de Thunderop",
  };
  const m = require(`${__hooks}/mail.js`);
  const body = e.requestInfo().body;
  const tipo = body.tipo;
  if (!ASUNTOS[tipo]) throw new BadRequestError("Tipo de código no válido.");

  const codigo = $security.randomStringWithAlphabet(6, "0123456789");
  const user = m.buscarCuenta($app, body.email);
  if (user && (tipo === "restablecer" || !user.verified())) {
    let emitir = true;
    $app.runInTransaction((tx) => {
      const previos = tx.findRecordsByFilter("codigos", "user = {:u} && tipo = {:t}", "", 0, 0, { u: user.id, t: tipo });
      const ahora = Date.now();
      // máximo 5 códigos por hora y tipo; la cuenta se arrastra de un código al siguiente
      let emitidos = 0;
      let ventana = new Date(ahora).toISOString().replace("T", " ");
      if (previos.length && ahora - previos[0].getDateTime("ventana").time().unix() * 1000 < 60 * 60 * 1000) {
        emitidos = previos[0].getInt("emitidos");
        ventana = previos[0].getString("ventana");
      }
      if (emitidos >= 5) { emitir = false; return; }
      previos.forEach((c) => tx.delete(c));
      const reg = new Record(tx.findCollectionByNameOrId("codigos"));
      reg.set("user", user.id);
      reg.set("tipo", tipo);
      reg.set("hash", $security.sha256(codigo));
      reg.set("expira", new Date(ahora + 10 * 60 * 1000).toISOString().replace("T", " "));
      reg.set("intentos", 0);
      reg.set("emitidos", emitidos + 1);
      reg.set("ventana", ventana);
      tx.save(reg);
    });
    if (emitir) {
    try {
      m.enviar($app, user.email(), ASUNTOS[tipo],
        `<p>Tu código es:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${codigo}</p>` +
        "<p>Vence en 10 minutos. Si no lo pediste, ignorá este mail.</p>");
    } catch (err) {
      // no se informa al cliente: un error acá delataría que la cuenta existe
      $app.logger().error("mail", "error", String(err));
    }
    }
  }
  return e.json(200, {});
});

routerAdd("POST", "/api/cuenta/verificar", (e) => {
  const m = require(`${__hooks}/mail.js`);
  const body = e.requestInfo().body;
  m.canjear($app, body.email, "verificar", body.codigo, (tx, user) => {
    user.set("verified", true);
    tx.save(user);
  });
  return e.json(200, {});
});

routerAdd("POST", "/api/cuenta/restablecer", (e) => {
  const m = require(`${__hooks}/mail.js`);
  const body = e.requestInfo().body;
  const mal = require(`${__hooks}/reglas.js`).errorClave(body.password);
  if (mal) throw new BadRequestError(mal);
  m.canjear($app, body.email, "restablecer", body.codigo, (tx, user) => {
    user.setPassword(body.password);
    user.set("verified", true);
    tx.save(user);
  });
  return e.json(200, {});
});

routerAdd("GET", "/api/cuenta/terminos", (e) => {
  return e.json(200, { version: require(`${__hooks}/reglas.js`).terminosVigente() });
});

routerAdd("GET", "/api/cuenta/estado", (e) => {
  const r = require(`${__hooks}/reglas.js`);
  const u = e.auth;
  const hoy = new Date().toISOString().slice(0, 10);
  return e.json(200, {
    verificado: u.verified(),
    invitado: u.getBool("invitado"),
    terminos: u.getInt("terminos"),
    terminosVigente: r.terminosVigente(),
    perfilCompleto: u.getBool("perfilCompleto"),
    menor: r.edad(u.getString("nacimiento").slice(0, 10), hoy) < 18,
    username: u.getString("username"),
    falta: r.falta(u),
  });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/cuenta/invitacion", (e) => {
  if (!require(`${__hooks}/reglas.js`).codigoValido(e.requestInfo().body.codigo)) throw new BadRequestError("El código de invitación no es válido.");
  const u = e.auth;
  u.set("invitado", true);
  e.app.save(u);
  return e.json(200, {});
}, $apis.requireAuth("users"));

// Para cuentas que entraron sin el registro (Google/Outlook): mismas validaciones que el registro.
routerAdd("POST", "/api/cuenta/completar", (e) => {
  const r = require(`${__hooks}/reglas.js`);
  const body = e.requestInfo().body;
  const usuario = r.normalizarUsuario(body.username);
  const nacimiento = String(body.nacimiento || "").slice(0, 10);
  const mal = r.errorUsuario(usuario)
    || r.errorEdad(nacimiento, new Date().toISOString().slice(0, 10))
    || r.errorTerminos(body.terminos);
  if (mal) throw new BadRequestError(mal);

  // se relee y guarda en una transacción: dos pedidos a la vez no pueden cambiar el usuario después de completo
  e.app.runInTransaction((tx) => {
    const u = tx.findRecordById("users", e.auth.id);
    if (u.getBool("perfilCompleto")) throw new BadRequestError("Tu perfil ya está completo.");
    u.set("username", usuario);
    u.set("nacimiento", nacimiento);
    u.set("terminos", body.terminos);
    u.set("terminosFecha", new Date().toISOString().replace("T", " "));
    u.set("perfilCompleto", true);
    tx.save(u);
  });
  return e.json(200, {});
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/cuenta/terminos", (e) => {
  const r = require(`${__hooks}/reglas.js`);
  const version = e.requestInfo().body.version;
  const mal = r.errorTerminos(version);
  if (mal) throw new BadRequestError(mal);
  const u = e.auth;
  u.set("terminos", version);
  u.set("terminosFecha", new Date().toISOString().replace("T", " "));
  e.app.save(u);
  return e.json(200, {});
}, $apis.requireAuth("users"));

// La página web pregunta antes de dar el instalador: vale el código de invitación o una sesión de cuenta completa.
routerAdd("POST", "/api/descarga/validar", (e) => {
  const r = require(`${__hooks}/reglas.js`);
  const porCodigo = r.codigoValido(e.requestInfo().body.codigo);
  const porCuenta = !!e.auth && e.auth.collection().name === "users" && !r.falta(e.auth).length;
  if (!porCodigo && !porCuenta) return e.json(401, {});
  // El link del instalador solo sale en esta respuesta (la página no lo tiene en el HTML ni en el código).
  const base = ($os.getenv("APP_URL") || e.app.settings().meta.appURL).replace(/\/+$/, "");
  // `version: "beta"` da el instalador de prueba; la actualización automática (latest.json) sigue con el estable.
  const archivo = e.requestInfo().body.version === "beta" ? "thunderop-setup-beta.exe" : "thunderop-setup.exe";
  return e.json(200, { url: `${base}/descargas/${archivo}` });
});

// Desactivar la cuenta: se ve desconectada, no recibe solicitudes de amistad y se cierran todas sus sesiones.
// Iniciar sesión de nuevo (con contraseña o Google) la reactiva.
routerAdd("POST", "/api/cuenta/desactivar", (e) => {
  const u = e.app.findRecordById("users", e.auth.id);
  u.set("desactivada", true);
  u.set("visto", "");
  u.refreshTokenKey();
  e.app.saveNoValidate(u);
  return e.json(200, {});
}, $apis.requireAuth("users"));

onRecordAuthRequest((e) => {
  if (e.record.getBool("desactivada")) {
    e.record.set("desactivada", false);
    e.app.saveNoValidate(e.record);
  }
  e.next();
}, "users");
