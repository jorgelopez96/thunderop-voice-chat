// Codificador H.264 de Media Foundation: el de la placa (NVENC en NVIDIA, AMF en AMD, Quick Sync en Intel) o,
// si no hay, el de Microsoft por software. Recibe texturas NV12 de la GPU y devuelve cuadros Annex-B.
// Los MFT de hardware son asíncronos: avisan con eventos cuándo quieren un cuadro (NeedInput) y cuándo hay
// uno listo (HaveOutput). El de software es sincrónico y la imagen tiene que pasar por la CPU.
use std::mem::ManuallyDrop;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, SyncSender};
use std::sync::Arc;
use std::time::{Duration, Instant};

use windows::core::{Interface, Result, GUID};
use windows::Win32::Foundation::E_FAIL;
use windows::Win32::Graphics::Direct3D11::*;
use windows::Win32::Graphics::Dxgi::Common::{DXGI_FORMAT_NV12, DXGI_SAMPLE_DESC};
use windows::Win32::Graphics::Dxgi::IDXGIDevice;
use windows::Win32::Media::MediaFoundation::*;
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED};
use windows::Win32::System::Variant::VARIANT;

use crate::captura::Cuadro;

/// Cuadro comprimido: bytes Annex-B, momento en µs y si es keyframe.
pub struct Salida {
    pub datos: Vec<u8>,
    pub us: i64,
    pub clave: bool,
}

/// Lo que la parte de LiveKit le pide al codificador mientras corre.
#[derive(Default)]
pub struct Pedidos {
    pub keyframe: AtomicBool,
    pub bitrate: AtomicU32,
    /// último bitrate que permitió LiveKit (el de arriba lo consume el codificador)
    pub permitido: AtomicU32,
    /// tope que eligió el usuario (cambia si cambia la calidad en vivo)
    pub tope: AtomicU32,
    /// tamaño del video que sale, ancho << 32 | alto (cambia si cambia la calidad en vivo)
    pub tamano: std::sync::atomic::AtomicU64,
}

/// El compresor que se encontró, todavía sin configurar.
pub struct Mft {
    mft: IMFTransform,
    pub nombre: String,
    pub software: bool,
}

/// Primero el de la placa; si no hay (o `TRANSMISOR_SOFTWARE=1`), el de Microsoft por software.
pub fn buscar(d: &ID3D11Device) -> Result<Mft> {
    unsafe {
        MFStartup(MF_VERSION, MFSTARTUP_FULL)?;
        let hw = if std::env::var("TRANSMISOR_SOFTWARE").as_deref() == Ok("1") {
            Err(windows::core::Error::new(E_FAIL, "forzado por TRANSMISOR_SOFTWARE"))
        } else {
            primer_mft_hardware(d)
        };
        match hw {
            Ok((mft, nombre)) => Ok(Mft { mft, nombre, software: false }),
            Err(e) => buscar_software().map_err(|s| windows::core::Error::new(E_FAIL, format!("{}; por software: {}", e.message(), s.message()))),
        }
    }
}

/// El de Microsoft por software (también si el de la placa aparece pero no se deja configurar).
pub fn buscar_software() -> Result<Mft> {
    unsafe {
        MFStartup(MF_VERSION, MFSTARTUP_FULL)?;
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let mft = CoCreateInstance(&CLSID_MSH264EncoderMFT, None, CLSCTX_INPROC_SERVER)?;
        Ok(Mft { mft, nombre: "Microsoft H.264".into(), software: true })
    }
}

pub struct Codificador {
    mft: IMFTransform,
    /// solo el de hardware (asíncrono)
    eventos: Option<IMFMediaEventGenerator>,
    codec: ICodecAPI,
    _manager: Option<IMFDXGIDeviceManager>,
    /// solo el de software: textura que la CPU puede leer para bajar cada cuadro
    cpu: Option<(ID3D11DeviceContext, ID3D11Texture2D)>,
    tam: (u32, u32),
    fps: u32,
    pub nombre: String,
    pub software: bool,
}

fn par(a: u32, b: u32) -> u64 {
    ((a as u64) << 32) | b as u64
}

