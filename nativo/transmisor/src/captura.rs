// Captura con Windows Graphics Capture (monitor o ventana) y conversión BGRA → NV12 en la GPU.
// Cada cuadro sale como una textura NV12 lista para el codificador; la imagen nunca pasa por la CPU.
use std::mem::ManuallyDrop;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Sender, SyncSender};
use std::sync::Mutex;

use windows::core::{IInspectable, Interface, Result, BOOL};
use windows::Foundation::TypedEventHandler;
use windows::Graphics::Capture::{Direct3D11CaptureFramePool, GraphicsCaptureItem, GraphicsCaptureSession};
use windows::Graphics::DirectX::Direct3D11::IDirect3DDevice;
use windows::Graphics::DirectX::DirectXPixelFormat;
use windows::Graphics::SizeInt32;
use windows::Win32::Foundation::{HMODULE, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Direct3D::D3D_DRIVER_TYPE_HARDWARE;
use windows::Win32::Graphics::Direct3D11::*;
use windows::Win32::Graphics::Dxgi::Common::{DXGI_FORMAT_NV12, DXGI_RATIONAL, DXGI_SAMPLE_DESC};
use windows::Win32::Graphics::Dxgi::IDXGIDevice;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, EnumDisplayMonitors, GdiFlush, GetMonitorInfoW, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HDC, HMONITOR, MONITORINFOEXW,
};
use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};
use windows::Win32::System::WinRT::Direct3D11::{CreateDirect3D11DeviceFromDXGIDevice, IDirect3DDxgiInterfaceAccess};
use windows::Win32::System::WinRT::Graphics::Capture::IGraphicsCaptureItemInterop;
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetWindow, GetWindowLongPtrW, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, GWL_EXSTYLE, GW_OWNER, MONITORINFOF_PRIMARY, PW_RENDERFULLCONTENT, WS_EX_TOOLWINDOW,
};

/// Textura NV12 y su momento de captura en µs (reloj del sistema).
pub type Cuadro = (ID3D11Texture2D, i64);

pub fn dispositivo() -> Result<ID3D11Device> {
    let d = dispositivo_sin_prioridad()?;
    subir_prioridad_gpu(&d);
    Ok(d)
}

/// Para las miniaturas: sin pedir prioridad en la placa (y sin escribir nada en la salida).
pub fn dispositivo_sin_prioridad() -> Result<ID3D11Device> {
    let mut d = None;
    unsafe {
        D3D11CreateDevice(
            None,
            D3D_DRIVER_TYPE_HARDWARE,
            HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT | D3D11_CREATE_DEVICE_VIDEO_SUPPORT,
            None,
            D3D11_SDK_VERSION,
            Some(&mut d),
            None,
            None,
        )?;
        let d = d.unwrap();
        // lo usan a la vez el hilo de captura y el codificador
        let _ = d.cast::<ID3D11Multithread>()?.SetMultithreadProtected(true);
        Ok(d)
    }
}

/// Con un juego que usa la placa al 100 %, Windows le da casi todos los turnos al juego y la captura llega a
/// 15-20 fps aunque se vea nítida. Como OBS: se pide prioridad alta en la placa. Sin permisos de
/// administrador Windows puede negarla; se intenta igual y se avisa cómo quedó.
fn subir_prioridad_gpu(d: &ID3D11Device) {
    use windows::Wdk::Graphics::Direct3D::{D3DKMTSetProcessSchedulingPriorityClass, D3DKMT_SCHEDULINGPRIORITYCLASS_HIGH};
    use windows::Win32::Graphics::Dxgi::IDXGIDevice;
    use windows::Win32::System::Threading::GetCurrentProcess;
    unsafe {
        let proceso = D3DKMTSetProcessSchedulingPriorityClass(GetCurrentProcess(), D3DKMT_SCHEDULINGPRIORITYCLASS_HIGH).is_ok();
        let hilo = d.cast::<IDXGIDevice>().and_then(|x| x.SetGPUThreadPriority(7)).is_ok();
        println!("prioridad en la placa: proceso {}, dispositivo {}", if proceso { "alta" } else { "normal" }, if hilo { "alta" } else { "normal" });
    }
}

