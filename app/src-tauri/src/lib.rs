mod atajos;
mod audio;
mod transmisor;

use tauri::webview::{NewWindowResponse, PageLoadEvent, PermissionKind, PermissionResponse};
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(desktop)]
use tauri::{Emitter, WindowEvent};
use tauri::{AppHandle, Manager, Url, WebviewWindow, WebviewWindowBuilder};

#[cfg(desktop)]
fn mostrar(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        nivel_memoria(&w, false);
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// ¿`url` es la propia app? Su origen en release (`http://tauri.localhost` en Windows, `tauri://localhost`
/// en otros) o, en debug, el del `devUrl`. Cualquier otra página queda sin micrófono y sin navegar.
fn es_origen_app(url: &Url, dev_url: Option<&Url>) -> bool {
    // `tauri://` no es un esquema "especial": su `origin()` es opaco, así que se compara esquema + host + puerto.
    let mismo = |a: &Url, b: &Url| a.scheme() == b.scheme() && a.host_str() == b.host_str() && a.port_or_known_default() == b.port_or_known_default();
    (url.host_str() == Some("tauri.localhost") && matches!(url.scheme(), "http" | "https") && url.port().is_none())
        || (url.scheme() == "tauri" && url.host_str() == Some("localhost") && url.port().is_none())
        || (cfg!(debug_assertions) && dev_url.is_some_and(|d| mismo(url, d)))
}
fn dev_url<R: tauri::Runtime>(m: &impl Manager<R>) -> Option<Url> { m.config().build.dev_url.clone() }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Solo escritorio: instancia única, bandeja y autoactualizador. En el celular la app la maneja el sistema.
    #[cfg(desktop)]
    let builder = builder
        // Con la app en la bandeja, abrirla de nuevo (menú Inicio, acceso directo) muestra la que ya corre.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| mostrar(app)))
        .plugin(tauri_plugin_updater::Builder::new().build())
        // La X la manda a la bandeja (la voz sigue); se sale desde el menú del ícono.
        .on_window_event(|w, e| if let WindowEvent::CloseRequested { api, .. } = e {
            api.prevent_close();
            let _ = w.hide();
            let _ = w.emit("a-la-bandeja", ());
        });
    builder
        // Como Discord: la app se da sola el micrófono, pero solo a su propio origen (los ajustes de privacidad de Windows siguen mandando).
        .on_permission_request(|w, kind| match kind {
            PermissionKind::Microphone if w.url().is_ok_and(|u| es_origen_app(&u, dev_url(&w).as_ref())) => PermissionResponse::Allow,
            // En el celular también la cámara: el permiso del sistema lo pide Android al instalar/usar (MainActivity).
            PermissionKind::Camera if cfg!(mobile) && w.url().is_ok_and(|u| es_origen_app(&u, dev_url(&w).as_ref())) => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .on_page_load(|w, p| {
            #[cfg(windows)]
            if p.event() == PageLoadEvent::Started && es_origen_app(p.url(), dev_url(w).as_ref()) {
                permitir_microfono(w, p.url().origin().ascii_serialization());
            }
            #[cfg(not(windows))]
            let _ = (w, p, PageLoadEvent::Started);
        })
        // La ventana principal se crea acá (y no desde la config: `create: false`) para poder vigilar su navegación.
        // Ventanas nuevas (`target=_blank`, "Ver en YouTube" del reproductor) no pasan por `on_navigation`: se niegan todas.
        .setup(|app| {
            let cfg = app.config().app.windows[0].clone();
            let dev = dev_url(app);
            WebviewWindowBuilder::from_config(app, &cfg)?
                .on_navigation(move |u| es_origen_app(u, dev.as_ref()))
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            #[cfg(desktop)]
            bandeja(app)?;
            atajos::iniciar(app.handle().clone());
            Ok(())
        })
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(audio::Captura::default())
        .manage(transmisor::Transmisor::default())
        .invoke_handler(tauri::generate_handler![audio::iniciar_audio, audio::detener_audio, transmisor::fuentes_transmisor, transmisor::iniciar_transmisor, transmisor::calidad_transmisor, transmisor::detener_transmisor, memoria_baja, animaciones_ventana, maximizada, inactivo_ms, atajos::atajos_asignar, atajos::atajos_capturar, salir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Ícono en la bandeja de Windows: tocarlo abre la app; el menú tiene Abrir y Salir.
#[cfg(desktop)]
fn bandeja(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let abrir = MenuItem::with_id(app, "abrir", "Abrir Thunderop", true, None::<&str>)?;
    let salir = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().ok_or("sin ícono")?)
        .tooltip("Thunderop")
        .menu(&Menu::with_items(app, &[&abrir, &salir])?)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "abrir" => mostrar(app),
            "salir" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|t, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e { mostrar(t.app_handle()) }
        })
        .build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn u(s: &str) -> Url { Url::parse(s).unwrap() }

    #[test]
    fn origen_de_la_app() {
        for s in ["http://tauri.localhost/", "https://tauri.localhost/x", "tauri://localhost/index.html"] { assert!(es_origen_app(&u(s), None), "{s}"); }
    }

    #[test]
    fn origen_dev_solo_en_debug() {
        let dev = u("http://localhost:1420");
        assert_eq!(es_origen_app(&u("http://localhost:1420/grupos?x=1"), Some(&dev)), cfg!(debug_assertions));
        assert!(!es_origen_app(&u("http://localhost:1420/"), None));
    }

    #[test]
    fn origenes_ajenos() {
        let dev = u("http://localhost:1420");
        for s in ["https://evil.example/", "http://tauri.localhost.evil.com/", "http://localhost:9999/", "http://tauri.localhost:8080/", "data:text/html,hola", "about:blank"] {
            assert!(!es_origen_app(&u(s), Some(&dev)), "{s}");
        }
    }
}
/// La página la pide al irse a la bandeja si no hay llamada; `mostrar` vuelve a lo normal.
/// "Salir de Thunderop" del menú del perfil: cerrar la ventana solo la manda a la bandeja.
#[tauri::command]
fn salir(app: AppHandle) { app.exit(0) }

#[tauri::command]
fn memoria_baja(w: WebviewWindow) { nivel_memoria(&w, true) }

/// Pantalla completa: al entrar y salir la ventana se des-maximiza y re-maximiza, y la animación de Windows la mostraba
/// achicarse y agrandarse. Mientras dura el salto se apagan las transiciones de la ventana (DWMWA_TRANSITIONS_FORCEDISABLED).
#[tauri::command]
fn animaciones_ventana(w: WebviewWindow, si: bool) {
    #[cfg(windows)]
    {
        #[link(name = "dwmapi")]
        unsafe extern "system" { fn DwmSetWindowAttribute(hwnd: isize, atributo: u32, valor: *const i32, tam: u32) -> i32; }
        if let Ok(h) = w.hwnd() {
            let apagadas: i32 = if si { 0 } else { 1 };
            unsafe { DwmSetWindowAttribute(h.0 as isize, 3, &apagadas, 4) };
        }
    }
    #[cfg(not(windows))]
    let _ = (w, si);
}

/// Pantalla completa con la ventana maximizada: des-maximizarla la mostraba un instante en su tamaño normal (una ventana
/// más chica que aparecía y parpadeaba antes de agrandarse). `si = false` la des-maximiza ya del tamaño del monitor, sin
/// pasar por el chico; `si = true` la vuelve a maximizar de un salto y le devuelve el tamaño normal que tenía.
#[tauri::command]
fn maximizada(w: WebviewWindow, si: bool) {
    #[cfg(windows)]
    {
        if let Ok(h) = w.hwnd() { ubicacion::maximizada(h.0 as isize, si) }
    }
    #[cfg(not(windows))]
    let _ = (w, si);
}

#[cfg(windows)]
mod ubicacion {
    use std::sync::Mutex;

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    pub struct Rect { l: i32, t: i32, r: i32, b: i32 }
    #[repr(C)]
    #[derive(Default)]
    struct Ubicacion { tam: u32, flags: u32, mostrar: u32, min: [i32; 2], max: [i32; 2], normal: Rect } // WINDOWPLACEMENT
    #[repr(C)]
    #[derive(Default)]
    struct Monitor { tam: u32, todo: Rect, trabajo: Rect, flags: u32 } // MONITORINFO
    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetWindowPlacement(h: isize, u: *mut Ubicacion) -> i32;
        fn SetWindowPlacement(h: isize, u: *const Ubicacion) -> i32;
        fn MonitorFromWindow(h: isize, flags: u32) -> isize;
        fn GetMonitorInfoW(m: isize, i: *mut Monitor) -> i32;
    }
    const NORMAL: u32 = 1; // SW_SHOWNORMAL
    const MAXIMIZADA: u32 = 3; // SW_SHOWMAXIMIZED

    static TAMANIO_NORMAL: Mutex<Option<Rect>> = Mutex::new(None);

    pub fn maximizada(h: isize, si: bool) {
        let mut u = Ubicacion { tam: size_of::<Ubicacion>() as u32, ..Default::default() };
        if unsafe { GetWindowPlacement(h, &mut u) } == 0 { return; }
        let mut guardado = TAMANIO_NORMAL.lock().unwrap_or_else(|e| e.into_inner());
        if si {
            if let Some(r) = guardado.take() { u.normal = r; }
            u.mostrar = MAXIMIZADA;
        } else {
            let mut m = Monitor { tam: size_of::<Monitor>() as u32, ..Default::default() };
            if unsafe { GetMonitorInfoW(MonitorFromWindow(h, 2 /* MONITOR_DEFAULTTONEAREST */), &mut m) } == 0 { return; }
            *guardado = Some(u.normal);
            // `normal` va en coordenadas del área de trabajo: con la barra de tareas arriba o a la izquierda se corre.
            let (dx, dy) = (m.trabajo.l - m.todo.l, m.trabajo.t - m.todo.t);
            u.normal = Rect { l: m.todo.l - dx, t: m.todo.t - dy, r: m.todo.r - dx, b: m.todo.b - dy };
            u.mostrar = NORMAL;
        }
        u.flags = 0;
        unsafe { SetWindowPlacement(h, &u) };
    }
}

/// Milisegundos desde la última tecla o movimiento del mouse en toda la PC (no solo en la app): para el "Ausente" solo.
#[tauri::command]
fn inactivo_ms() -> u32 {
    #[cfg(windows)]
    {
        #[repr(C)]
        struct Ultimo { tam: u32, tick: u32 }
        #[link(name = "user32")]
        unsafe extern "system" { fn GetLastInputInfo(u: *mut Ultimo) -> i32; }
        #[link(name = "kernel32")]
        unsafe extern "system" { fn GetTickCount() -> u32; }
        let mut u = Ultimo { tam: 8, tick: 0 };
        if unsafe { GetLastInputInfo(&mut u) } != 0 { return unsafe { GetTickCount() }.wrapping_sub(u.tick); }
    }
    0
}

/// En "bajo" WebView2 recorta cachés y memoria de la página, que sigue viva (presencia, mensajes).
/// No se usa `TrySuspend`: congela los timers y la app aparecería desconectada.
#[cfg(windows)]
fn nivel_memoria(w: &WebviewWindow, baja: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows::core::Interface;

    let nivel = if baja { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
    let _ = w.with_webview(move |pw| {
        let r = unsafe { pw.controller().CoreWebView2().and_then(|c| c.cast::<ICoreWebView2_19>()?.SetMemoryUsageTargetLevel(nivel)) };
        if let Err(e) = r { eprintln!("no se pudo cambiar el nivel de memoria: {e}"); }
    });
}
#[cfg(not(windows))]
fn nivel_memoria(_: &WebviewWindow, _: bool) {}

/// Un "bloquear" guardado en el perfil de WebView2 no vuelve a preguntar (ni pasa por `on_permission_request`):
/// se pisa con "permitir" para el origen de la página en cada carga.
#[cfg(windows)]
fn permitir_microfono(w: &tauri::Webview, origen: String) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Profile4, ICoreWebView2SetPermissionStateCompletedHandler, ICoreWebView2_13,
        COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use windows::core::{Interface, HSTRING};

    let _ = w.with_webview(move |pw| {
        let r = unsafe {
            pw.controller().CoreWebView2().and_then(|c| {
                c.cast::<ICoreWebView2_13>()?.Profile()?.cast::<ICoreWebView2Profile4>()?.SetPermissionState(
                    COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, &HSTRING::from(origen), COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                    None::<&ICoreWebView2SetPermissionStateCompletedHandler>)
            })
        };
        if let Err(e) = r { eprintln!("no se pudo permitir el micrófono: {e}"); }
    });
}
