/// <reference path="../pb_data/types.d.ts" />
// Configuración desde el entorno: dirección pública, remitente, SMTP y entrada con Google/Microsoft.
// Se aplica en cada arranque; si falta una variable, esa parte queda como esté.
onBootstrap((e) => {
  e.next();
  const env = (k) => $os.getenv(k);

  const s = e.app.settings();
  s.meta.appName = "Thunderop";
  s.meta.senderName = "Thunderop";
  // Detrás de Caddy todo llega desde 127.0.0.1: la IP real (para los límites por IP) es la que Caddy agrega
  // a la derecha de X-Forwarded-For; la de la izquierda la puede inventar el cliente.
  s.trustedProxy.headers = ["X-Forwarded-For"];
  s.trustedProxy.useLeftmostIP = false;
  if (env("APP_URL")) s.meta.appURL = env("APP_URL");
  if (env("MAIL_REMITENTE")) s.meta.senderAddress = env("MAIL_REMITENTE");
  const puerto = Number(env("SMTP_PORT"));
  if (env("SMTP_PORT") && !(Number.isInteger(puerto) && puerto > 0 && puerto < 65536)) {
    e.app.logger().error("configuracion", "error", "SMTP_PORT no es un puerto válido; no se configura el SMTP");
  } else if (env("SMTP_HOST") && env("SMTP_PORT") && env("SMTP_USER") && env("SMTP_PASS")) {
    s.smtp.enabled = true;
    s.smtp.host = env("SMTP_HOST");
    s.smtp.port = puerto;
    s.smtp.username = env("SMTP_USER");
    s.smtp.password = env("SMTP_PASS");
    s.smtp.tls = puerto === 465;
  }
  e.app.save(s);

  // sin estas dos nadie puede registrarse ni aceptar términos, ni entrar con código
  for (const k of ["TERMINOS_VERSION", "THUNDEROP_CODIGO"]) {
    if (!env(k)) e.app.logger().error("configuracion", "error", `falta ${k} en el entorno`);
  }

  // Microsoft solo con cuentas personales (endpoints "consumers").
  const MS = "https://login.microsoftonline.com/consumers/oauth2/v2.0/";
  const nuevos = [];
  if (env("GOOGLE_ID") && env("GOOGLE_SECRET")) {
    nuevos.push({ name: "google", clientId: env("GOOGLE_ID"), clientSecret: env("GOOGLE_SECRET") });
  }
  if (env("MICROSOFT_ID") && env("MICROSOFT_SECRET")) {
    nuevos.push({
      name: "microsoft", clientId: env("MICROSOFT_ID"), clientSecret: env("MICROSOFT_SECRET"),
      authURL: MS + "authorize", tokenURL: MS + "token",
    });
  }
  if (!nuevos.length) return;
  const users = e.app.findCollectionByNameOrId("users");
  users.oauth2.enabled = true;
  users.oauth2.providers = users.oauth2.providers.filter((p) => !nuevos.some((n) => n.name === p.name)).concat(nuevos);
  e.app.save(users);
});
