// Prueba de transmisión nativa: Windows Graphics Capture + codificador de la GPU (Media Foundation; si la
// placa no tiene, el de Microsoft por software), y el H.264 que sale se manda a LiveKit tal cual.
// Uso: transmisor <sala> [fuente] [fps] [mbps] [alto]
//      fuente: pantalla (monitor principal) | monitor:<dispositivo> (p. ej. monitor:\\.\DISPLAY2) | ventana:<hwnd>
//      transmisor --miniaturas <ancho> [pid a excluir]   (una línea JSON por monitor y por ventana)
//      transmisor --probar [fuente] [fps] [mbps]   (sin LiveKit: captura y comprime 3 s y dice si la placa puede)
// (LIVEKIT_URL, LIVEKIT_API_KEY y LIVEKIT_API_SECRET en el entorno)
//
// Códigos de salida, para que la app sepa qué hacer:
//   0 terminó bien (Ctrl+C o se cerró la ventana)   2 no está la fuente pedida
//   3 no hay ningún compresor H.264 (¿Windows N sin Media Feature Pack?)
//   4 falló varias veces seguidas y se rindió       5 no conecta a LiveKit
mod captura;
mod miniaturas;
mod mf;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, sync_channel, Receiver, RecvTimeoutError, Sender, SyncSender};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use captura::Aviso;
use windows::core::Interface;
use windows::Win32::Graphics::Dxgi::IDXGIDevice;
use livekit::options::{TrackPublishOptions, VideoEncoding};
use livekit::prelude::*;
use livekit::webrtc::video_source::EncodedRateControl;
use livekit_api::access_token::{AccessToken, VideoGrants};
use livekit_capture::encoded::{EncodedFrameType, EncodedVideoCodec, EncodedVideoPump, EncodedVideoSource, OwnedEncodedAccessUnit};
use livekit_capture::error::SourceError;
use livekit_capture::primitive::VideoResolution;
use livekit_capture::pump::PumpStop;

struct Fuente {
    rx: Receiver<mf::Salida>,
    pedidos: Arc<mf::Pedidos>,
    inicio: Instant,
    cuadros: u64,
    bytes: u64,
    aviso: Instant,
}

impl EncodedVideoSource for Fuente {
    fn resolution(&self) -> VideoResolution {
        let t = self.pedidos.tamano.load(Ordering::Relaxed);
        VideoResolution { width: (t >> 32) as u32, height: t as u32 }
    }

    fn codec(&self) -> EncodedVideoCodec {
        EncodedVideoCodec::H264
    }

    fn next_access_unit(&mut self, stop: &PumpStop) -> Result<Option<OwnedEncodedAccessUnit>, SourceError> {
        // mientras el supervisor rearma la tubería no llega nada: se sigue esperando, la pista no se corta
        let s = loop {
            if stop.is_stopped() {
                return Ok(None);
            }
            match self.rx.recv_timeout(Duration::from_millis(50)) {
                Ok(s) => break s,
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => return Ok(None),
            }
        };
        self.cuadros += 1;
        self.bytes += s.datos.len() as u64;
        if self.aviso.elapsed() > Duration::from_secs(5) {
            self.aviso = Instant::now();
            let t = self.inicio.elapsed().as_secs_f64();
            println!("{} cuadros, {:.1} fps, {:.1} Mbps (promedio), LiveKit permite {:.1}", self.cuadros, self.cuadros as f64 / t, self.bytes as f64 * 8.0 / t / 1e6, self.pedidos.permitido.load(Ordering::Relaxed) as f64 / 1e6);
        }
        let tipo = if s.clave { EncodedFrameType::Key } else { EncodedFrameType::Delta };
        Ok(Some(OwnedEncodedAccessUnit::new(EncodedVideoCodec::H264, s.datos, s.us, tipo, self.resolution())))
    }

    fn request_keyframe(&mut self) {
        self.pedidos.keyframe.store(true, Ordering::Relaxed);
    }

