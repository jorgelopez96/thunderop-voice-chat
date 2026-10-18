// Captura del sonido de la PC sin las voces de la llamada: loopback de WASAPI
// excluyendo nuestro árbol de procesos (el WebView2 cuelga de app.exe).
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use tauri::ipc::{Channel, InvokeResponseBody};

#[derive(Default)]
pub struct Captura(Mutex<Option<(Arc<AtomicBool>, JoinHandle<()>)>>);

#[cfg(windows)]
fn capturar_con(
    activa: Arc<AtomicBool>,
    mut enviar: impl FnMut(Vec<u8>) -> bool,
    listo: impl FnOnce(Result<(), String>),
) -> Result<(), String> {
    use std::collections::VecDeque;
    use wasapi::{AudioClient, Direction, SampleType, StreamMode, WaveFormat};
    // abre todo; un fallo se avisa por `listo` antes de empezar el lazo
    let abrir = || -> Result<_, String> {
        wasapi::initialize_mta().ok().map_err(|e| e.to_string())?;
        // include_tree=false => EXCLUDE_TARGET_PROCESS_TREE (el comentario del crate dice lo contrario)
        let mut ac = AudioClient::new_application_loopback_client(std::process::id(), false)
            .map_err(|e| e.to_string())?;
        // este cliente no soporta get_mixformat: el formato lo ponemos nosotros
        let fmt = WaveFormat::new(32, 32, &SampleType::Float, 48000, 2, None);
        let modo = StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: 200_000 };
        ac.initialize_client(&fmt, &Direction::Capture, &modo).map_err(|e| e.to_string())?;
        let ev = ac.set_get_eventhandle().map_err(|e| e.to_string())?;
        let cap = ac.get_audiocaptureclient().map_err(|e| e.to_string())?;
        ac.start_stream().map_err(|e| e.to_string())?;
        Ok((ac, ev, cap))
    };
    let (ac, ev, cap) = match abrir() {
        Ok(t) => t,
        Err(e) => {
            listo(Err(e.clone()));
            return Err(e);
        }
    };
    listo(Ok(()));
    let mut cola: VecDeque<u8> = VecDeque::new();
    let mut res = Ok(());
    while activa.load(Ordering::SeqCst) {
        // sin sonido no llegan eventos: el timeout no es error
        let _ = ev.wait_for_event(100);
        if !activa.load(Ordering::SeqCst) {
            break;
        }
        loop {
            match cap.get_next_packet_size() {
                Ok(Some(n)) if n > 0 => {
                    if let Err(e) = cap.read_from_device_to_deque(&mut cola) {
                        res = Err(e.to_string());
                        break;
                    }
                }
                Ok(_) => break,
                Err(e) => {
                    res = Err(e.to_string());
                    break;
                }
            }
        }
        if res.is_err() {
            break;
        }
        if !cola.is_empty() && !enviar(cola.drain(..).collect()) {
            break;
        }
    }
    let _ = ac.stop_stream();
    res
}

#[cfg(not(windows))]
fn capturar_con(
    _: Arc<AtomicBool>,
    _: impl FnMut(Vec<u8>) -> bool,
    listo: impl FnOnce(Result<(), String>),
) -> Result<(), String> {
    listo(Err("no disponible".into()));
    Err("no disponible".into())
}

/// Captura mientras `activa` sea true y `enviar` devuelva true.
#[cfg_attr(not(test), allow(dead_code))] // la usan los tests; la app va por capturar_con
pub fn capturar(activa: Arc<AtomicBool>, enviar: impl FnMut(Vec<u8>) -> bool) -> Result<(), String> {
    capturar_con(activa, enviar, |_| {})
}

impl Captura {
    fn detener(&self) {
        if let Some((activa, h)) = self.0.lock().unwrap().take() {
            activa.store(false, Ordering::SeqCst);
            let _ = h.join();
        }
    }
}

#[tauri::command]
pub fn iniciar_audio(canal: Channel<InvokeResponseBody>, estado: tauri::State<Captura>) -> Result<(), String> {
    estado.detener();
    let activa = Arc::new(AtomicBool::new(true));
    let (tx, rx) = mpsc::channel();
    let p = activa.clone();
    let h = std::thread::spawn(move || {
        let _ = capturar_con(p, |b| canal.send(InvokeResponseBody::Raw(b)).is_ok(), |r| {
            let _ = tx.send(r);
        });
    });
    match rx.recv() {
        Ok(Ok(())) => {
            *estado.0.lock().unwrap() = Some((activa, h));
            Ok(())
        }
        r => {
            let _ = h.join();
            Err(match r {
                Ok(Err(e)) => e,
                _ => "captura no inició".into(),
            })
        }
    }
}