/// Qué se transmite: `pantalla` (monitor principal), `monitor:<dispositivo>` (p. ej. `monitor:\\.\DISPLAY2`)
/// o `ventana:<hwnd>`.
pub enum Objetivo {
    Principal,
    Monitor(String),
    Ventana(isize),
}

pub fn objetivo(que: &str) -> Option<Objetivo> {
    if que == "pantalla" {
        return Some(Objetivo::Principal);
    }
    if let Some(x) = que.strip_prefix("monitor:").filter(|x| !x.is_empty()) {
        return Some(Objetivo::Monitor(x.into()));
    }
    que.strip_prefix("ventana:").and_then(|n| n.parse().ok()).filter(|&n| n > 0).map(Objetivo::Ventana)
}

pub struct Monitor {
    pub hmon: HMONITOR,
    /// nombre del dispositivo, p. ej. `\\.\DISPLAY2`: es el id que se pide
    pub dispositivo: String,
    pub principal: bool,
    pub ancho: i32,
    pub alto: i32,
}

pub fn monitores() -> Vec<Monitor> {
    unsafe extern "system" fn uno(h: HMONITOR, _: HDC, _: *mut RECT, l: LPARAM) -> BOOL {
        let lista = &mut *(l.0 as *mut Vec<Monitor>);
        let mut info = MONITORINFOEXW::default();
        info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        if GetMonitorInfoW(h, &mut info.monitorInfo).as_bool() {
            let n = info.szDevice.iter().position(|&c| c == 0).unwrap_or(info.szDevice.len());
            let r = info.monitorInfo.rcMonitor;
            lista.push(Monitor {
                hmon: h,
                dispositivo: String::from_utf16_lossy(&info.szDevice[..n]),
                principal: info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
                ancho: r.right - r.left,
                alto: r.bottom - r.top,
            });
        }
        true.into()
    }
    let mut lista = Vec::new();
    unsafe {
        let _ = EnumDisplayMonitors(None, None, Some(uno), LPARAM(&mut lista as *mut _ as isize));
    }
    lista
}

/// La fuente pedida, la ventana (si es una) y cómo nombrarla en el registro (nunca el título de la ventana).
pub fn elegir(que: &str) -> Result<(GraphicsCaptureItem, Option<HWND>, String)> {
    let no_esta = || windows::core::Error::new(windows::Win32::Foundation::E_INVALIDARG, "no está la fuente pedida");
    let interop = windows::core::factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()?;
    unsafe {
        let m = match objetivo(que).ok_or_else(no_esta)? {
            Objetivo::Ventana(n) => {
                let hwnd = HWND(n as _);
                if !IsWindow(Some(hwnd)).as_bool() {
                    return Err(no_esta());
                }
                return Ok((interop.CreateForWindow(hwnd)?, Some(hwnd), "ventana".into()));
            }
            Objetivo::Principal => monitores().into_iter().find(|m| m.principal),
            Objetivo::Monitor(x) => monitores().into_iter().find(|m| m.dispositivo.eq_ignore_ascii_case(&x)),
        }
        .ok_or_else(no_esta)?;
        Ok((interop.CreateForMonitor(m.hmon)?, None, format!("monitor {}", m.dispositivo)))
    }
}

/// Lo que hace falta de una ventana para decidir si se ofrece en el selector.
pub struct InfoVentana {
    pub titulo: String,
    pub clase: String,
    pub visible: bool,
    pub minimizada: bool,
    /// oculta por DWM (p. ej. en otro escritorio virtual)
    pub oculta: bool,
    pub herramienta: bool,
    pub con_dueno: bool,
    pub pid: u32,
}

pub fn candidata(v: &InfoVentana, excluir: u32) -> bool {
    v.visible
        && !v.minimizada
        && !v.oculta
        && !v.herramienta
        && !v.con_dueno
        && !v.titulo.trim().is_empty()
        && v.clase != "Progman"
        && v.clase != "WorkerW"
        && v.pid != excluir
}

