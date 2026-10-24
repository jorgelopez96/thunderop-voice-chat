// Transmisor nativo (nativo/transmisor): proceso aparte que captura la pantalla o una ventana, la comprime con la
// placa de video y la publica en LiveKit con su propio token. La app lo prende, lo corta cerrándole stdin y se
// entera de cómo terminó por el código de salida (ver nativo/transmisor/src/main.rs).
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{ChildStdin, Command, Stdio};
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::Channel;

#[derive(Default)]
pub struct Transmisor(Mutex<Option<ChildStdin>>);

#[derive(Clone, Serialize)]
#[serde(tag = "tipo", rename_all = "camelCase")]
pub enum Estado {
    /// ya publicó la pista
    Transmitiendo,
    /// terminó; -1 si no hay código (lo mataron)
    Fin { codigo: i32 },
}

/// Tauri lo instala al lado del ejecutable de la app (`bundle.externalBin`).
fn ruta() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe.with_file_name("transmisor.exe"))
}

fn comando() -> Result<Command, String> {
    let mut c = Command::new(ruta()?);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    Ok(c)
}

#[derive(Serialize)]
pub struct Ventana {
    pid: u32,
    titulo: String,
}

/// Ventanas que se pueden transmitir, con el proceso de cada una (para su sonido).
#[tauri::command]
pub async fn ventanas_transmisor() -> Result<Vec<Ventana>, String> {
    let out = comando()?.arg("--ventanas").output().map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter_map(|l| l.split_once('\t'))
        .filter_map(|(p, t)| Some(Ventana { pid: p.parse().ok()?, titulo: t.to_owned() }))
        .filter(|v| !v.titulo.trim().is_empty())
        .collect())
}

/// `que`: "pantalla" o parte del título de una ventana.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn iniciar_transmisor(url: String, token: String, que: String, fps: u32, mbps: u32, alto: u32, canal: Channel<Estado>, estado: tauri::State<Transmisor>) -> Result<(), String> {
    detener(&estado);
    let mut hijo = comando()?
        .args(["app", &que, &fps.to_string(), &mbps.to_string(), &alto.to_string()])
        .env("THUNDEROP_URL", url)
        .env("THUNDEROP_TOKEN", token)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;
    let salida = hijo.stdout.take().ok_or("sin stdout")?;
    *estado.0.lock().unwrap() = hijo.stdin.take();
    // lo que dice el transmisor (fps, Mbps, fallas) queda en %TEMP%\thunderop-transmisor.log para diagnosticar
    let mut registro = std::fs::File::create(std::env::temp_dir().join("thunderop-transmisor.log")).ok();
    std::thread::spawn(move || {
        use std::io::Write;
        // se lee hasta el final aunque ya haya arrancado: si el caño se llena, el transmisor se traba
        for linea in BufReader::new(salida).lines().map_while(Result::ok) {
            if let Some(r) = registro.as_mut() {
                let _ = writeln!(r, "{linea}");
            }
            if linea.starts_with("transmitiendo") {
                let _ = canal.send(Estado::Transmitiendo);
            }
        }
        let codigo = hijo.wait().ok().and_then(|s| s.code()).unwrap_or(-1);
        let _ = canal.send(Estado::Fin { codigo });
    });
    Ok(())
}

/// Calidad nueva sin cortar: el transmisor lee "calidad <fps> <mbps> <alto>" por stdin.
#[tauri::command]
pub fn calidad_transmisor(fps: u32, mbps: u32, alto: u32, estado: tauri::State<Transmisor>) -> Result<(), String> {
    use std::io::Write;
    let mut e = estado.0.lock().unwrap();
    let stdin = e.as_mut().ok_or("no está transmitiendo")?;
    writeln!(stdin, "calidad {fps} {mbps} {alto}").and_then(|_| stdin.flush()).map_err(|e| e.to_string())
}

/// Cerrarle stdin es la señal de cortar: sale de la sala prolijo y termina con código 0.
#[tauri::command]
pub fn detener_transmisor(estado: tauri::State<Transmisor>) {
    detener(&estado);
}

fn detener(estado: &Transmisor) {
    estado.0.lock().unwrap().take();
}
