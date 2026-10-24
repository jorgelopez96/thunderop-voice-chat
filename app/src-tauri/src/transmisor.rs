// Transmisor nativo (nativo/transmisor): proceso aparte que captura la pantalla o una ventana, la comprime con la
// placa de video y la publica en LiveKit con su propio token. La app lo prende, lo corta cerrándole stdin y se
// entera de cómo terminó por el código de salida (ver nativo/transmisor/src/main.rs).
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

#[derive(Default)]
pub struct Transmisor(Mutex<Option<ChildStdin>>);

#[derive(Clone, Serialize)]
#[serde(tag = "tipo", rename_all = "camelCase")]
pub enum Estado {
    /// ya publicó la pista
    Transmitiendo,
    /// terminó; -1 si no hay código (lo mataron); `registro` = lo que dijo esa transmisión
    Fin { codigo: i32, registro: String },
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

#[derive(Serialize, Deserialize)]
pub struct Fuente {
    tipo: String,
    id: String,
    titulo: String,
    pid: u32,
    png_base64: Option<String>,
    #[serde(default)]
    icono_base64: Option<String>,
}

/// Una línea JSON por fuente; lo que no se entiende se ignora.
pub fn parsear_fuentes(s: &str) -> Vec<Fuente> {
    s.lines()
        .filter_map(|l| serde_json::from_str::<Fuente>(l).ok())
        .filter(|f| f.tipo == "monitor" || f.tipo == "ventana")
        .collect()
}

/// Monitores y ventanas que se pueden transmitir, con su miniatura de `ancho` px.
#[tauri::command]
pub async fn fuentes_transmisor(ancho: u32) -> Result<Vec<Fuente>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut hijo = comando()?
            .args(["--miniaturas", &ancho.to_string(), &std::process::id().to_string()])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;
        let mut salida = hijo.stdout.take().ok_or("sin stdout")?;
        let lector = std::thread::spawn(move || {
            let mut b = Vec::new();
            let _ = salida.read_to_end(&mut b);
            b
        });
        // el transmisor se corta solo a los 2,8 s; esto es por si se cuelga
        let limite = Instant::now() + Duration::from_secs(4);
        while hijo.try_wait().map_err(|e| e.to_string())?.is_none() {
            if Instant::now() > limite {
                let _ = hijo.kill();
                let _ = hijo.wait();
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        let bytes = lector.join().map_err(|_| "falló la lectura")?;
        let fuentes = parsear_fuentes(&String::from_utf8_lossy(&bytes));
        if fuentes.is_empty() {
            return Err("el transmisor no devolvió fuentes".into());
        }
        Ok(fuentes)
    })
    .await
    .map_err(|e| e.to_string())?
}

const REGISTRO_CABEZA: usize = 8_000;
const REGISTRO_COLA: usize = 52_000;

/// Registro de una transmisión para `Estado::Fin`: el principio y el final; lo del medio solo queda en el archivo.
#[derive(Default)]
struct Registro {
    cabeza: String,
    cola: String,
    cortado: bool,
}

impl Registro {
    fn agregar(&mut self, linea: &str) {
        let destino = if self.cabeza.len() < REGISTRO_CABEZA { &mut self.cabeza } else { &mut self.cola };
        destino.push_str(linea);
        destino.push('\n');
        if self.cola.len() > REGISTRO_COLA {
            let mut corte = self.cola.len() - REGISTRO_COLA;
            while !self.cola.is_char_boundary(corte) {
                corte += 1;
            }
            self.cola.drain(..corte);
            self.cortado = true;
        }
    }

    fn texto(&self) -> String {
        let marca = if self.cortado { "\n[…]\n" } else { "" };
        format!("{}{marca}{}", self.cabeza, self.cola)
    }
}

/// Llama a `f` con cada línea hasta el EOF; los bytes que no son UTF-8 no cortan la lectura.
fn leer_lineas(mut origen: impl BufRead, mut f: impl FnMut(&str)) {
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match origen.read_until(b'\n', &mut buf) {
            Ok(0) | Err(_) => break,
            Ok(_) => f(String::from_utf8_lossy(&buf).trim_end_matches(['\n', '\r'])),
        }
    }
}