/// Ventanas que se pueden transmitir (de adelante hacia atrás): hwnd, título y pid.
pub fn ventanas(excluir: u32) -> Vec<(HWND, String, u32)> {
    unsafe extern "system" fn una(h: HWND, l: LPARAM) -> BOOL {
        let lista = &mut *(l.0 as *mut Vec<(HWND, InfoVentana)>);
        let mut buf = [0u16; 256];
        let n = GetWindowTextW(h, &mut buf) as usize;
        let mut clase = [0u16; 64];
        let c = GetClassNameW(h, &mut clase) as usize;
        let mut oculta = 0u32;
        let _ = DwmGetWindowAttribute(h, DWMWA_CLOAKED, &mut oculta as *mut _ as _, 4);
        lista.push((
            h,
            InfoVentana {
                titulo: String::from_utf16_lossy(&buf[..n]),
                clase: String::from_utf16_lossy(&clase[..c]),
                visible: IsWindowVisible(h).as_bool(),
                minimizada: IsIconic(h).as_bool(),
                oculta: oculta != 0,
                herramienta: GetWindowLongPtrW(h, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0 != 0,
                con_dueno: GetWindow(h, GW_OWNER).is_ok_and(|d| !d.is_invalid()),
                pid: pid_de(h),
            },
        ));
        true.into()
    }
    let mut lista = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(una), LPARAM(&mut lista as *mut _ as isize));
    }
    lista.into_iter().filter(|(_, v)| candidata(v, excluir)).map(|(h, v)| (h, v.titulo, v.pid)).collect()
}

/// Una imagen de la ventana con `PrintWindow`, para las que WGC no capturó: `entregar(bgra, pitch, ancho, alto)`.
pub fn imprimir_ventana(n: isize, entregar: impl FnOnce(&[u8], usize, usize, usize)) {
    let h = HWND(n as _);
    let mut r = RECT::default();
    unsafe {
        if GetWindowRect(h, &mut r).is_err() {
            return;
        }
        let (w, alto) = (r.right - r.left, r.bottom - r.top);
        if w <= 0 || alto <= 0 {
            return;
        }
        let dc = CreateCompatibleDC(None);
        let bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -alto, // de arriba hacia abajo
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut bits = std::ptr::null_mut();
        if let Ok(bmp) = CreateDIBSection(Some(dc), &bi, DIB_RGB_COLORS, &mut bits, None, 0) {
            let antes = SelectObject(dc, bmp.into());
            if PrintWindow(h, dc, PRINT_WINDOW_FLAGS(PW_RENDERFULLCONTENT)).as_bool() {
                let _ = GdiFlush();
                let (w, alto) = (w as usize, alto as usize);
                entregar(std::slice::from_raw_parts(bits as *const u8, w * 4 * alto), w * 4, w, alto);
            }
            SelectObject(dc, antes);
            let _ = DeleteObject(bmp.into());
        }
        let _ = DeleteDC(dc);
    }
}

/// Proceso dueño de la ventana.
pub fn pid_de(h: HWND) -> u32 {
    let mut pid = 0;
    unsafe { GetWindowThreadProcessId(h, Some(&mut pid)) };
    pid
}

/// Tamaño de salida: el de la captura achicado para entrar en `max` (par, como pide NV12).
pub fn tamano_salida(item: &GraphicsCaptureItem, max: (u32, u32)) -> Result<(u32, u32)> {
    let s = item.Size()?;
    let (w, h) = (s.Width as f64, s.Height as f64);
    let k = (max.0 as f64 / w).min(max.1 as f64 / h).min(1.0);
    Ok((((w * k) as u32) & !1, ((h * k) as u32) & !1))
}

pub struct Captura {
    pool: Direct3D11CaptureFramePool,
    sesion: GraphicsCaptureSession,
    ventana: Option<isize>, // HWND como número: HWND no es Send
}

impl Captura {
    /// Si se transmite una ventana, si todavía existe. (El evento Closed de WGC no llega sin un
    /// DispatcherQueue en el hilo, así que se pregunta.)
    pub fn viva(&self) -> bool {
        self.ventana.is_none_or(|h| unsafe { IsWindow(Some(HWND(h as _))).as_bool() })
    }
}

impl Drop for Captura {
    fn drop(&mut self) {
        let _ = self.sesion.Close();
        let _ = self.pool.Close();
    }
}

