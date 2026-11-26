// Novedades de la última versión. Se completa en cada release (viaja dentro de la app).
// Solo se muestra la última versión: al sacar una nueva, la entrada vieja se borra.
export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] };

export const NOVEDADES: Novedad[] = [
  {
    version: '0.14.1', fecha: '2026-11-26', cambios: [
      { tipo: 'nuevo', texto: 'Las salas de voz con gente muestran hace cuánto hay gente, con el tiempo corriendo.' },
      { tipo: 'nuevo', texto: 'Nuevo menú de tu foto: estado personalizado ("Jugando Fortnite"), No molestar por un rato, novedades e invitar gente a Thunderop.' },
      { tipo: 'nuevo', texto: 'Perfil renovado: portada, color del nombre, juegos favoritos, redes y cumpleaños (sin la edad). Al lado ves cómo te ven los demás, y ellos lo ven en "Ver perfil".' },
      { tipo: 'arreglo', texto: 'Si abrís un chat por otro lado, sus notificaciones de la campanita se dan por leídas.' },
      { tipo: 'arreglo', texto: 'En la versión web (también en Android) ya se puede prender la cámara: el navegador te pide permiso.' },
    ],
  },
];