impl Codificador {
    pub fn new(d: &ID3D11Device, Mft { mft, nombre, software }: Mft, (ancho, alto): (u32, u32), fps: u32, bps: u32) -> Result<Self> {
        // para probar el respaldo: TRANSMISOR_FALLAR_HW=1 hace fallar la configuración del de hardware
        if !software && std::env::var("TRANSMISOR_FALLAR_HW").as_deref() == Ok("1") {
            return Err(windows::core::Error::new(E_FAIL, "falla provocada (TRANSMISOR_FALLAR_HW)"));
        }
        unsafe {
            let (mut manager, mut cpu) = (None, None);
            if software {
                let desc = D3D11_TEXTURE2D_DESC {
                    Width: ancho,
                    Height: alto,
                    MipLevels: 1,
                    ArraySize: 1,
                    Format: DXGI_FORMAT_NV12,
                    SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
                    Usage: D3D11_USAGE_STAGING,
                    CPUAccessFlags: D3D11_CPU_ACCESS_READ.0 as u32,
                    ..Default::default()
                };
                let mut tex = None;
                d.CreateTexture2D(&desc, None, Some(&mut tex))?;
                cpu = Some((d.GetImmediateContext()?, tex.unwrap()));
            } else {
                let atr = mft.GetAttributes()?;
                atr.SetUINT32(&MF_TRANSFORM_ASYNC_UNLOCK, 1)?;
                let _ = atr.SetUINT32(&MF_LOW_LATENCY, 1);

                let mut token = 0;
                let mut m = None;
                MFCreateDXGIDeviceManager(&mut token, &mut m)?;
                let m = m.unwrap();
                m.ResetDevice(d, token)?;
                mft.ProcessMessage(MFT_MESSAGE_SET_D3D_MANAGER, m.as_raw() as usize)?;
                manager = Some(m);
            }

            let codec: ICodecAPI = mft.cast()?;
            let poner = |k: &GUID, v: VARIANT| {
                let _ = codec.SetValue(k, &v); // cada fabricante soporta un subconjunto; lo que no, se ignora
            };
            poner(&CODECAPI_AVEncCommonRateControlMode, VARIANT::from(eAVEncCommonRateControlMode_CBR.0 as u32));
            poner(&CODECAPI_AVEncCommonMeanBitRate, VARIANT::from(bps));
            poner(&CODECAPI_AVLowLatencyMode, VARIANT::from(true));
            poner(&CODECAPI_AVEncMPVDefaultBPictureCount, VARIANT::from(0u32));
            // keyframes solo cuando alguien los pide (o cada 10 s por las dudas)
            poner(&CODECAPI_AVEncMPVGOPSize, VARIANT::from(fps * 10));

            let sal = MFCreateMediaType()?;
            sal.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
            sal.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_H264)?;
            sal.SetUINT32(&MF_MT_AVG_BITRATE, bps)?;
            sal.SetUINT64(&MF_MT_FRAME_SIZE, par(ancho, alto))?;
            sal.SetUINT64(&MF_MT_FRAME_RATE, par(fps, 1))?;
            sal.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, par(1, 1))?;
            sal.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
            sal.SetUINT32(&MF_MT_MPEG2_PROFILE, eAVEncH264VProfile_High.0 as u32)?;
            sal.SetUINT32(&MF_MT_YUV_MATRIX, MFVideoTransferMatrix_BT709.0 as u32)?;
            sal.SetUINT32(&MF_MT_VIDEO_PRIMARIES, MFVideoPrimaries_BT709.0 as u32)?;
            sal.SetUINT32(&MF_MT_TRANSFER_FUNCTION, MFVideoTransFunc_709.0 as u32)?;
            sal.SetUINT32(&MF_MT_VIDEO_NOMINAL_RANGE, MFNominalRange_16_235.0 as u32)?;
            mft.SetOutputType(0, &sal, 0)?;