/// Un solo cuadro de la fuente, para las miniaturas: `entregar(bgra, pitch, ancho, alto)` se llama una vez,
/// desde otro hilo, cuando llega. Soltar la `Captura` la cierra.
pub fn un_cuadro(d: &ID3D11Device, item: &GraphicsCaptureItem, entregar: impl Fn(&[u8], usize, usize, usize) + Send + 'static) -> Result<Captura> {
    let winrt: IDirect3DDevice = unsafe { CreateDirect3D11DeviceFromDXGIDevice(&d.cast::<IDXGIDevice>()?)? }.cast()?;
    let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(&winrt, DirectXPixelFormat::B8G8R8A8UIntNormalized, 1, item.Size()?)?;
    let sesion = pool.CreateCaptureSession(item)?;
    let _ = sesion.SetIsBorderRequired(false);
    let _ = sesion.SetIsCursorCaptureEnabled(false);
    let d = d.clone();
    let hecho = AtomicBool::new(false);
    pool.FrameArrived(&TypedEventHandler::<Direct3D11CaptureFramePool, IInspectable>::new(move |p, _| {
        if let Some(p) = p.as_ref() {
            if !hecho.swap(true, Ordering::Relaxed) {
                let _ = bajar_cuadro(&d, p, &entregar);
            }
        }
        Ok(())
    }))?;
    sesion.StartCapture()?;
    Ok(Captura { pool, sesion, ventana: None })
}

fn bajar_cuadro(d: &ID3D11Device, p: &Direct3D11CaptureFramePool, entregar: &impl Fn(&[u8], usize, usize, usize)) -> Result<()> {
    let cuadro = p.TryGetNextFrame()?;
    let tam = cuadro.ContentSize()?;
    let tex: ID3D11Texture2D = unsafe { cuadro.Surface()?.cast::<IDirect3DDxgiInterfaceAccess>()?.GetInterface()? };
    unsafe {
        let mut desc = D3D11_TEXTURE2D_DESC::default();
        tex.GetDesc(&mut desc);
        let (w, h) = ((tam.Width.max(0) as u32).min(desc.Width) as usize, (tam.Height.max(0) as u32).min(desc.Height) as usize);
        if w == 0 || h == 0 {
            return Ok(());
        }
        desc.Usage = D3D11_USAGE_STAGING;
        desc.BindFlags = 0;
        desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ.0 as u32;
        desc.MiscFlags = 0;
        let mut copia = None;
        d.CreateTexture2D(&desc, None, Some(&mut copia))?;
        let copia = copia.unwrap();
        let ctx = d.GetImmediateContext()?;
        ctx.CopyResource(&copia, &tex);
        let mut m = D3D11_MAPPED_SUBRESOURCE::default();
        ctx.Map(&copia, 0, D3D11_MAP_READ, 0, Some(&mut m))?;
        let pitch = m.RowPitch as usize;
        entregar(std::slice::from_raw_parts(m.pData as *const u8, pitch * h), pitch, w, h);
        ctx.Unmap(&copia, 0);
    }
    Ok(())
}

/// Lo que la captura le avisa al supervisor.
pub enum Aviso {
    Error(String),
}

/// Conversor BGRA → NV12 para un tamaño de entrada dado; la imagen va centrada sin deformar (bandas negras).
struct Conversor {
    entrada: SizeInt32,
    en: ID3D11VideoProcessorEnumerator,
    vp: ID3D11VideoProcessor,
}

