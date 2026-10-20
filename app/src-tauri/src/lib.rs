mod audio;

use tauri::webview::{NewWindowResponse, PageLoadEvent, PermissionKind, PermissionResponse};
use tauri::{Manager, Url, WebviewWindowBuilder};

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
            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(audio::Captura::default())
        .invoke_handler(tauri::generate_handler![audio::iniciar_audio, audio::detener_audio])
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