    fn update_rate_control(&mut self, objetivo: EncodedRateControl) {
        // LiveKit baja el bitrate si la red no da; nunca por encima de lo que eligió el usuario
        let bps = (objetivo.target_bitrate_bps as u32).clamp(500_000, self.pedidos.tope.load(Ordering::Relaxed));
        self.pedidos.bitrate.store(bps, Ordering::Relaxed);
        self.pedidos.permitido.store(bps, Ordering::Relaxed);
    }
}

struct Config {
    que: String,
    fps: u32,
    mbps: u32,
    /// alto máximo del video (720 o 1080); el ancho sale de 16:9
    alto: u32,
}

/// Tope de la pista publicada; la calidad elegida va por debajo.
const MAX_MBPS: u32 = 20;

enum Falla {
    SinVentana(String),
    SinCodificador(String),
    Otra(String),
}

/// Dispositivo + captura + codificador. Si algo falla se tira entera y se arma otra.
struct Tuberia {
    captura: captura::Captura,
    parar: Arc<AtomicBool>,
    hilo: JoinHandle<()>,
    salida: (u32, u32),
    /// los que salen de verdad (por software, como mucho 30)
    fps: u32,
}

impl Tuberia {
    /// `salida` = tamaño fijo del video; None la primera vez (sale de lo que se captura).
    fn armar(c: &Config, salida: Option<(u32, u32)>, tx: SyncSender<mf::Salida>, pedidos: Arc<mf::Pedidos>, avisos: Sender<Aviso>) -> Result<Self, Falla> {
        let otra = |e: windows::core::Error| Falla::Otra(e.message());
        let d = captura::dispositivo().map_err(otra)?;
        let placa = unsafe { d.cast::<IDXGIDevice>().and_then(|x| x.GetAdapter()).and_then(|a| a.GetDesc()) }.map_err(otra)?;
        let n = placa.Description.iter().position(|&c| c == 0).unwrap_or(placa.Description.len());
        println!("placa: {}", String::from_utf16_lossy(&placa.Description[..n]));
        let (item, ventana, nombre) = captura::elegir(&c.que).map_err(|e| Falla::SinVentana(e.message()))?;
        let sin = |e: windows::core::Error| Falla::SinCodificador(e.message());
        let mut mft = mf::buscar(&d).map_err(sin)?;
        let (cod, salida, fps) = loop {
            // por software la CPU no da para más que 720p30 (también al rearmar y al cambiar la calidad en vivo)
            let (alto, fps) = if mft.software { (c.alto.min(720), c.fps.min(30)) } else { (c.alto, c.fps) };
            let salida = match salida {
                Some(s) if s.1 <= alto => s,
                _ => captura::tamano_salida(&item, (alto * 16 / 9, alto)).map_err(otra)?,
            };
            let (software, nombre) = (mft.software, mft.nombre.clone());
            match mf::Codificador::new(&d, mft, salida, fps, c.mbps * 1_000_000) {
                Ok(cod) => break (cod, salida, fps),
                // la placa tiene uno pero no se deja configurar (p. ej. límite de sesiones NVENC): se prueba el de software
                Err(e) if !software => {
                    println!("{nombre} (hardware) falló: {}; uso software", e.message());
                    mft = mf::buscar_software().map_err(|s| Falla::SinCodificador(format!("{}; por software: {}", e.message(), s.message())))?;
                }
                Err(e) => return Err(sin(e)),
            }
        };
        if cod.software {
            println!("codificador: {} (software, máx. 720p30)", cod.nombre);
        } else {
            println!("codificador: {} (hardware)", cod.nombre);
        }
        println!("capturando {nombre} a {}x{}, {} fps, {} Mbps con {}", salida.0, salida.1, fps, c.mbps, cod.nombre);
        let (tx_tex, rx_tex) = sync_channel(2);
        let parar = Arc::new(AtomicBool::new(false));
        let (p, a, pd) = (parar.clone(), avisos.clone(), pedidos.clone());
        // el codificador tiene su propio hilo: GetEvent bloquea
        let hilo = std::thread::spawn(move || {
            if let Err(e) = cod.correr(rx_tex, tx, pd, p) {
                let _ = a.send(Aviso::Error(format!("codificador: {}", e.message())));
            }
        });
        match captura::empezar(&d, &item, ventana, salida, fps, tx_tex, avisos) {
            Ok(captura) => {
                pedidos.tamano.store((salida.0 as u64) << 32 | salida.1 as u64, Ordering::Relaxed);
                Ok(Self { captura, parar, hilo, salida, fps })
            }
            Err(e) => {
                parar.store(true, Ordering::Relaxed);
                let _ = hilo.join();
                Err(otra(e))
            }
        }
    }