fn conversor(vdev: &ID3D11VideoDevice, vctx: &ID3D11VideoContext, entrada: SizeInt32, salida: (u32, u32), fps: u32) -> Result<Conversor> {
    let tasa = DXGI_RATIONAL { Numerator: fps, Denominator: 1 };
    let desc = D3D11_VIDEO_PROCESSOR_CONTENT_DESC {
        InputFrameFormat: D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE,
        InputFrameRate: tasa,
        InputWidth: entrada.Width as u32,
        InputHeight: entrada.Height as u32,
        OutputFrameRate: tasa,
        OutputWidth: salida.0,
        OutputHeight: salida.1,
        Usage: D3D11_VIDEO_USAGE_OPTIMAL_SPEED,
    };
    let (w, h) = (entrada.Width as f64, entrada.Height as f64);
    let k = (salida.0 as f64 / w).min(salida.1 as f64 / h);
    let (dw, dh) = ((w * k) as i32, (h * k) as i32);
    let (x, y) = ((salida.0 as i32 - dw) / 2, (salida.1 as i32 - dh) / 2);
    unsafe {
        let en = vdev.CreateVideoProcessorEnumerator(&desc)?;
        let vp = vdev.CreateVideoProcessor(&en, 0)?;
        // entrada RGB 0-255, salida BT.709 16-235: lo que el codificador anuncia en el flujo
        vctx.VideoProcessorSetStreamColorSpace(&vp, 0, &D3D11_VIDEO_PROCESSOR_COLOR_SPACE { _bitfield: 0 });
        vctx.VideoProcessorSetOutputColorSpace(&vp, &D3D11_VIDEO_PROCESSOR_COLOR_SPACE { _bitfield: 0b1_0100 });
        vctx.VideoProcessorSetStreamAutoProcessingMode(&vp, 0, false);
        vctx.VideoProcessorSetStreamDestRect(&vp, 0, true, Some(&RECT { left: x, top: y, right: x + dw, bottom: y + dh }));
        let negro = D3D11_VIDEO_COLOR { Anonymous: D3D11_VIDEO_COLOR_0 { RGBA: D3D11_VIDEO_COLOR_RGBA { R: 0.0, G: 0.0, B: 0.0, A: 1.0 } } };
        vctx.VideoProcessorSetOutputBackgroundColor(&vp, false, &negro);
        Ok(Conversor { entrada, en, vp })
    }
}

// El IDirect3DDevice que sale de CreateDirect3D11DeviceFromDXGIDevice es agile (sirve desde cualquier hilo),
// pero windows-rs no lo marca Send; hace falta en el evento para rearmar el pool.
struct Agil(IDirect3DDevice);
unsafe impl Send for Agil {}
unsafe impl Sync for Agil {}
impl Agil {
    // método y no `.0`: si el closure capturara solo el campo, perdería el Send del envoltorio
    fn get(&self) -> &IDirect3DDevice {
        &self.0
    }
}