/// `que`: "monitor:<id>" o "ventana:<id>".
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn iniciar_transmisor(url: String, token: String, que: String, fps: u32, mbps: u32, alto: u32, canal: Channel<Estado>, estado: tauri::State<Transmisor>) -> Result<(), String> {
    detener(&estado);
    // lo que dice el transmisor (fps, Mbps, fallas y por qué se cortó) queda en %TEMP%\thunderop-transmisor.log
    // y, para esta transmisión sola, en `Estado::Fin`
    let archivo = std::fs::File::create(std::env::temp_dir().join("thunderop-transmisor.log")).ok().map(|f| Arc::new(Mutex::new(f)));
    let mut hijo = comando()?
        .args(["app", &que, &fps.to_string(), &mbps.to_string(), &alto.to_string()])
        .env("THUNDEROP_URL", url)
        .env("THUNDEROP_TOKEN", token)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let salida = hijo.stdout.take().ok_or("sin stdout")?;
    let errores = hijo.stderr.take().ok_or("sin stderr")?;
    *estado.0.lock().unwrap() = hijo.stdin.take();
    let registro = Arc::new(Mutex::new(Registro::default()));
    // se lee hasta el final aunque ya haya arrancado: si el caño se llena, el transmisor se traba
    let leer = |origen: Box<dyn Read + Send>, avisa: bool| {
        let (archivo, registro, canal) = (archivo.clone(), registro.clone(), canal.clone());
        std::thread::spawn(move || {
            leer_lineas(BufReader::new(origen), |linea| {
                if let Some(a) = &archivo {
                    let _ = writeln!(a.lock().unwrap(), "{linea}");
                }
                registro.lock().unwrap().agregar(linea);
                if avisa && linea.starts_with("transmitiendo") {
                    let _ = canal.send(Estado::Transmitiendo);
                }
            });
        })
    };
    let lectores = [leer(Box::new(salida), true), leer(Box::new(errores), false)];
    std::thread::spawn(move || {
        for l in lectores {
            let _ = l.join();
        }
        let codigo = hijo.wait().ok().and_then(|s| s.code()).unwrap_or(-1);
        let registro = registro.lock().unwrap().texto();
        let _ = canal.send(Estado::Fin { codigo, registro });
    });
    Ok(())
}

/// Calidad nueva sin cortar: el transmisor lee "calidad <fps> <mbps> <alto>" por stdin.
#[tauri::command]
pub fn calidad_transmisor(fps: u32, mbps: u32, alto: u32, estado: tauri::State<Transmisor>) -> Result<(), String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registro_conserva_principio_y_final() {
        let mut r = Registro::default();
        r.agregar("primera");
        assert_eq!(r.texto(), "primera\n");
        for i in 0..20_000 {
            r.agregar(&format!("línea {i}"));
        }
        let t = r.texto();
        assert!(t.starts_with("primera\n"));
        assert!(t.contains("\n[…]\n"));
        assert!(t.ends_with("línea 19999\n"));
        assert!(t.len() < REGISTRO_CABEZA + REGISTRO_COLA + 200);
    }

    #[test]
    fn lee_hasta_el_final_con_bytes_invalidos() {
        let mut v = Vec::new();
        leer_lineas(&b"uno\r\n\xff\xfe roto\ndos"[..], |l| v.push(l.to_owned()));
        assert_eq!(v, ["uno", "\u{fffd}\u{fffd} roto", "dos"]);
    }

    #[test]
    fn parsea_fuentes() {
        let s = [
            r#"{"id":"\\\\.\\DISPLAY1","pid":0,"png_base64":"AAA","tipo":"monitor","titulo":"Pantalla 1"}"#,
            "esto no es json",
            r#"{"id":"123","pid":42,"png_base64":null,"tipo":"ventana","titulo":"Notas"}"#,
            r#"{"id":"x","pid":1,"png_base64":null,"tipo":"otro","titulo":"?"}"#,
        ]
        .join("\n");
        let f = parsear_fuentes(&s);
        assert_eq!(f.len(), 2);
        assert_eq!((f[0].tipo.as_str(), f[0].id.as_str(), f[0].png_base64.as_deref()), ("monitor", r"\\.\DISPLAY1", Some("AAA")));
        assert_eq!((f[1].tipo.as_str(), f[1].id.as_str(), f[1].pid, f[1].png_base64.is_none(), f[1].icono_base64.is_none()), ("ventana", "123", 42, true, true));
        assert_eq!(f[1].titulo, "Notas");
    }
}