            let ent = MFCreateMediaType()?;
            ent.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
            ent.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_NV12)?;
            ent.SetUINT64(&MF_MT_FRAME_SIZE, par(ancho, alto))?;
            ent.SetUINT64(&MF_MT_FRAME_RATE, par(fps, 1))?;
            ent.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
            mft.SetInputType(0, &ent, 0)?;

            mft.ProcessMessage(MFT_MESSAGE_NOTIFY_BEGIN_STREAMING, 0)?;
            mft.ProcessMessage(MFT_MESSAGE_NOTIFY_START_OF_STREAM, 0)?;
            let eventos = if software { None } else { Some(mft.cast()?) };
            Ok(Self { mft, eventos, codec, _manager: manager, cpu, tam: (ancho, alto), fps, nombre, software })
        }
    }

    /// Corre hasta que se corta la captura o se prende `parar`. Bloquea el hilo.
    pub fn correr(self, entrada: Receiver<Cuadro>, salida: SyncSender<Salida>, pedidos: Arc<Pedidos>, parar: Arc<AtomicBool>) -> Result<()> {
        if self.software {
            let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        }
        // para probar que el supervisor se recupera: TRANSMISOR_FALLAR=segundos hace fallar al codificador
        let fallar = std::env::var("TRANSMISOR_FALLAR").ok().and_then(|s| s.parse().ok()).map(|s| Instant::now() + Duration::from_secs(s));
        // el de software no da abasto con todo lo que manda la captura: como mucho `fps` por segundo
        let minimo = if self.software { Duration::from_secs(1) / self.fps } else { Duration::ZERO };
        let mut ultimo: Option<(ID3D11Texture2D, i64, Instant)> = None;
        loop {
            if let Some(eventos) = &self.eventos {
                let tipo = unsafe { eventos.GetEvent(MEDIA_EVENT_GENERATOR_GET_EVENT_FLAGS(0))?.GetType()? } as i32;
                if tipo == METransformHaveOutput.0 {
                    if let Some(s) = self.sacar()? {
                        if salida.send(s).is_err() {
                            return Ok(());
                        }
                    }
                }
                if tipo != METransformNeedInput.0 {
                    continue;
                }
            }
            let Some((tex, us)) = siguiente(&entrada, &ultimo, minimo, &pedidos, &parar, fallar)? else { return Ok(()) };
            // los tiempos tienen que crecer siempre, aunque mezclemos repetidos y nuevos
            let us = ultimo.as_ref().map_or(us, |u| us.max(u.1 + 1));
            self.aplicar_pedidos(&pedidos);
            self.entrar(&tex, us)?;
            ultimo = Some((tex, us, Instant::now()));
            if self.software {
                // sincrónico: se saca todo lo que tenga antes de darle otro cuadro
                loop {
                    match self.sacar() {
                        Ok(Some(s)) => {
                            if salida.send(s).is_err() {
                                return Ok(());
                            }
                        }
                        Ok(None) => {}
                        Err(e) if e.code() == MF_E_TRANSFORM_NEED_MORE_INPUT => break,
                        Err(e) => return Err(e),
                    }
                }
            }
        }
    }

    fn aplicar_pedidos(&self, p: &Pedidos) {
        unsafe {
            if p.keyframe.swap(false, Ordering::Relaxed) {
                let _ = self.codec.SetValue(&CODECAPI_AVEncVideoForceKeyFrame, &VARIANT::from(1u32));
            }
            let b = p.bitrate.swap(0, Ordering::Relaxed);
            if b > 0 {
                let _ = self.codec.SetValue(&CODECAPI_AVEncCommonMeanBitRate, &VARIANT::from(b));
            }
        }
    }

    fn entrar(&self, tex: &ID3D11Texture2D, us: i64) -> Result<()> {
        unsafe {
            let buf = match &self.cpu {
                None => MFCreateDXGISurfaceBuffer(&ID3D11Texture2D::IID, tex, 0, false)?,
                Some((ctx, copia)) => self.bajar(ctx, copia, tex)?,
            };
            let s = MFCreateSample()?;
            s.AddBuffer(&buf)?;
            s.SetSampleTime(us * 10)?;
            s.SetSampleDuration(10_000_000 / self.fps as i64)?;
            self.mft.ProcessInput(0, &s, 0)
        }
    }

    /// Copia la textura de la GPU a la memoria, sin el relleno de cada fila.
    unsafe fn bajar(&self, ctx: &ID3D11DeviceContext, copia: &ID3D11Texture2D, tex: &ID3D11Texture2D) -> Result<IMFMediaBuffer> {
        ctx.CopyResource(copia, tex);
        let mut m = D3D11_MAPPED_SUBRESOURCE::default();
        ctx.Map(copia, 0, D3D11_MAP_READ, 0, Some(&mut m))?;
        let (ancho, alto, pitch) = (self.tam.0 as usize, self.tam.1 as usize, m.RowPitch as usize);
        let largo = pitch * (alto + alto / 2);
        // DepthPitch no sirve de control: en texturas 2D cada driver pone lo que quiere (0, o solo el plano Y)
        if m.pData.is_null() || pitch < ancho {
            ctx.Unmap(copia, 0);
            return Err(windows::core::Error::new(E_FAIL, format!("textura mapeada inválida (pitch {pitch}, ancho {ancho})")));
        }
        let datos = empaquetar_nv12(std::slice::from_raw_parts(m.pData as *const u8, largo), pitch, ancho, alto);
        ctx.Unmap(copia, 0);
        let buf = MFCreateMemoryBuffer(datos.len() as u32)?;
        let mut p = std::ptr::null_mut();
        buf.Lock(&mut p, None, None)?;
        std::ptr::copy_nonoverlapping(datos.as_ptr(), p, datos.len());
        buf.Unlock()?;
        buf.SetCurrentLength(datos.len() as u32)?;
        Ok(buf)
    }

    fn sacar(&self) -> Result<Option<Salida>> {
        unsafe {
            let mut out = [MFT_OUTPUT_DATA_BUFFER::default()];
            if self.software {
                // el de Microsoft no da muestras: hay que pasarle una del tamaño que pide
                let s = MFCreateSample()?;
                s.AddBuffer(&MFCreateMemoryBuffer(self.mft.GetOutputStreamInfo(0)?.cbSize)?)?;
                out[0].pSample = ManuallyDrop::new(Some(s));
            }
            let mut estado = 0;
            let r = self.mft.ProcessOutput(0, &mut out, &mut estado);
            let _ = ManuallyDrop::take(&mut out[0].pEvents);
            let muestra = ManuallyDrop::take(&mut out[0].pSample);
            if let Err(e) = r {
                if e.code() == MF_E_TRANSFORM_STREAM_CHANGE {
                    // el codificador renegocia el formato de salida: se acepta el que propone
                    let t = self.mft.GetOutputAvailableType(0, 0)?;
                    self.mft.SetOutputType(0, &t, 0)?;
                    return Ok(None);
                }
                return Err(e);
            }
            let Some(s) = muestra else { return Ok(None) };
            let clave = s.GetUINT32(&MFSampleExtension_CleanPoint).unwrap_or(0) == 1;
            let us = s.GetSampleTime()? / 10;
            let buf = s.ConvertToContiguousBuffer()?;
            let mut p = std::ptr::null_mut();
            let mut n = 0;
            buf.Lock(&mut p, None, Some(&mut n))?;
            let mut datos = std::slice::from_raw_parts(p, n as usize).to_vec();
            buf.Unlock()?;
            // WebRTC necesita SPS/PPS delante de cada keyframe; algunos codificadores los dejan solo en el formato
            if clave && !tiene_sps(&datos) {
                if let Ok(t) = self.mft.GetOutputCurrentType(0) {
                    let mut cab = cabecera(&t);
                    cab.extend_from_slice(&datos);
                    datos = cab;
                }
            }
            Ok(Some(Salida { datos, us, clave }))
        }
    }
}