pub fn empezar(
    d: &ID3D11Device,
    item: &GraphicsCaptureItem,
    ventana: Option<HWND>,
    salida: (u32, u32),
    fps: u32,
    tx: SyncSender<Cuadro>,
    avisos: Sender<Aviso>,
) -> Result<Captura> {
    let tam = item.Size()?;
    let winrt: IDirect3DDevice = unsafe { CreateDirect3D11DeviceFromDXGIDevice(&d.cast::<IDXGIDevice>()?)? }.cast()?;
    let formato = DirectXPixelFormat::B8G8R8A8UIntNormalized;
    let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(&winrt, formato, 2, tam)?;
    let sesion = pool.CreateCaptureSession(item)?;
    let _ = sesion.SetIsBorderRequired(false);
    sesion.SetIsCursorCaptureEnabled(true)?;

    let vdev: ID3D11VideoDevice = d.cast()?;
    let vctx: ID3D11VideoContext = unsafe { d.GetImmediateContext()? }.cast()?;
    let conv = Mutex::new(conversor(&vdev, &vctx, tam, salida, fps)?);
    let nv12 = D3D11_TEXTURE2D_DESC {
        Width: salida.0,
        Height: salida.1,
        MipLevels: 1,
        ArraySize: 1,
        Format: DXGI_FORMAT_NV12,
        SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
        Usage: D3D11_USAGE_DEFAULT,
        BindFlags: D3D11_BIND_RENDER_TARGET.0 as u32,
        ..Default::default()
    };
    let winrt = Agil(winrt);
    let d = d.clone();
    let fallo = AtomicBool::new(false);
    let avisar = avisos;

    let cuadro_listo = move |p: &Direct3D11CaptureFramePool| -> Result<()> {
        let cuadro = p.TryGetNextFrame()?;
        // reloj del sistema en µs: sigue creciendo aunque la captura se rearme
        let us = cuadro.SystemRelativeTime()?.Duration / 10;
        let mut c = conv.lock().unwrap();
        let tam = cuadro.ContentSize()?;
        if tam != c.entrada && tam.Width > 0 && tam.Height > 0 {
            // la ventana cambió de tamaño o el juego cambió de resolución: se rearma y se espera el próximo cuadro
            p.Recreate(winrt.get(), formato, 2, tam)?;
            *c = conversor(&vdev, &vctx, tam, salida, fps)?;
            return Ok(());
        }
        let tex: ID3D11Texture2D = unsafe { cuadro.Surface()?.cast::<IDirect3DDxgiInterfaceAccess>()?.GetInterface()? };
        // ponytail: una textura NV12 nueva por cuadro (la suelta el codificador al terminar). Si pesa, usar un anillo.
        unsafe {
            let mut salida_tex = None;
            d.CreateTexture2D(&nv12, None, Some(&mut salida_tex))?;
            let salida_tex = salida_tex.unwrap();
            let mut entrada = None;
            let ve = D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC {
                FourCC: 0,
                ViewDimension: D3D11_VPIV_DIMENSION_TEXTURE2D,
                Anonymous: D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC_0 { Texture2D: D3D11_TEX2D_VPIV { MipSlice: 0, ArraySlice: 0 } },
            };
            vdev.CreateVideoProcessorInputView(&tex, &c.en, &ve, Some(&mut entrada))?;
            let mut vista = None;
            let vs = D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC {
                ViewDimension: D3D11_VPOV_DIMENSION_TEXTURE2D,
                Anonymous: D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC_0 { Texture2D: D3D11_TEX2D_VPOV { MipSlice: 0 } },
            };
            vdev.CreateVideoProcessorOutputView(&salida_tex, &c.en, &vs, Some(&mut vista))?;
            let mut stream = D3D11_VIDEO_PROCESSOR_STREAM { Enable: true.into(), pInputSurface: ManuallyDrop::new(entrada), ..Default::default() };
            let r = vctx.VideoProcessorBlt(&c.vp, vista.as_ref().unwrap(), 0, std::slice::from_ref(&stream));
            ManuallyDrop::drop(&mut stream.pInputSurface);
            r?;
            // si el codificador va atrasado se tira el cuadro en vez de acumular demora
            let _ = tx.try_send((salida_tex, us));
        }
        Ok(())
    };
    pool.FrameArrived(&TypedEventHandler::<Direct3D11CaptureFramePool, IInspectable>::new(move |p, _| {
        if let (Some(p), false) = (p.as_ref(), fallo.load(Ordering::Relaxed)) {
            if let Err(e) = cuadro_listo(p) {
                // un solo aviso: el supervisor tira todo y lo vuelve a armar
                fallo.store(true, Ordering::Relaxed);
                let _ = avisar.send(Aviso::Error(format!("captura: {e}")));
            }
        }
        Ok(())
    }))?;
    sesion.StartCapture()?;
    Ok(Captura { pool, sesion, ventana: ventana.map(|h| h.0 as isize) })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parsea_objetivo() {
        assert!(matches!(objetivo("pantalla"), Some(Objetivo::Principal)));
        assert!(matches!(objetivo(r"monitor:\\.\DISPLAY2"), Some(Objetivo::Monitor(x)) if x == r"\\.\DISPLAY2"));
        assert!(matches!(objetivo("ventana:1234"), Some(Objetivo::Ventana(1234))));
        for malo in ["monitor:", "ventana:0", "ventana:abc", "Chrome"] {
            assert!(objetivo(malo).is_none(), "{malo}");
        }
    }

    #[test]
    fn filtra_ventanas() {
        let buena = || InfoVentana { titulo: "Juego".into(), clase: "UnrealWindow".into(), visible: true, minimizada: false, oculta: false, herramienta: false, con_dueno: false, pid: 10 };
        assert!(candidata(&buena(), 99));
        let malas: [fn(&mut InfoVentana); 9] = [
            |v| v.visible = false,
            |v| v.minimizada = true,
            |v| v.oculta = true,
            |v| v.herramienta = true,
            |v| v.con_dueno = true,
            |v| v.titulo = "   ".into(),
            |v| v.clase = "Progman".into(),
            |v| v.clase = "WorkerW".into(),
            |v| v.pid = 99,
        ];
        for (i, cambiar) in malas.iter().enumerate() {
            let mut v = buena();
            cambiar(&mut v);
            assert!(!candidata(&v, 99), "condición {i}");
        }
    }
}