    fn cerrar(self) {
        self.parar.store(true, Ordering::Relaxed);
        drop(self.captura);
        let _ = self.hilo.join();
    }
}

/// Mantiene viva la tubería: ante un error la rearma (con espera creciente) sin tocar la pista de LiveKit.
/// Devuelve el código de salida.
/// `cambios`: calidad nueva pedida por la app (fps, mbps, alto) sin cortar la transmisión.
fn supervisar(mut c: Config, mut t: Tuberia, tx: SyncSender<mf::Salida>, pedidos: Arc<mf::Pedidos>, avisos: (Sender<Aviso>, Receiver<Aviso>), cambios: Receiver<(u32, u32, u32)>, fin: &AtomicBool) -> i32 {
    let (tx_av, rx_av) = avisos;
    let mut fallas_seguidas = 0;
    let mut desde = Instant::now();
    loop {
        if let Ok((fps, mbps, alto)) = cambios.try_recv() {
            let tope = mbps.min(MAX_MBPS) * 1_000_000;
            pedidos.tope.store(tope, Ordering::Relaxed);
            // el codificador toma el nuevo enseguida: sin esperar a que LiveKit mande otro objetivo
            let permitido = pedidos.permitido.load(Ordering::Relaxed);
            pedidos.bitrate.store(if permitido == 0 { tope } else { permitido.min(tope) }, Ordering::Relaxed);
            if (fps, alto) != (c.fps, c.alto) {
                // otro tamaño o fps: se arma la tubería de nuevo (la pista de LiveKit sigue, el que mira ve un corte de un instante)
                let antes = (c.fps, c.alto);
                (c.fps, c.alto, c.mbps) = (fps, alto, mbps);
                t.cerrar();
                while rx_av.try_recv().is_ok() {}
                t = match Tuberia::armar(&c, None, tx.clone(), pedidos.clone(), tx_av.clone()) {
                    Ok(nueva) => nueva,
                    Err(_) => {
                        println!("no se pudo cambiar la calidad; sigo con la de antes");
                        (c.fps, c.alto) = antes;
                        match Tuberia::armar(&c, None, tx.clone(), pedidos.clone(), tx_av.clone()) {
                            Ok(nueva) => nueva,
                            Err(_) => return 4,
                        }
                    }
                };
                println!("calidad cambiada: {}p, {} fps, {} Mbps", t.salida.1, t.fps, c.mbps);
            }
        }
        let aviso = match rx_av.recv_timeout(Duration::from_millis(200)) {
            Ok(a) => a,
            Err(_) if fin.load(Ordering::Relaxed) => {
                t.cerrar();
                return 0;
            }
            Err(_) if !t.captura.viva() => {
                println!("se cerró la ventana que se transmitía; fin");
                t.cerrar();
                return 0;
            }
            Err(_) => continue,
        };
        let Aviso::Error(motivo) = aviso;
        let salida = t.salida;
        t.cerrar();
        // avisos viejos de la tubería que se acaba de tirar
        while rx_av.try_recv().is_ok() {}
        if desde.elapsed() > Duration::from_secs(60) {
            fallas_seguidas = 0; // anduvo un rato: se cuenta de cero
        }
        loop {
            fallas_seguidas += 1;
            if fallas_seguidas > 5 {
                println!("falló {} veces seguidas ({motivo}); me rindo", fallas_seguidas - 1);
                return 4;
            }
            let espera = Duration::from_millis(500 * fallas_seguidas);
            println!("falla: {motivo}; rearmo en {} ms (intento {fallas_seguidas})", espera.as_millis());
            std::thread::sleep(espera);
            match Tuberia::armar(&c, Some(salida), tx.clone(), pedidos.clone(), tx_av.clone()) {
                Ok(nueva) => {
                    t = nueva;
                    desde = Instant::now();
                    break;
                }
                Err(Falla::SinVentana(_)) => {
                    println!("lo que se transmitía ya no está; fin");
                    return 0;
                }
                Err(Falla::SinCodificador(e) | Falla::Otra(e)) => {
                    println!("no se pudo rearmar: {e}");
                }
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("--miniaturas") {
        miniaturas::correr(&args[2..]);
    }
    let sala = args.get(1).expect("uso: transmisor <sala> [pantalla|monitor:<dispositivo>|ventana:<hwnd>] [fps] [mbps] [alto]").clone();
    let c = Config {
        que: args.get(2).cloned().unwrap_or_else(|| "pantalla".into()),
        fps: args.get(3).and_then(|x| x.parse().ok()).unwrap_or(60),
        mbps: args.get(4).and_then(|x| x.parse().ok()).unwrap_or(12),
        alto: args.get(5).and_then(|x| x.parse().ok()).unwrap_or(1080),
    };

    let (tx_h264, rx_h264) = sync_channel(8);
    let pedidos = Arc::new(mf::Pedidos::default());
    pedidos.tope.store(c.mbps.min(MAX_MBPS) * 1_000_000, Ordering::Relaxed);
    let (tx_av, rx_av) = channel();
    // se arma antes de conectar: si la placa no puede, la app se entera enseguida y usa su transmisión
    let t = match Tuberia::armar(&c, None, tx_h264.clone(), pedidos.clone(), tx_av.clone()) {
        Ok(t) => t,
        Err(Falla::SinVentana(e)) => salir(2, &e),
        Err(Falla::SinCodificador(e)) => salir(3, &format!("no hay ningún compresor H.264: {e}")),
        Err(Falla::Otra(e)) => salir(4, &e),
    };
    if sala == "--probar" {
        return probar(t, rx_h264, rx_av);
    }

    // Desde la app: el servidor da el token (THUNDEROP_TOKEN) y la app corta cerrando stdin.
    // A mano (probar.ps1): se arma con las claves de LiveKit y se corta con Ctrl+C.
    let env = |k: &str| std::env::var(k).unwrap_or_else(|_| panic!("falta {k}"));
    let desde_app = std::env::var("THUNDEROP_TOKEN").is_ok();
    let (url, token) = if desde_app {
        (env("THUNDEROP_URL"), env("THUNDEROP_TOKEN"))
    } else {
        let token = AccessToken::with_api_key(&env("LIVEKIT_API_KEY"), &env("LIVEKIT_API_SECRET"))
            .with_identity("nativo-prueba")
            .with_name("Prueba nativa")
            .with_grants(VideoGrants { room_join: true, room: sala.clone(), can_publish: Some(true), can_subscribe: Some(false), ..Default::default() })
            .to_jwt()
            .unwrap();
        (env("LIVEKIT_URL"), token)
    };
    let room = Arc::new(match Room::connect(&url, &token, RoomOptions::default()).await {
        Ok((room, _eventos)) => room,
        Err(e) => {
            t.cerrar();
            salir(5, &format!("no conecta a LiveKit: {e}"))
        }
    });
    println!("conectado a la sala {sala}");

    let fuente = Fuente { rx: rx_h264, pedidos: pedidos.clone(), inicio: Instant::now(), cuadros: 0, bytes: 0, aviso: Instant::now() };
    let pump = EncodedVideoPump::new(fuente);
    let pista = LocalVideoTrack::create_video_track("pantalla", pump.rtc_source());
    // sin video_encoding, LiveKit usa sus presets de pantalla (1,5-3 Mbps, pensados para documentos) y
    // le pide eso al codificador: en un juego en movimiento pixela. Acá va el tope elegido.
    let opciones = TrackPublishOptions {
        source: TrackSource::Screenshare,
        // con el máximo: si después se sube la calidad en vivo, el tope real lo pone `pedidos.tope`
        video_encoding: Some(VideoEncoding { max_bitrate: MAX_MBPS as u64 * 1_000_000, max_framerate: 60.0 }),
        ..pump.publish_options()
    };
    room.local_participant().publish_track(LocalTrack::Video(pista), opciones).await.expect("no publica");
    // Al arrancar suele haber un pico de congestión (keyframe + sondeos): el estimador cae al 85 % de lo que
    // pasaba (~4 Mbps) y de ahí sube de a poco, ~75 s hasta el tope. En los primeros segundos se lo vuelve a
    // arrancar en el tope si quedó abajo; si la red de verdad no da, vuelve a bajar solo.
    {
        let (room, pedidos) = (room.clone(), pedidos.clone());
        tokio::spawn(async move {
            let inicio = tokio::time::Instant::now();
            for seg in [2, 4, 7, 11, 16] {
                tokio::time::sleep_until(inicio + Duration::from_secs(seg)).await;
                let ahora = pedidos.permitido.load(Ordering::Relaxed) as u64;
                let tope = pedidos.tope.load(Ordering::Relaxed) as u64;
                if ahora * 10 < tope * 8 {
                    println!("estimador en {:.1} Mbps, se lo arranca de nuevo en {:.1}", ahora as f64 / 1e6, tope as f64 / 1e6);
                    let _ = room.set_publisher_start_bitrate(tope);
                }
            }
        });
    }
    let corriendo = pump.spawn().unwrap();
    println!("transmitiendo; Ctrl+C para cortar");

    // Desde la app, cada línea de stdin "calidad <fps> <mbps> <alto>" cambia la calidad; cerrarlo corta.
    let (tx_cambio, rx_cambio) = channel();
    let (tx_cerro, rx_cerro) = tokio::sync::oneshot::channel::<()>();
    if desde_app {
        std::thread::spawn(move || {
            for linea in std::io::stdin().lines().map_while(Result::ok) {
                let n: Vec<u32> = linea.split_whitespace().skip(1).filter_map(|x| x.parse().ok()).collect();
                if linea.starts_with("calidad ") && n.len() == 3 {
                    let _ = tx_cambio.send((n[0], n[1], n[2]));
                }
            }
            let _ = tx_cerro.send(());
        });
    }
    let fin = Arc::new(AtomicBool::new(false));
    let f = fin.clone();
    let mut supervisor = tokio::task::spawn_blocking(move || supervisar(c, t, tx_h264, pedidos, (tx_av, rx_av), rx_cambio, &f));
    let cortar = async {
        if desde_app {
            let _ = rx_cerro.await;
        } else {
            let _ = tokio::signal::ctrl_c().await;
        }
    };
    let codigo = tokio::select! {
        _ = cortar => {
            fin.store(true, Ordering::Relaxed);
            supervisor.await.unwrap_or(0)
        }
        r = &mut supervisor => r.unwrap_or(4),
    };
    let _ = corriendo.stop_and_join().await;
    room.close().await.ok();
    std::process::exit(codigo);
}

fn salir(codigo: i32, motivo: &str) -> ! {
    eprintln!("{motivo}");
    std::process::exit(codigo)
}

fn probar(t: Tuberia, rx_h264: Receiver<mf::Salida>, rx_av: Receiver<Aviso>) {
    let fin = Instant::now() + Duration::from_secs(3);
    let (mut cuadros, mut claves, mut bytes) = (0, 0, 0);
    while let Ok(s) = rx_h264.recv_timeout(fin.saturating_duration_since(Instant::now())) {
        cuadros += 1;
        claves += s.clave as u32;
        bytes += s.datos.len();
    }
    t.cerrar();
    let error = rx_av.try_iter().map(|Aviso::Error(e)| e).next();
    if cuadros > 0 && claves > 0 {
        println!("OK: {cuadros} cuadros en 3 s ({claves} completos), {:.1} Mbps", bytes as f64 * 8.0 / 3.0 / 1e6);
    } else {
        println!("FALLÓ: {cuadros} cuadros, {claves} completos{}", error.map(|e| format!(", error: {e}")).unwrap_or_default());
        std::process::exit(4);
    }
}