/// Espera el próximo cuadro (None si hay que terminar). Con la pantalla quieta Windows no manda nada: se
/// repite el último (cada 500 ms, o enseguida si alguien pide keyframe) para que el que entra a mirar vea
/// algo. Con `minimo` > 0 entre un cuadro y otro pasa al menos eso y se queda con el más nuevo.
fn siguiente(
    entrada: &Receiver<Cuadro>,
    ultimo: &Option<(ID3D11Texture2D, i64, Instant)>,
    minimo: Duration,
    pedidos: &Pedidos,
    parar: &AtomicBool,
    fallar: Option<Instant>,
) -> Result<Option<Cuadro>> {
    let mut nuevo = None;
    loop {
        if parar.load(Ordering::Relaxed) {
            return Ok(None);
        }
        if fallar.is_some_and(|t| Instant::now() > t) {
            return Err(windows::core::Error::new(E_FAIL, "falla provocada (TRANSMISOR_FALLAR)"));
        }
        let falta = ultimo.as_ref().map_or(Duration::ZERO, |u| minimo.saturating_sub(u.2.elapsed()));
        if nuevo.is_some() && falta.is_zero() {
            return Ok(nuevo);
        }
        match entrada.recv_timeout(if nuevo.is_some() { falta } else { Duration::from_millis(50) }) {
            Ok(c) => nuevo = Some(c),
            Err(RecvTimeoutError::Disconnected) => return Ok(None),
            Err(RecvTimeoutError::Timeout) => {
                if let (None, Some((tex, us, cuando))) = (&nuevo, ultimo) {
                    let quieto = cuando.elapsed();
                    if quieto > Duration::from_millis(500) || pedidos.keyframe.load(Ordering::Relaxed) {
                        return Ok(Some((tex.clone(), us + quieto.as_micros() as i64)));
                    }
                }
            }
        }
    }
}