#[tauri::command]
pub fn detener_audio(estado: tauri::State<Captura>) {
    estado.detener();
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::f32::consts::PI;
    use std::sync::atomic::Ordering;
    use std::time::{Duration, Instant};

    // WAV PCM16 mono 44,1 kHz con un tono de 440 Hz, encabezado a mano
    fn wav_440(segundos: u32) -> Vec<u8> {
        let n = 44100 * segundos;
        let datos = n * 2;
        let mut w = Vec::new();
        w.extend(b"RIFF");
        w.extend((36 + datos).to_le_bytes());
        w.extend(b"WAVEfmt ");
        w.extend(16u32.to_le_bytes());
        w.extend(1u16.to_le_bytes()); // PCM
        w.extend(1u16.to_le_bytes()); // mono
        w.extend(44100u32.to_le_bytes());
        w.extend((44100u32 * 2).to_le_bytes());
        w.extend(2u16.to_le_bytes());
        w.extend(16u16.to_le_bytes());
        w.extend(b"data");
        w.extend(datos.to_le_bytes());
        for i in 0..n {
            let s = (2.0 * PI * 440.0 * i as f32 / 44100.0).sin() * 0.5;
            w.extend(((s * i16::MAX as f32) as i16).to_le_bytes());
        }
        w
    }

    // captura `segundos` y devuelve el RMS de todo lo recibido
    fn rms_capturado(segundos: u64) -> f32 {
        let activa = Arc::new(AtomicBool::new(true));
        let p = activa.clone();
        let inicio = Instant::now();
        let (mut suma, mut n) = (0f64, 0u64);
        capturar(activa, |bytes| {
            for m in bytes.chunks_exact(4) {
                let v = f32::from_le_bytes([m[0], m[1], m[2], m[3]]) as f64;
                suma += v * v;
                n += 1;
            }
            if inicio.elapsed() >= Duration::from_secs(segundos) {
                p.store(false, Ordering::SeqCst);
            }
            true
        })
        .expect("capturar falló");
        assert!(n > 0, "no llegó ninguna muestra");
        (suma / n as f64).sqrt() as f32
    }

    #[test]
    #[ignore = "necesita dispositivo de audio"]
    fn captura_sonido_ajeno() {
        let wav = std::env::temp_dir().join("captura_440.wav");
        std::fs::write(&wav, wav_440(3)).unwrap();
        // WMI crea el proceso con otro padre: queda fuera de nuestro árbol
        let cmd = format!(
            "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{{CommandLine='powershell -NoProfile -Command (New-Object Media.SoundPlayer ''{}'').PlaySync()'}}",
            wav.display()
        );
        let s = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &cmd])
            .output()
            .unwrap();
        assert!(s.status.success());
        let rms = rms_capturado(2);
        // deja terminar el WAV de 3 s para no ensuciar el test del sonido propio
        std::thread::sleep(Duration::from_secs(2));
        assert!(rms > 0.01, "RMS {rms}: no se captó el sonido ajeno");
    }

    #[test]
    #[ignore = "necesita dispositivo de audio y la PC en silencio"]
    fn excluye_sonido_propio() {
        let fin = Arc::new(AtomicBool::new(false));
        let f = fin.clone();
        let h = std::thread::spawn(move || {
            wasapi::initialize_mta().ok().unwrap();
            let dev = wasapi::DeviceEnumerator::new()
                .unwrap()
                .get_default_device(&wasapi::Direction::Render)
                .unwrap();
            let mut ac = dev.get_iaudioclient().unwrap();
            let fmt = wasapi::WaveFormat::new(32, 32, &wasapi::SampleType::Float, 48000, 2, None);
            let (def, _) = ac.get_device_period().unwrap();
            let modo = wasapi::StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: def };
            ac.initialize_client(&fmt, &wasapi::Direction::Render, &modo).unwrap();
            let ev = ac.set_get_eventhandle().unwrap();
            let rc = ac.get_audiorenderclient().unwrap();
            let mut t = 0u64;
            let mut escribir = |frames: usize| {
                let mut d = Vec::with_capacity(frames * 8);
                for _ in 0..frames {
                    let s = (2.0 * PI * 440.0 * t as f32 / 48000.0).sin() * 0.5;
                    t += 1;
                    d.extend(s.to_le_bytes());
                    d.extend(s.to_le_bytes());
                }
                rc.write_to_device(frames, &d, None).unwrap();
            };
            escribir(ac.get_available_space_in_frames().unwrap() as usize);
            ac.start_stream().unwrap();
            while !f.load(Ordering::SeqCst) {
                if ev.wait_for_event(200).is_ok() {
                    escribir(ac.get_available_space_in_frames().unwrap() as usize);
                }
            }
            ac.stop_stream().unwrap();
        });
        std::thread::sleep(Duration::from_millis(500));
        let rms = rms_capturado(2);
        fin.store(true, Ordering::SeqCst);
        h.join().unwrap();
        assert!(rms < 0.001, "RMS {rms}: se coló el sonido propio (¿hay algo más sonando en la PC? el test necesita silencio)");
    }
}
