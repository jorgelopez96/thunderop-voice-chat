mod audio;

use tauri::webview::{NewWindowResponse, PageLoadEvent, PermissionKind, PermissionResponse};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewWindow, WebviewWindowBuilder, WindowEvent};

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
    tauri::Builder::default()
        // Con la app en la bandeja, abrirla de nuevo (menú Inicio, acceso directo) muestra la que ya corre.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| mostrar(app)))
        // La X la manda a la bandeja (la voz sigue); se sale desde el menú del ícono.
        .on_window_event(|w, e| if let WindowEvent::CloseRequested { api, .. } = e {
            api.prevent_close();
            let _ = w.hide();
            let _ = w.emit("a-la-bandeja", ());
        })
        // Como Discord: la app se da sola el micrófono, pero solo a su propio origen (los ajustes de privacidad de Windows siguen mandando).
        .on_permission_request(|w, kind| match kind {
            PermissionKind::Microphone if w.url().is_ok_and(|u| es_origen_app(&u, dev_url(&w).as_ref())) => PermissionResponse::Allow,
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
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(audio::Captura::default())
        .invoke_handler(tauri::generate_handler![audio::iniciar_audio, audio::detener_audio, memoria_baja])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
#[tauri::command]
fn memoria_baja(w: WebviewWindow) { nivel_memoria(&w, true) }

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