/// NV12 mapeado (filas de `pitch` bytes) → planos Y y UV pegados, sin el relleno de cada fila.
pub fn empaquetar_nv12(datos: &[u8], pitch: usize, ancho: usize, alto: usize) -> Vec<u8> {
    let filas = alto + alto / 2; // las de UV empiezan en pitch * alto
    let mut v = Vec::with_capacity(ancho * filas);
    for f in 0..filas {
        v.extend_from_slice(&datos[f * pitch..f * pitch + ancho]);
    }
    v
}

// Los MFT (el de hardware free-threaded, el de software en MTA) los usa un solo hilo después de crearlos.
unsafe impl Send for Codificador {}

impl Drop for Codificador {
    fn drop(&mut self) {
        unsafe {
            let _ = self.mft.ProcessMessage(MFT_MESSAGE_NOTIFY_END_OF_STREAM, 0);
            let _ = self.mft.ProcessMessage(MFT_MESSAGE_NOTIFY_END_STREAMING, 0);
        }
    }
}

/// El codificador tiene que ser de la misma placa que captura (PCs con integrada + dedicada).
unsafe fn primer_mft_hardware(d: &ID3D11Device) -> Result<(IMFTransform, String)> {
    let luid = d.cast::<IDXGIDevice>()?.GetAdapter()?.GetDesc()?.AdapterLuid;
    let mut atr = None;
    MFCreateAttributes(&mut atr, 1)?;
    let atr = atr.unwrap();
    let bytes = std::slice::from_raw_parts(&luid as *const _ as *const u8, std::mem::size_of_val(&luid));
    atr.SetBlob(&MFT_ENUM_ADAPTER_LUID, bytes)?;
    let ent = MFT_REGISTER_TYPE_INFO { guidMajorType: MFMediaType_Video, guidSubtype: MFVideoFormat_NV12 };
    let sal = MFT_REGISTER_TYPE_INFO { guidMajorType: MFMediaType_Video, guidSubtype: MFVideoFormat_H264 };
    let mut lista = std::ptr::null_mut();
    let mut n = 0;
    MFTEnum2(MFT_CATEGORY_VIDEO_ENCODER, MFT_ENUM_FLAG_HARDWARE | MFT_ENUM_FLAG_SORTANDFILTER, Some(&ent), Some(&sal), &atr, &mut lista, &mut n)?;
    let activos: Vec<Option<IMFActivate>> = (0..n as usize).map(|i| std::ptr::read(lista.add(i))).collect();
    CoTaskMemFree(Some(lista as _));
    let a = activos.first().and_then(|a| a.as_ref()).ok_or_else(|| windows::core::Error::new(E_FAIL, "esta placa no tiene codificador H.264 por hardware (¿driver viejo?)"))?;
    let mut nombre = windows::core::PWSTR::null();
    let mut largo = 0;
    let nombre = match a.GetAllocatedString(&MFT_FRIENDLY_NAME_Attribute, &mut nombre, &mut largo) {
        Ok(()) => {
            let s = nombre.to_string().unwrap_or_default();
            CoTaskMemFree(Some(nombre.0 as _));
            s
        }
        Err(_) => "?".into(),
    };
    Ok((a.ActivateObject()?, nombre))
}

fn tiene_sps(d: &[u8]) -> bool {
    d.windows(4).any(|w| w[..3] == [0, 0, 1] && w[3] & 0x1f == 7)
}

/// SPS/PPS del formato de salida (MF_MT_MPEG_SEQUENCE_HEADER ya viene en Annex-B).
unsafe fn cabecera(t: &IMFMediaType) -> Vec<u8> {
    let Ok(n) = t.GetBlobSize(&MF_MT_MPEG_SEQUENCE_HEADER) else { return Vec::new() };
    let mut v = vec![0; n as usize];
    if t.GetBlob(&MF_MT_MPEG_SEQUENCE_HEADER, &mut v, None).is_err() {
        v.clear();
    }
    v
}

#[cfg(test)]
mod tests {
    #[test]
    fn detecta_sps() {
        assert!(super::tiene_sps(&[0, 0, 0, 1, 0x67, 1, 2]));
        assert!(!super::tiene_sps(&[0, 0, 0, 1, 0x65, 1, 2]));
    }

    #[test]
    fn empaqueta_nv12_sin_relleno() {
        // 4x2 con pitch 8: cada fila trae 4 bytes de relleno (0xEE) que no tienen que aparecer
        let r = [0xEE; 4];
        let datos: Vec<u8> = [[1, 2, 3, 4], r, [5, 6, 7, 8], r, [9, 10, 11, 12], r].concat();
        assert_eq!(super::empaquetar_nv12(&datos, 8, 4, 2), (1..=12).collect::<Vec<u8>>());
    }
}
