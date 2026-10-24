// Modo `--miniaturas <ancho> [pid a excluir]`: una línea JSON por fuente que se puede transmitir, primero los
// monitores y después las ventanas (de adelante hacia atrás), con una imagen chica de cada una en PNG/base64.
// Lo lee el selector de la app. Un cuadro de WGC por fuente, todas a la vez; la ventana que no da cuadro se
// prueba con PrintWindow; la que tampoco sale sin imagen.
use std::sync::mpsc::{channel, Receiver};
use std::time::{Duration, Instant};

use base64::Engine;
use windows::core::Result;
use windows::Graphics::Capture::GraphicsCaptureItem;
use windows::Win32::Graphics::Imaging::{CLSID_WICImagingFactory, IWICImagingFactory, GUID_ContainerFormatPng, GUID_WICPixelFormat32bppBGRA, WICBitmapEncoderNoCache};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, STREAM_SEEK_CUR};
use windows::Win32::System::WinRT::Graphics::Capture::IGraphicsCaptureItemInterop;
use windows::Win32::UI::HiDpi::{SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2};

use crate::captura;

/// Píxeles BGRA sin relleno, ancho y alto.
type Imagen = (Vec<u8>, usize, usize);

/// Hasta cuándo se espera a los cuadros de WGC y, después, a los de PrintWindow (desde que arranca).
const ESPERA_WGC: Duration = Duration::from_millis(1500);
const ESPERA_PRINT: Duration = Duration::from_millis(2300);
/// Pase lo que pase (p. ej. una ventana colgada que traba PrintWindow), el proceso termina antes de 3 s.
const MAXIMO: Duration = Duration::from_millis(2800);

struct Fuente {
    tipo: &'static str,
    id: String,
    titulo: String,
    pid: u32,
    item: Option<GraphicsCaptureItem>,
    /// hwnd de la ventana, para PrintWindow
    ventana: Option<isize>,
}

pub fn correr(args: &[String]) -> ! {
    let inicio = Instant::now();
    std::thread::spawn(|| {
        std::thread::sleep(MAXIMO);
        std::process::exit(0)
    });
    // sin esto Windows da los tamaños achicados por la escala de pantalla (1536×864 en vez de 1920×1080)
    let _ = unsafe { SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) };
    let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    let ancho = args.first().and_then(|x| x.parse().ok()).unwrap_or(320usize).max(1);
    let excluir = args.get(1).and_then(|x| x.parse().ok()).unwrap_or(0);

    let interop = windows::core::factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>().ok();
    let mut fuentes = Vec::new();
    for (i, m) in captura::monitores().iter().enumerate() {
        fuentes.push(Fuente {
            tipo: "monitor",
            id: m.dispositivo.clone(),
            titulo: format!("Pantalla {}{} · {}×{}", i + 1, if m.principal { " (principal)" } else { "" }, m.ancho, m.alto),
            pid: 0,
            item: interop.as_ref().and_then(|x| unsafe { x.CreateForMonitor(m.hmon) }.ok()),
            ventana: None,
        });
    }
    for (h, titulo, pid) in captura::ventanas(excluir) {
        fuentes.push(Fuente {
            tipo: "ventana",
            id: (h.0 as isize).to_string(),
            titulo: if captura::minimizada(h) { format!("{titulo} (minimizada)") } else { titulo },
            pid,
            item: interop.as_ref().and_then(|x| unsafe { x.CreateForWindow(h) }.ok()),
            ventana: Some(h.0 as isize),
        });
    }

    let (tx, rx) = channel();
    let mut imagenes: Vec<Option<Imagen>> = vec![None; fuentes.len()];
    // todas las sesiones a la vez; cada una manda su cuadro ya achicado
    let capturas: Vec<_> = match captura::dispositivo_sin_prioridad() {
        Ok(d) => fuentes
            .iter()
            .enumerate()
            .filter_map(|(i, f)| {
                let tx = tx.clone();
                captura::un_cuadro(&d, f.item.as_ref()?, move |px, pitch, w, h| {
                    let _ = tx.send((i, achicar_bgra(px, pitch, w, h, ancho)));
                })
                .ok()
            })
            .collect(),
        Err(_) => Vec::new(),
    };
    recibir(&rx, &mut imagenes, capturas.len(), inicio + ESPERA_WGC);

    let faltan: Vec<(usize, isize)> = fuentes.iter().enumerate().filter(|(i, _)| imagenes[*i].is_none()).filter_map(|(i, f)| Some((i, f.ventana?))).collect();
    for &(i, h) in &faltan {
        let tx = tx.clone();
        std::thread::spawn(move || {
            captura::imprimir_ventana(h, |px, pitch, w, alto| {
                let _ = tx.send((i, achicar_bgra(px, pitch, w, alto, ancho)));
            })
        });
    }
    recibir(&rx, &mut imagenes, faltan.len(), inicio + ESPERA_PRINT);

    let wic: Option<IWICImagingFactory> = unsafe { CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER) }.ok();
    for (f, img) in fuentes.iter().zip(imagenes) {
        let b64 = wic.as_ref().zip(img).and_then(|(wic, mut img)| png(wic, &mut img).ok()).map(|x| base64::engine::general_purpose::STANDARD.encode(x));
        println!("{}", linea(f.tipo, &f.id, &f.titulo, f.pid, b64.as_deref()));
    }
    drop(capturas);
    std::process::exit(0)
}

