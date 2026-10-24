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
use windows::Win32::Foundation::{HMODULE, HWND, LPARAM, POINT, RECT};
use windows::Win32::Graphics::Direct3D::D3D_DRIVER_TYPE_HARDWARE;
use windows::Win32::Graphics::Direct3D11::*;
use windows::Win32::Graphics::Dxgi::Common::{DXGI_FORMAT_NV12, DXGI_RATIONAL, DXGI_SAMPLE_DESC};
use windows::Win32::Graphics::Dxgi::IDXGIDevice;
use windows::Win32::Graphics::Gdi::{MonitorFromPoint, MONITOR_DEFAULTTOPRIMARY};
use windows::Win32::System::WinRT::Direct3D11::{CreateDirect3D11DeviceFromDXGIDevice, IDirect3DDxgiInterfaceAccess};
use windows::Win32::System::WinRT::Graphics::Capture::IGraphicsCaptureItemInterop;
use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindow, IsWindowVisible};

/// Textura NV12 y su momento de captura en µs (reloj del sistema).
pub type Cuadro = (ID3D11Texture2D, i64);

pub fn dispositivo() -> Result<ID3D11Device> {
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
        subir_prioridad_gpu(&d);
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

/// "pantalla" = monitor principal; cualquier otro texto = primera ventana visible cuyo título lo contenga.
pub fn elegir(que: &str) -> Result<(GraphicsCaptureItem, Option<HWND>)> {
    let interop = windows::core::factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()?;
    unsafe {
        if que == "pantalla" {
            return Ok((interop.CreateForMonitor(MonitorFromPoint(POINT::default(), MONITOR_DEFAULTTOPRIMARY))?, None));
        }
        let hwnd = ventanas()
            .into_iter()
            .find(|(_, t)| t.to_lowercase().contains(&que.to_lowercase()))
            .map(|(h, _)| h)
            .ok_or_else(|| windows::core::Error::new(windows::Win32::Foundation::E_INVALIDARG, format!("no hay ventana con \"{que}\"")))?;
        Ok((interop.CreateForWindow(hwnd)?, Some(hwnd)))
    }
}

pub fn ventanas() -> Vec<(HWND, String)> {
    unsafe extern "system" fn una(h: HWND, l: LPARAM) -> BOOL {
        let lista = &mut *(l.0 as *mut Vec<(HWND, String)>);
        let mut buf = [0u16; 256];
        let n = GetWindowTextW(h, &mut buf);
        if n > 0 && IsWindowVisible(h).as_bool() {
            lista.push((h, String::from_utf16_lossy(&buf[..n as usize])));
        }
        true.into()
    }
    let mut lista = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(una), LPARAM(&mut lista as *mut _ as isize));
    }
    lista
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
    (item, ventana): &(GraphicsCaptureItem, Option<HWND>),
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