/// Junta hasta `cuantas` respuestas o hasta `hasta`, lo que pase primero.
fn recibir(rx: &Receiver<(usize, Imagen)>, imagenes: &mut [Option<Imagen>], cuantas: usize, hasta: Instant) {
    for _ in 0..cuantas {
        match rx.recv_timeout(hasta.saturating_duration_since(Instant::now())) {
            Ok((i, img)) if img.1 > 0 => {
                imagenes[i].get_or_insert(img);
            }
            Ok(_) => {}
            Err(_) => return,
        }
    }
}

fn linea(tipo: &str, id: &str, titulo: &str, pid: u32, png_base64: Option<&str>) -> String {
    serde_json::json!({ "tipo": tipo, "id": id, "titulo": titulo, "pid": pid, "png_base64": png_base64 }).to_string()
}

/// Achica una imagen BGRA (filas de `pitch` bytes) a `ancho_nuevo` de ancho sin deformarla, promediando
/// bloques. No agranda. Devuelve los píxeles sin relleno, el ancho y el alto.
pub fn achicar_bgra(origen: &[u8], pitch: usize, ancho: usize, alto: usize, ancho_nuevo: usize) -> (Vec<u8>, usize, usize) {
    if ancho == 0 || alto == 0 {
        return (Vec::new(), 0, 0);
    }
    let w = ancho_nuevo.clamp(1, ancho);
    let h = (alto * w / ancho).max(1);
    let tramo = |i: usize, n: usize, total: usize| (i * total / n, ((i + 1) * total / n).max(i * total / n + 1));
    let mut px = Vec::with_capacity(w * h * 4);
    for y in 0..h {
        let (y0, y1) = tramo(y, h, alto);
        for x in 0..w {
            let (x0, x1) = tramo(x, w, ancho);
            let mut suma = [0u32; 4];
            for fila in y0..y1 {
                for p in origen[fila * pitch + x0 * 4..fila * pitch + x1 * 4].chunks_exact(4) {
                    for c in 0..4 {
                        suma[c] += p[c] as u32;
                    }
                }
            }
            let n = ((y1 - y0) * (x1 - x0)) as u32;
            px.extend(suma.map(|s| (s / n) as u8));
        }
    }
    (px, w, h)
}

/// PNG en memoria con WIC. Sale opaca: GDI y algunas ventanas dejan el canal alfa en 0.
fn png(wic: &IWICImagingFactory, (px, w, h): &mut Imagen) -> Result<Vec<u8>> {
    for p in px.chunks_exact_mut(4) {
        p[3] = 255;
    }
    // entra siempre: un PNG sin comprimir ocupa los píxeles + 1 byte por fila + unos pocos por bloque
    let mut buf = vec![0u8; px.len() + *h + 65_536];
    let largo = unsafe {
        let stream = wic.CreateStream()?;
        stream.InitializeFromMemory(std::slice::from_raw_parts_mut(buf.as_mut_ptr(), buf.len()))?;
        let enc = wic.CreateEncoder(&GUID_ContainerFormatPng, std::ptr::null())?;
        enc.Initialize(&stream, WICBitmapEncoderNoCache)?;
        let (mut cuadro, mut opciones) = (None, None);
        enc.CreateNewFrame(&mut cuadro, &mut opciones)?;
        let cuadro = cuadro.unwrap();
        cuadro.Initialize(opciones.as_ref())?;
        cuadro.SetSize(*w as u32, *h as u32)?;
        let mut formato = GUID_WICPixelFormat32bppBGRA;
        cuadro.SetPixelFormat(&mut formato)?;
        if formato != GUID_WICPixelFormat32bppBGRA {
            return Err(windows::Win32::Foundation::E_FAIL.into());
        }
        cuadro.WritePixels(*h as u32, (*w * 4) as u32, px)?;
        cuadro.Commit()?;
        enc.Commit()?;
        let mut largo = 0;
        stream.Seek(0, STREAM_SEEK_CUR, Some(&mut largo))?;
        largo as usize
    };
    buf.truncate(largo);
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_de_fuente() {
        let titulo = r#"Juego "Ñandú" C:\juegos\á"#;
        let l = linea("ventana", "1234", titulo, 42, None);
        assert!(!l.contains('\n'));
        let v: serde_json::Value = serde_json::from_str(&l).unwrap();
        assert_eq!(v["tipo"], "ventana");
        assert_eq!(v["id"], "1234");
        assert_eq!(v["titulo"], titulo);
        assert_eq!(v["pid"], 42);
        assert!(v["png_base64"].is_null());
    }

    #[test]
    fn achica_bgra() {
        let rojo = [0u8, 0, 255, 255];
        // 4×2 con 4 bytes de relleno por fila (pitch 20)
        let mut origen = Vec::new();
        for _ in 0..2 {
            for _ in 0..4 {
                origen.extend_from_slice(&rojo);
            }
            origen.extend_from_slice(&[7; 4]);
        }
        let (px, w, h) = achicar_bgra(&origen, 20, 4, 2, 2);
        assert_eq!((w, h, px.len()), (2, 1, 8));
        assert!(px.chunks(4).all(|p| p == rojo));
        // no agranda
        let (px, w, h) = achicar_bgra(&[1; 16], 8, 2, 2, 4);
        assert_eq!((w, h, px.len()), (2, 2, 16));
    }
}
